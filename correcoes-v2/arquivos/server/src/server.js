// Ponto de entrada do backend: sobe o Express, o Socket.io na mesma
// porta HTTP, e liga as rotas da API.
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import http from 'http';
import path from 'path';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import { iniciarChecagemPeriodica } from './services/parcelas-atraso.service.js';
import { prisma } from './prismaClient.js';

import authRoutes from './routes/auth.routes.js';
import corretoresRoutes from './routes/corretores.routes.js';
import vendasRoutes from './routes/vendas.routes.js';
import adminRoutes from './routes/admin.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import solicitacaoRoutes from './routes/solicitacao.routes.js';
import documentosRoutes from './routes/documentos.routes.js';
import { setIo } from './socket.js';
import { montarRanking } from './services/ranking.service.js';

// Sem o segredo do JWT nao existe login seguro - melhor recusar a subir
// do que descobrir so quando o primeiro usuario tentar entrar.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET nao configurado no .env - defina um segredo forte antes de subir o servidor (ver .env.example).');
}

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1); // essencial se rodar atras de proxy (Cloudflare, HostGator, etc.) - sem isso o rate limit conta todo mundo como o mesmo IP

// CLIENT_URL aceita uma ou várias origens separadas por vírgula - assim
// dá pra acessar tanto por localhost quanto pelo IP da rede local (ex:
// testar pelo celular) sem precisar ficar trocando o .env toda hora.
// Ex: CLIENT_URL="http://localhost:5173,http://192.168.18.2:5173"
const ORIGENS_PERMITIDAS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function origemPermitida(origin, callback) {
  // requisicao sem "origin" (ex: Postman, curl, apps nativos) e permitida
  if (!origin || ORIGENS_PERMITIDAS.includes(origin)) {
    return callback(null, true);
  }
  console.warn(`[cors] Origem bloqueada: ${origin}. Permitidas: ${ORIGENS_PERMITIDAS.join(', ')}`);
  callback(new Error('Origem não permitida pelo CORS.'));
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // sem isso, as fotos de perfil (servidas de outra origem/porta) parariam de carregar no frontend
app.use(cors({ origin: origemPermitida }));
app.use(express.json());

// Fotos de perfil enviadas pelos corretores (ver upload.middleware.js)
app.use('/uploads', express.static(path.resolve('uploads')));

// Healthcheck simples, util para monitorar a TV ligada 24/7
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', horario: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api', corretoresRoutes);
app.use('/api', vendasRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api', solicitacaoRoutes);
app.use('/api', documentosRoutes);

// 404 padrao da API
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota nao encontrada.' });
});

// Handler de erro final: sem ele o Express devolve uma pagina HTML com o
// stack trace (caminhos do servidor) quando algo lanca erro, ex: CORS.
app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);
  const ehCors = erro?.message === 'Origem não permitida pelo CORS.';
  if (!ehCors) console.error('Erro nao tratado:', erro);
  res.status(ehCors ? 403 : 500).json({ erro: ehCors ? 'Origem nao permitida.' : 'Erro interno do servidor.' });
});

// Socket.io - aceita conexao de qualquer TV/painel autorizado pelo CORS
const io = new SocketServer(server, {
  cors: { origin: origemPermitida, methods: ['GET', 'POST'] },
  // Mantem a conexao viva mesmo com a TV ligada o dia inteiro
  pingInterval: 25000,
  pingTimeout: 20000,
});
setIo(io);

// So aceita a conexao do socket se vier com um token JWT valido de um
// corretor logado (email + senha). Sem isso o ranking em tempo real nao
// fica acessivel a quem so descobrir a URL da TV.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Acesso restrito: token nao informado.'));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // confere no banco: conta desativada/rejeitada perde o acesso na hora
    const corretor = await prisma.corretor.findUnique({ where: { id: payload.corretorId } });
    if (!corretor || !corretor.ativo || corretor.status !== 'APROVADO') {
      return next(new Error('Acesso restrito: conta inativa.'));
    }
    socket.corretorId = corretor.id;
    socket.papel = corretor.papel; // papel atual do banco, nao o do token
    next();
  } catch (erro) {
    next(new Error('Acesso restrito: token invalido ou expirado.'));
  }
});

io.on('connection', async (socket) => {
  console.log(`[socket] TV/painel conectado: ${socket.id}`);

  // Sala por corretor (avisos pessoais, ex: solicitacao enviada pra
  // assinatura) e sala "admin" (avisos do backoffice, ex: solicitacao
  // nova) - assim cada evento so chega em quem realmente precisa ver.
  socket.join(`corretor:${socket.corretorId}`);
  if (socket.papel === 'ADMIN') socket.join('admin');

  // A TV informa qual salao quer ver via query string na conexao
  // (?salao=SALAO_1, ?salao=SALAO_2, ou nada = geral). Cada TV so entra
  // numa sala de ranking - e so recebe atualizacoes daquele salao dali
  // pra frente (ver emitirRankingAtualizado/emitirVendaNova).
  const salaoPedido = socket.handshake.query?.salao;
  const salaoTv = (salaoPedido === 'SALAO_1' || salaoPedido === 'SALAO_2') ? salaoPedido : 'geral';
  socket.join(`tv:${salaoTv}`);

  // Ao conectar, a TV ja recebe o ranking atual (do salao dela) sem
  // precisar esperar a proxima venda ser lancada
  try {
    const dadosRanking = await montarRanking(undefined, undefined, salaoTv === 'geral' ? undefined : salaoTv);
    socket.emit('ranking:update', dadosRanking);
  } catch (erro) {
    console.error('Erro ao enviar ranking inicial:', erro);
  }

  socket.on('disconnect', () => {
    console.log(`[socket] TV/painel desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3333;
// em producao, HOST=127.0.0.1: so o Nginx da propria VPS alcanca o Node
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Servidor Vida Saude Ranking rodando em ${HOST}:${PORT}`);
  iniciarChecagemPeriodica();
});