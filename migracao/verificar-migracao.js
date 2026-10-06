// Confere uma migracao PC -> VPS SEM imprimir nenhum dado pessoal.
// Roda nos dois lados (PC antes de migrar, VPS depois de restaurar) e voce
// compara a saida. Mostra:
//   1) contagem de registros de cada tabela;
//   2) se a DADOS_SENSIVEIS_CHAVE abre os campos cifrados (CPF, CNPJ,
//      pre-existencias): quantos abriram e quantos falharam;
//   3) se os arquivos citados no banco existem em disco (fotos de perfil e
//      documentos anexados).
//
// Uso (dentro de server/):
//   node verificar-migracao.js
//
// Somente leitura: nao altera banco nem arquivos.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { descriptografar } from './src/services/cripto.service.js';

const prisma = new PrismaClient();
const LIMITE_AMOSTRA = 200; // por coluna cifrada

// modelo do Prisma -> colunas cifradas
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

const TABELAS = [
  ['corretor', 'corretores'],
  ['solicitacao', 'solicitacoes'],
  ['titular', 'titulares'],
  ['dependente', 'dependentes'],
  ['venda', 'vendas'],
  ['adesao', 'adesoes'],
  ['metaEquipe', 'metas_equipe'],
  ['logAuditoria', 'logs_auditoria'],
];

async function contagens() {
  console.log('1) Registros por tabela');
  for (const [modelo, nome] of TABELAS) {
    try {
      const total = await prisma[modelo].count();
      console.log(`   ${nome.padEnd(16)} ${total}`);
    } catch {
      console.log(`   ${nome.padEnd(16)} (tabela nao existe - falta rodar db:deploy?)`);
    }
  }
}

async function chaveAbreOsDados() {
  console.log('\n2) A DADOS_SENSIVEIS_CHAVE abre os campos cifrados?');
  let falhas = 0;
  for (const [modelo, colunas] of Object.entries(CAMPOS_CIFRADOS)) {
    for (const coluna of colunas) {
      const linhas = await prisma[modelo].findMany({
        where: { [coluna]: { not: null } },
        select: { [coluna]: true },
        take: LIMITE_AMOSTRA,
      });
      let ok = 0;
      let ruim = 0;
      for (const linha of linhas) {
        try {
          descriptografar(linha[coluna]);
          ok += 1;
        } catch {
          ruim += 1;
        }
      }
      falhas += ruim;
      const marca = ruim === 0 ? 'OK ' : 'ERRO';
      console.log(`   ${marca} ${modelo}.${coluna}: ${ok} abriram, ${ruim} falharam (de ${linhas.length})`);
    }
  }
  return falhas;
}

async function arquivosExistem() {
  console.log('\n3) Arquivos citados no banco existem em disco?');
  const pastaUploads = path.resolve('uploads');
  const pastaDocs = path.resolve('documentos-privados');
  let faltando = 0;

  const corretores = await prisma.corretor.findMany({
    where: { fotoUrl: { not: null } },
    select: { fotoUrl: true },
  });
  let fotosOk = 0;
  for (const { fotoUrl } of corretores) {
    // fotos novas: "/uploads/arquivo.jpg"; antigas podem ser URL completa (nao conferimos)
    if (!fotoUrl.startsWith('/uploads/')) continue;
    const arquivo = path.join(pastaUploads, path.basename(fotoUrl));
    if (fs.existsSync(arquivo)) fotosOk += 1;
    else faltando += 1;
  }
  console.log(`   fotos de perfil: ${fotosOk} encontradas`);

  const solicitacoes = await prisma.solicitacao.findMany({
    where: { anexos: { not: null } },
    select: { anexos: true },
  });
  let docsOk = 0;
  let docsFalta = 0;
  for (const { anexos } of solicitacoes) {
    if (!Array.isArray(anexos)) continue;
    for (const anexo of anexos) {
      if (!anexo?.arquivo) continue;
      if (fs.existsSync(path.join(pastaDocs, path.basename(String(anexo.arquivo))))) docsOk += 1;
      else docsFalta += 1;
    }
  }
  faltando += docsFalta;
  console.log(`   documentos anexados: ${docsOk} encontrados, ${docsFalta} faltando`);
  return faltando;
}

async function main() {
  await contagens();
  const falhasChave = await chaveAbreOsDados();
  const arquivosFaltando = await arquivosExistem();

  console.log('\nResultado:');
  if (falhasChave === 0 && arquivosFaltando === 0) {
    console.log('   Tudo certo: a chave abre os dados e os arquivos estao no lugar.');
  } else {
    if (falhasChave > 0) {
      console.log('   ATENCAO: ha campos cifrados que nao abriram. A DADOS_SENSIVEIS_CHAVE deste .env');
      console.log('            nao e a mesma usada quando os dados foram gravados.');
    }
    if (arquivosFaltando > 0) {
      console.log('   ATENCAO: ha arquivos citados no banco que nao estao em disco. Restaure o');
      console.log('            .tar.gz (uploads/ e documentos-privados/) na pasta server/.');
    }
    process.exitCode = 1;
  }
}

main()
  .catch((erro) => {
    console.error('Erro na verificacao:', erro.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
