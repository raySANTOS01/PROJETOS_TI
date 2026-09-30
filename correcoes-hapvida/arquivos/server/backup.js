// Backup do banco + arquivos: gera um .sql (mysqldump) e um .tar.gz com
// uploads/ e documentos-privados/ (fotos de perfil e documentos de
// cliente, que ficam em disco, fora do banco), os dois com o mesmo
// carimbo de data/hora - e apaga backups antigos automaticamente
// (mantem so os ultimos N de cada tipo).
//
// Uso manual:
//   cd server
//   node backup.js
//
// Uso automatico (recomendado - roda sozinho todo dia):
//   Windows: cria uma tarefa no "Agendador de Tarefas" que roda
//            `node C:\caminho\completo\server\backup.js` todo dia de madrugada.
//   Linux/Mac: adiciona no crontab -> 0 3 * * * cd /caminho/server && node backup.js
//
// Precisa do mysqldump instalado (ja vem junto com o MySQL Server -
// mesmo pacote que voce instalou pra rodar o banco) e do "tar" no PATH
// (padrao em Linux/Mac; no Windows 10/11 ja vem instalado de fabrica).
//
// Se o mysqldump nao estiver no PATH do sistema, o script tenta achar
// sozinho em locais comuns de instalacao no Windows. Se mesmo assim nao
// encontrar, defina MYSQLDUMP_PATH no .env com o caminho completo do
// mysqldump.exe (ou mysqldump, no Linux/Mac).
//
// Dois modos (cada um com sua pasta e sua retencao):
//   node backup.js            -> DIARIO: .sql + .tar.gz (uploads/ e
//                                documentos-privados/), guarda os ultimos 14
//   node backup.js --horario  -> HORARIO: so o .sql (rapido e leve), guarda
//                                os ultimos 72 (~6 dias de expediente).
//                                Os arquivos de cliente sao enviados a parte,
//                                de forma incremental (ver backup-enviar.sh).
//
// Codigo de saida: 0 = tudo certo; 1 = alguma parte falhou (banco OU
// arquivos). Assim o cron/monitoramento consegue detectar a falha.
//
// ATENCAO: os arquivos gerados NAO sao criptografados por este script.
// Antes de enviar pra fora da VPS, cifre (ex: rclone crypt).
import 'dotenv/config';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MODO_HORARIO = process.argv.includes('--horario');
const PASTA_RAIZ = path.resolve('backups');
const PASTA_BACKUPS = path.join(PASTA_RAIZ, MODO_HORARIO ? 'horario' : 'diario');
// diario: 14 = 2 semanas. horario: 72 = 12 backups/dia (8h-19h) x 6 dias.
const MANTER_ULTIMOS = MODO_HORARIO ? 72 : 14;

function lerConexao() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL nao configurada no .env');

  // mysql://usuario:senha@host:porta/banco
  const m = url.match(/^mysql:\/\/([^:]+):([^@]*)@([^:/]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error('Nao consegui entender o formato do DATABASE_URL.');
  const [, usuario, senha, host, porta, banco] = m;
  return {
    usuario: decodeURIComponent(usuario),
    senha: decodeURIComponent(senha),
    host,
    porta,
    banco,
  };
}

// Descobre o caminho do executavel do mysqldump.
// Ordem de busca: 1) MYSQLDUMP_PATH no .env, 2) PATH do sistema,
// 3) pastas comuns de instalacao do MySQL no Windows.
// Devolve o caminho puro (sem aspas): o comando roda sem shell.
function encontrarMysqldump() {
  if (process.env.MYSQLDUMP_PATH) {
    if (!fs.existsSync(process.env.MYSQLDUMP_PATH)) {
      throw new Error(
        `MYSQLDUMP_PATH aponta para um arquivo que nao existe: ${process.env.MYSQLDUMP_PATH}`
      );
    }
    return process.env.MYSQLDUMP_PATH;
  }

  // Ja esta no PATH? (funciona em qualquer sistema operacional)
  try {
    const comandoTeste = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(comandoTeste, ['mysqldump'], { stdio: 'ignore' });
    return 'mysqldump';
  } catch {
    // nao esta no PATH, continua procurando
  }

  if (process.platform === 'win32') {
    const candidatos = [];
    const basesProgramFiles = [
      process.env['ProgramFiles'] || 'C:\\Program Files',
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    ];
    for (const base of basesProgramFiles) {
      const pastaMysql = path.join(base, 'MySQL');
      if (fs.existsSync(pastaMysql)) {
        for (const sub of fs.readdirSync(pastaMysql)) {
          candidatos.push(path.join(pastaMysql, sub, 'bin', 'mysqldump.exe'));
        }
      }
    }
    const encontrado = candidatos.find((c) => fs.existsSync(c));
    if (encontrado) return encontrado;
  }

  throw new Error(
    'Nao encontrei o mysqldump. Instale o MySQL Server (ou os Client Tools) ou defina ' +
      'MYSQLDUMP_PATH no .env com o caminho completo do executavel, ex:\n' +
      'MYSQLDUMP_PATH=C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe'
  );
}

// Confere se o .sql esta completo: o mysqldump termina o arquivo com uma
// linha "-- Dump completed on ..." (so quando terminou sem erro).
function dumpEstaCompleto(arquivo) {
  const tamanho = fs.statSync(arquivo).size;
  if (tamanho === 0) return false;
  const leitura = Math.min(tamanho, 2048);
  const fd = fs.openSync(arquivo, 'r');
  try {
    const buffer = Buffer.alloc(leitura);
    fs.readSync(fd, buffer, 0, leitura, tamanho - leitura);
    return buffer.toString('utf8').includes('-- Dump completed');
  } finally {
    fs.closeSync(fd);
  }
}

function removerSeExiste(arquivo) {
  try {
    fs.unlinkSync(arquivo);
  } catch {
    // ja nao existe, tudo bem
  }
}

function backup() {
  const { usuario, senha, host, porta, banco } = lerConexao();

  // pastas so pro dono: contem dados de clientes
  fs.mkdirSync(PASTA_BACKUPS, { recursive: true, mode: 0o700 });
  for (const pasta of [PASTA_RAIZ, PASTA_BACKUPS]) {
    try {
      fs.chmodSync(pasta, 0o700);
    } catch {
      // Windows nao usa permissoes de estilo Unix
    }
  }

  const agora = new Date();
  const carimbo = agora.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const arquivoSaida = path.join(PASTA_BACKUPS, `backup-${banco}-${carimbo}.sql`);

  console.log(`Gerando backup ${MODO_HORARIO ? 'horario' : 'diario'} de "${banco}"...`);

  let mysqldump;
  try {
    mysqldump = encontrarMysqldump();
  } catch (erro) {
    console.error('Falha ao gerar backup.');
    console.error(erro.message);
    process.exit(1);
  }

  // senha via variavel de ambiente MYSQL_PWD em vez de argumento na linha
  // de comando - evita que a senha apareca em logs de processo do sistema.
  // --no-tablespaces: o usuario da aplicacao nao tem o privilegio global
  // PROCESS, e sem essa opcao o mysqldump 8 falha com "Access denied".
  // --result-file: o mysqldump grava direto no arquivo, sem passar pela
  // memoria do Node (nao tem limite de tamanho do banco).
  const argumentos = [
    '-u', usuario,
    '-h', host,
    '-P', porta,
    '--single-transaction',
    '--no-tablespaces',
    '--routines',
    '--triggers',
    `--result-file=${arquivoSaida}`,
    banco,
  ];

  try {
    execFileSync(mysqldump, argumentos, {
      env: { ...process.env, MYSQL_PWD: senha },
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    if (!dumpEstaCompleto(arquivoSaida)) {
      throw new Error('O arquivo .sql esta vazio ou incompleto (sem "-- Dump completed").');
    }
    fs.chmodSync(arquivoSaida, 0o600);
    const mb = (fs.statSync(arquivoSaida).size / 1024 / 1024).toFixed(2);
    console.log(`Backup do banco salvo em: ${arquivoSaida} (${mb} MB)`);
  } catch (erro) {
    // nao deixa um dump quebrado parecendo um backup valido
    removerSeExiste(arquivoSaida);
    console.error('Falha ao gerar backup ao executar o mysqldump.');
    console.error(erro.stderr ? erro.stderr.toString() : erro.message);
    process.exit(1);
  }

  // no modo horario so o banco: os arquivos vao por envio incremental
  const arquivosOk = MODO_HORARIO ? true : arquivarPastas(carimbo);
  limparBackupsAntigos();

  if (!arquivosOk) process.exit(1);
}

// Empacota uploads/ (fotos de perfil) e documentos-privados/ (documentos
// de cliente, ja criptografados em disco) num .tar.gz - esses arquivos
// ficam fora do banco, entao o dump do mysqldump sozinho nao os cobre.
// Devolve true se deu certo (ou se nao havia nada pra guardar).
function arquivarPastas(carimbo) {
  const pastas = [
    { nome: 'uploads', caminho: path.resolve('uploads') },
    { nome: 'documentos-privados', caminho: path.resolve('documentos-privados') },
  ].filter((p) => fs.existsSync(p.caminho) && fs.readdirSync(p.caminho).length > 0);

  if (pastas.length === 0) {
    console.log('Nenhum arquivo em uploads/ ou documentos-privados/ pra guardar ainda.');
    return true;
  }

  const arquivoSaida = path.join(PASTA_BACKUPS, `arquivos-${carimbo}.tar.gz`);

  try {
    // roda a partir da pasta server/ (cwd), pra dentro do tar os caminhos
    // ficarem so "uploads/..." e "documentos-privados/...", sem o caminho
    // completo do computador - assim restaura em qualquer maquina
    execFileSync('tar', ['-czf', arquivoSaida, ...pastas.map((p) => p.nome)], {
      cwd: path.resolve('.'),
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    fs.chmodSync(arquivoSaida, 0o600);
    console.log(`Arquivos (uploads + documentos) salvos em: ${arquivoSaida}`);
    return true;
  } catch (erro) {
    removerSeExiste(arquivoSaida);
    console.error('Falha ao arquivar uploads/documentos-privados (o backup do banco acima foi salvo normalmente).');
    console.error(erro.stderr ? erro.stderr.toString() : erro.message);
    return false;
  }
}

function limparBackupsAntigos() {
  for (const extensao of ['.sql', '.tar.gz']) {
    const arquivos = fs
      .readdirSync(PASTA_BACKUPS)
      .filter((f) => f.endsWith(extensao))
      .map((f) => ({ nome: f, caminho: path.join(PASTA_BACKUPS, f), mtime: fs.statSync(path.join(PASTA_BACKUPS, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    const paraApagar = arquivos.slice(MANTER_ULTIMOS);
    for (const arquivo of paraApagar) {
      fs.unlinkSync(arquivo.caminho);
      console.log(`Backup antigo removido: ${arquivo.nome}`);
    }
  }
}

backup();
