const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { open } = require('./src/db');
const { ensureAdmin, resetAdminPassword } = require('./src/auth');
const publicRoutes = require('./src/routes-public');
const adminRoutes = require('./src/routes-admin');
const { HttpError } = require('./src/util');
const { loadBrand, tokens, themeCss } = require('./src/brand');

function createApp(db, brand = loadBrand(), { uploadDir = path.join(__dirname, 'data', `${brand.id}-uploads`) } = {}) {
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
  // o envio de fotos (/api/admin/upload) faz seu próprio parse, com limite maior e só depois do login
  app.use((req, res, next) => req.path === '/api/admin/upload' ? next() : express.json({ limit: '20kb' })(req, res, next));

  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/public', publicRoutes(db, brand));
  app.use('/api/admin', adminRoutes(db, brand, { uploadDir }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  // Páginas em views/ (ou views/<vertical>/, que tem prioridade) têm marcadores {{...}} trocados
  // pelos dados da marca e trechos {{>nome}} trocados por views/<vertical>/partials/nome.html.
  const tk = tokens(brand);
  const views = path.join(__dirname, 'views');
  const find = rel => [path.join(views, brand.vertical, rel), path.join(views, rel)].find(f => fs.existsSync(f));
  const render = html => html
    .replace(/\{\{>(\w+)\}\}/g, (_, n) => render(fs.readFileSync(find(`partials/${n}.html`), 'utf8')))
    .replace(/\{\{(\w+)\}\}/g, (_, k) => tk[k] ?? '');
  const cache = {};
  const page = name => (req, res, next) => {
    const file = find(name);
    if (!file) return next();
    cache[name] ??= render(fs.readFileSync(file, 'utf8'));
    res.type('html').send(cache[name]);
  };
  for (const [route, file] of [['/', 'index.html'], ['/agendar', 'agendar.html'], ['/consulta', 'consulta.html'],
    ['/admin', 'admin.html'], ['/catalogo', 'catalogo.html'], ['/pedido', 'pedido.html']]) app.get(route, page(file));
  const theme = themeCss(brand);
  app.get('/theme.css', (req, res) => res.type('css').send(theme));
  app.use('/img', express.static(brand.imgDir));
  app.use('/uploads', express.static(uploadDir, { index: false, dotfiles: 'deny' }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'Requisição inválida.' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  });
  return app;
}

if (require.main === module) {
  const brand = loadBrand();
  const db = open(process.env.DB_FILE || path.join(__dirname, 'data', `${brand.id}.db`), brand);
  const created = ensureAdmin(db);
  if (created) {
    console.log('\n=== Primeiro acesso ao painel ===');
    console.log(`Usuário: ${created.username}`);
    if (created.generated) console.log(`Senha:   ${created.password}   (anote; troque em Painel > Conta)`);
    else console.log('Senha:   definida em ADMIN_PASSWORD');
    console.log('=================================\n');
  }
  if (process.env.RESET_ADMIN_PASSWORD) {
    resetAdminPassword(db, process.env.RESET_ADMIN_PASSWORD);
    console.log('Senha do usuário "admin" redefinida. Remova RESET_ADMIN_PASSWORD das próximas execuções.');
  }
  const port = Number(process.env.PORT) || 3000;
  createApp(db, brand).listen(port, () => console.log(`${brand.fullName} rodando em http://localhost:${port}  (painel: /admin)`));
}

module.exports = { createApp };
