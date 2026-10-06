// Troca a DADOS_SENSIVEIS_CHAVE: decifra tudo com a chave ANTIGA e recifra com a
// chave NOVA - os campos cifrados do banco (CPF, CNPJ, pre-existencias) e os
// documentos em documentos-privados/. Use quando a chave atual e fraca ou de
// exemplo e voce quer migrar dados reais pra producao com uma chave forte.
//
// SEGURANCA - como o script se protege:
//   * Por padrao NAO altera nada (simulacao): decifra e recifra tudo em
//     memoria, confere que o resultado volta igual, e so reporta.
//   * Se QUALQUER valor ou arquivo nao abrir com a chave antiga, aborta sem
//     escrever nada (nunca mistura dado cifrado com duas chaves).
//   * Os documentos novos vao pra uma pasta paralela (documentos-privados.novo),
//     o banco e atualizado numa transacao unica, e so no fim as pastas sao
//     trocadas. A pasta original fica guardada como documentos-privados.antigo-*.
//   * Nao imprime nenhum dado pessoal: so contagens e ids.
//
// Uso (dentro de server/, com o SERVIDOR PARADO e um BACKUP feito):
//   1) no .env, acrescente a chave nova (gere com:
//        node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"):
//        DADOS_SENSIVEIS_CHAVE_NOVA="<chave nova>"
//   2) node recifrar-dados.js                                  (simulacao)
//   3) node recifrar-dados.js --aplicar --confirmo-backup      (grava)
//   4) no .env: troque DADOS_SENSIVEIS_CHAVE pelo valor novo e APAGUE a linha
//      DADOS_SENSIVEIS_CHAVE_NOVA. Depois: node verificar-migracao.js
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APLICAR = process.argv.includes('--aplicar');
const CONFIRMO_BACKUP = process.argv.includes('--confirmo-backup');

// modelo do Prisma -> colunas cifradas (strings base64: iv + tag + cifrado)
const CAMPOS_CIFRADOS = {
  titular: ['cpfEnc', 'possuiPreexistenteEnc', 'possuiPreexistenteDescricaoEnc'],
  dependente: ['cpfEnc', 'possuiPreexistenteEnc', 'possuiPreexistenteDescricaoEnc'],
  solicitacao: [
    'empresaCnpjEnc',
    'responsavelCpfEnc',
    'responsavelPossuiPreexistenteEnc',
    'responsavelPossuiPreexistenteDescricaoEnc',
  ],
};

const PASTA_DOCS = path.resolve('documentos-privados');
const PASTA_NOVA = path.resolve('documentos-privados.novo');

// --- mesma cifra do cripto.service.js (AES-256-GCM, chave = sha256(segredo)) ---
const derivar = (segredo) => crypto.createHash('sha256').update(String(segredo)).digest();

function decifrarBuffer(buffer, chave) {
  const decifra = crypto.createDecipheriv('aes-256-gcm', chave, buffer.subarray(0, 12));
  decifra.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decifra.update(buffer.subarray(28)), decifra.final()]);
}

function cifrarBuffer(buffer, chave) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const cifrado = Buffer.concat([cifra.update(buffer), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), cifrado]);
}

const decifrarTexto = (b64, chave) => decifrarBuffer(Buffer.from(b64, 'base64'), chave).toString('utf8');
const cifrarTexto = (texto, chave) => cifrarBuffer(Buffer.from(String(texto), 'utf8'), chave).toString('base64');

function sair(mensagem) {
  console.error(`\nABORTADO: ${mensagem}`);
  console.error('Nada foi alterado.');
  process.exit(1);
}

function lerChaves() {
  const antiga = process.env.DADOS_SENSIVEIS_CHAVE;
  const nova = process.env.DADOS_SENSIVEIS_CHAVE_NOVA;
  if (!antiga) sair('DADOS_SENSIVEIS_CHAVE (a chave atual) nao esta no .env.');
  if (!nova) sair('DADOS_SENSIVEIS_CHAVE_NOVA nao esta no .env. Gere uma e acrescente (veja o topo deste arquivo).');
  if (antiga === nova) sair('A chave nova e igual a antiga.');
  if (String(nova).length < 48) sair('A chave nova precisa ter pelo menos 48 caracteres (use randomBytes(48).toString("hex")).');
  if (/troque|exemplo|senha|chave/i.test(nova)) sair('A chave nova parece um texto de exemplo. Gere uma aleatoria.');
  return { antiga: derivar(antiga), nova: derivar(nova) };
}

// Passo 1: decifra com a antiga, recifra com a nova, confere a volta. Devolve o
// plano de atualizacoes do banco. Qualquer falha aborta.
async function planejarBanco({ antiga, nova }) {
  const plano = new Map(); // "modelo:id" -> { modelo, id, dados: { coluna: novoValor } }
  let total = 0;

  for (const [modelo, colunas] of Object.entries(CAMPOS_CIFRADOS)) {
    const linhas = await prisma[modelo].findMany({
      select: { id: true, ...Object.fromEntries(colunas.map((c) => [c, true])) },
    });

    for (const linha of linhas) {
      for (const coluna of colunas) {
        const valor = linha[coluna];
        if (valor === null || valor === undefined) continue;

        let claro;
        try {
          claro = decifrarTexto(valor, antiga);
        } catch {
          sair(`${modelo}.${coluna} (id ${linha.id}) nao abre com a chave ANTIGA. Esta e mesmo a chave usada quando o dado foi gravado?`);
        }
        const recifrado = cifrarTexto(claro, nova);
        if (decifrarTexto(recifrado, nova) !== claro) sair(`falha de conferencia em ${modelo}.${coluna} (id ${linha.id}).`);

        const chave = `${modelo}:${linha.id}`;
        if (!plano.has(chave)) plano.set(chave, { modelo, id: linha.id, dados: {} });
        plano.get(chave).dados[coluna] = recifrado;
        total += 1;
      }
    }
  }
  return { plano, total };
}

// Passo 2: confere (sem gravar) que cada documento abre com a chave antiga e
// sobrevive a ida e volta com a nova.
function listarDocumentos() {
  if (!fs.existsSync(PASTA_DOCS)) return [];
  return fs.readdirSync(PASTA_DOCS, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
}

function conferirDocumentos(nomes, { antiga, nova }) {
  for (const nome of nomes) {
    let claro;
    try {
      claro = decifrarBuffer(fs.readFileSync(path.join(PASTA_DOCS, nome)), antiga);
    } catch {
      sair(`o documento "${nome}" nao abre com a chave ANTIGA.`);
    }
    if (!decifrarBuffer(cifrarBuffer(claro, nova), nova).equals(claro)) sair(`falha de conferencia no documento "${nome}".`);
  }
}

async function aplicar(plano, documentos, chaves) {
  if (fs.existsSync(PASTA_NOVA)) sair(`a pasta ${path.basename(PASTA_NOVA)} ja existe (sobra de uma execucao anterior). Apague-a ou renomeie e tente de novo.`);

  // 1) documentos novos numa pasta paralela (o original nao e tocado)
  fs.mkdirSync(PASTA_NOVA, { recursive: true, mode: 0o700 });
  try {
    for (const nome of documentos) {
      const claro = decifrarBuffer(fs.readFileSync(path.join(PASTA_DOCS, nome)), chaves.antiga);
      const novoConteudo = cifrarBuffer(claro, chaves.nova);
      const destino = path.join(PASTA_NOVA, nome);
      fs.writeFileSync(destino, novoConteudo, { mode: 0o600 });
      if (!decifrarBuffer(fs.readFileSync(destino), chaves.nova).equals(claro)) throw new Error(`conferencia falhou em ${nome}`);
    }
  } catch (erro) {
    fs.rmSync(PASTA_NOVA, { recursive: true, force: true });
    sair(`erro ao recifrar documentos (${erro.message}).`);
  }
  console.log(`   documentos recifrados na pasta paralela: ${documentos.length}`);

  // 2) banco: tudo numa transacao so (ou grava tudo, ou nada)
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const { modelo, id, dados } of plano.values()) {
          await tx[modelo].update({ where: { id }, data: dados });
        }
      },
      { timeout: 10 * 60 * 1000, maxWait: 30 * 1000 }
    );
  } catch (erro) {
    fs.rmSync(PASTA_NOVA, { recursive: true, force: true });
    sair(`erro ao gravar no banco (${erro.message}). O banco continua com a chave antiga.`);
  }
  console.log(`   registros do banco atualizados: ${plano.size}`);

  // 3) troca as pastas; a antiga fica guardada
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const guardada = path.resolve(`documentos-privados.antigo-${carimbo}`);
  try {
    if (fs.existsSync(PASTA_DOCS)) fs.renameSync(PASTA_DOCS, guardada);
    fs.renameSync(PASTA_NOVA, PASTA_DOCS);
  } catch (erro) {
    console.error('\nATENCAO: o banco JA foi atualizado, mas a troca das pastas falhou:', erro.message);
    console.error(`Faca na mao, nesta ordem: renomeie "${path.basename(PASTA_DOCS)}" para "${path.basename(guardada)}" e renomeie "${path.basename(PASTA_NOVA)}" para "${path.basename(PASTA_DOCS)}".`);
    process.exit(2);
  }
  console.log(`   pasta original guardada em: ${path.basename(guardada)}`);
}

async function main() {
  const chaves = lerChaves();

  console.log(APLICAR ? 'Modo: APLICAR' : 'Modo: SIMULACAO (nada sera alterado)');
  console.log('\n1) Campos cifrados do banco');
  const { plano, total } = await planejarBanco(chaves);
  console.log(`   campos verificados: ${total} (em ${plano.size} registros) - todos abrem com a chave antiga`);

  console.log('\n2) Documentos (documentos-privados/)');
  const documentos = listarDocumentos();
  conferirDocumentos(documentos, chaves);
  console.log(`   documentos verificados: ${documentos.length} - todos abrem com a chave antiga`);

  if (!APLICAR) {
    console.log('\nSimulacao concluida: tudo pode ser recifrado. NADA foi alterado.');
    console.log('Para gravar: pare o servidor, faca um backup e rode com --aplicar --confirmo-backup');
    return;
  }

  if (!CONFIRMO_BACKUP) sair('para gravar, confirme que fez backup acrescentando --confirmo-backup (e que o servidor esta parado).');

  console.log('\n3) Gravando');
  await aplicar(plano, documentos, chaves);

  console.log('\nPRONTO. Proximos passos:');
  console.log('   a) no .env troque DADOS_SENSIVEIS_CHAVE pelo valor da chave NOVA e apague a linha DADOS_SENSIVEIS_CHAVE_NOVA;');
  console.log('   b) rode: node verificar-migracao.js  (deve terminar com "Tudo certo");');
  console.log('   c) guarde a chave nova no gerenciador de senhas ANTES de usar o sistema.');
}

main()
  .catch((erro) => {
    console.error('Erro inesperado:', erro.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
