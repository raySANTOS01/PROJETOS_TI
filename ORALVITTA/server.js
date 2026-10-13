const path = require('node:path');
const express = require('express');
const { open } = require('./src/db');
const { ensureAdmin } = require('./src/auth');
const publicRoutes = require('./src/routes-public');
const adminRoutes = require('./src/routes-admin');
const { HttpError } = require('./src/util');

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'");
    next();
  });
  app.use(express.json({ limit: '20kb' }));

  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/public', publicRoutes(db));
  app.use('/api/admin', adminRoutes(db));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  const pub = path.join(__dirname, 'public');
  const page = f => (req, res) => res.sendFile(path.join(pub, f));
  app.get('/', page('index.html'));
  app.get('/agendar', page('agendar.html'));
  app.get('/consulta', page('consulta.html'));
  app.get('/admin', page('admin.html'));
  app.use(express.static(pub, { extensions: ['html'] }));

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'Requisição inválida.' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  });
  return app;
}

if (require.main === module) {
  const db = open(process.env.DB_FILE || path.join(__dirname, 'data', 'oralvitta.db'));
  const created = ensureAdmin(db);
  if (created) {
    console.log('\n=== Primeiro acesso ao painel ===');
    console.log(`Usuário: ${created.username}`);
    if (created.generated) console.log(`Senha:   ${created.password}   (anote; troque em Painel > Conta)`);
    else console.log('Senha:   definida em ADMIN_PASSWORD');
    console.log('=================================\n');
  }
  const port = Number(process.env.PORT) || 3000;
  createApp(db).listen(port, () => console.log(`OralVitta rodando em http://localhost:${port}  (painel: /admin)`));
}

module.exports = { createApp };
