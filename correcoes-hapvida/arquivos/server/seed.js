// Cria SO as contas de administrador, lidas do .env - sem nenhuma venda,
// solicitacao ou corretor de demonstracao. Os demais usuarios (corretores,
// socios) sao cadastrados depois, pelo proprio sistema.
//
// Define no server/.env (um bloco por admin: _1_, _2_, ...):
//   SEED_ADMIN_1_NOME="Ray Martins"
//   SEED_ADMIN_1_EMAIL="seu@email.com"
//   SEED_ADMIN_1_SENHA="<senha forte, 10+ caracteres>"
//
// Rodar:
//   npm run seed
//
// Depois de rodar, apague as linhas SEED_ do .env. Se a conta ja existir,
// ela NAO e alterada (nem a senha) - rodar de novo e seguro.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const MAX_ADMINS = 10;
const TAMANHO_MINIMO_SENHA = 10;

function lerAdmins() {
  const admins = [];
  for (let i = 1; i <= MAX_ADMINS; i++) {
    const nome = process.env[`SEED_ADMIN_${i}_NOME`]?.trim();
    const email = process.env[`SEED_ADMIN_${i}_EMAIL`]?.trim().toLowerCase();
    const senha = process.env[`SEED_ADMIN_${i}_SENHA`];

    // bloco inteiro ausente: acabou a lista
    if (!nome && !email && !senha) continue;

    if (!nome || !email || !senha) {
      throw new Error(`SEED_ADMIN_${i}: preencha NOME, EMAIL e SENHA (falta algum dos tres).`);
    }
    if (!email.includes('@')) {
      throw new Error(`SEED_ADMIN_${i}_EMAIL nao parece um e-mail valido.`);
    }
    if (senha.length < TAMANHO_MINIMO_SENHA) {
      throw new Error(`SEED_ADMIN_${i}_SENHA precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
    }
    admins.push({ nome, email, senha });
  }

  if (admins.length === 0) {
    throw new Error(
      'Nenhum admin definido. Configure SEED_ADMIN_1_NOME, SEED_ADMIN_1_EMAIL e SEED_ADMIN_1_SENHA no .env.'
    );
  }
  return admins;
}

async function main() {
  const admins = lerAdmins();
  console.log('Criando contas de administrador...\n');

  for (const admin of admins) {
    const senhaHash = await bcrypt.hash(admin.senha, 10);
    const existente = await prisma.corretor.findUnique({ where: { email: admin.email } });

    if (existente) {
      console.log(`Ja existe (nada alterado): ${existente.nome} <${existente.email}> - papel: ${existente.papel}`);
      continue;
    }

    const corretor = await prisma.corretor.create({
      data: {
        nome: admin.nome,
        email: admin.email,
        senhaHash,
        papel: 'ADMIN',
        status: 'APROVADO',
      },
    });
    console.log(`Conta criada: ${corretor.nome} <${corretor.email}> - papel: ${corretor.papel}`);
  }

  console.log('\nSeed concluido. Agora apague as linhas SEED_ do .env (elas guardam a senha em texto).');
}

main()
  .catch((erro) => {
    console.error('Erro no seed:', erro.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
