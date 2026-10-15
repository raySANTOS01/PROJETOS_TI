// Vertical "loja": catálogo editável, pedidos por WhatsApp, contatos e envio de fotos.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const S = require('./schedule');
const clock = require('./clock');
const { transaction } = require('./db');
const { rateLimiter } = require('./auth');
const { HttpError, normalizePhone, newCode, str, wrap } = require('./util');
const { fieldSpec, readDetails } = require('./purchase');

const ORDER_STATUSES = ['new', 'contacted', 'confirmed', 'delivered', 'cancelled'];
const IMAGE_RE = /^(\/img\/|\/uploads\/)[A-Za-z0-9._-]+$/;

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'categoria';

const presentProduct = p => ({
  id: p.id, category_id: p.category_id, name: p.name, description: p.description,
  price_mode: p.price_mode, price_cents: p.price_cents, image: p.image,
  service_id: p.service_id, featured: !!p.featured, active: !!p.active, sort: p.sort,
});

function readImage(v) {
  const img = typeof v === 'string' ? v.trim() : '';
  if (img && !IMAGE_RE.test(img)) throw new HttpError(400, 'Imagem inválida.');
  return img;
}

function readPrice(body) {
  const mode = ['fixed', 'from', 'quote'].includes(body.price_mode) ? body.price_mode : 'quote';
  if (mode === 'quote') return { mode, cents: null };
  const n = Number(String(body.price).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 100000) throw new HttpError(400, 'Informe um preço válido (ex.: 89,90).');
  return { mode, cents: Math.round(n * 100) };
}

// ---------------------------------------------------------------- público
function publicLoja(db, brand) {
  const r = express.Router();
  const orderLimit = rateLimiter({ windowMs: 3600_000, max: Number(process.env.BOOK_RATE_MAX) || 10 });
  const leadLimit = rateLimiter({ windowMs: 3600_000, max: Number(process.env.BOOK_RATE_MAX) || 5 });

  r.get('/catalog', (req, res) => {
    const cats = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort, id').all();
    const prods = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort, id').all();
    res.json({
      categories: cats.map(c => ({
        id: c.id, name: c.name, slug: c.slug, description: c.description, image: c.image,
        products: prods.filter(p => p.category_id === c.id).map(presentProduct),
      })).filter(c => c.products.length),
    });
  });

  r.post('/orders', wrap((req, res) => {
    if (!orderLimit(req.ip)) throw new HttpError(429, 'Muitas tentativas. Tente novamente mais tarde.');
    const b = req.body;
    if (b.consent !== true) throw new HttpError(400, 'É necessário concordar com o uso dos dados para enviar o pedido.');
    const name = str(b.name, 100, { required: true, label: 'Seu nome completo' });
    const phone = normalizePhone(b.phone);
    if (!phone) throw new HttpError(400, 'Informe um telefone/WhatsApp válido com DDD.');
    const details = readDetails(fieldSpec(db, brand), b);
    const recipient = details.recipient || '';
    const address = details.address || '';
    const card = str(b.card_message, 300, { label: 'Mensagem do cartão' });
    const notes = str(b.notes, 500, { label: 'Observações' });
    let date = '';
    if (b.delivery_date) {
      if (!S.isValidDate(b.delivery_date)) throw new HttpError(400, 'Data de entrega inválida.');
      if (b.delivery_date < clock.now().date) throw new HttpError(400, 'A data de entrega não pode ser no passado.');
      date = b.delivery_date;
    }
    let time = '';
    if (b.delivery_time) {
      if (Number.isNaN(S.toMin(b.delivery_time))) throw new HttpError(400, 'Horário de entrega inválido.');
      time = b.delivery_time;
    }
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30) throw new HttpError(400, 'Escolha pelo menos um item.');

    const items = [];
    for (const it of b.items) {
      const qty = Number(it.qty);
      const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(Number(it.id));
      if (!p || !Number.isInteger(qty) || qty < 1 || qty > 20) throw new HttpError(400, 'Há um item inválido no pedido. Atualize a página e tente de novo.');
      items.push({ id: p.id, name: p.name, qty, price_mode: p.price_mode, price_cents: p.price_cents });
    }
    const total = items.every(i => i.price_mode === 'fixed') ? items.reduce((s, i) => s + i.qty * i.price_cents, 0) : null;

    let code;
    for (let i = 0; i < 10; i++) {
      code = newCode();
      if (!db.prepare('SELECT 1 FROM orders WHERE code = ?').get(code)) break;
    }
    db.prepare(`INSERT INTO orders(code, name, phone, recipient, address, delivery_date, delivery_time, card_message, notes, items, details)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(code, name, phone, recipient, address, date, time, card, notes, JSON.stringify(items), JSON.stringify(details));
    res.status(201).json({ code, items, total_cents: total, status: 'new' });
  }));

  r.post('/leads', wrap((req, res) => {
    if (!leadLimit(req.ip)) throw new HttpError(429, 'Muitas tentativas. Tente novamente mais tarde.');
    const phone = normalizePhone(req.body.phone);
    if (!phone) throw new HttpError(400, 'Informe um telefone válido com DDD.');
    const name = str(req.body.name, 100, { label: 'Nome' });
    const dup = db.prepare("SELECT id FROM leads WHERE phone = ? AND status = 'new'").get(phone);
    if (!dup) db.prepare('INSERT INTO leads(name, phone) VALUES (?,?)').run(name, phone);
    res.status(201).json({ ok: true });
  }));
  return r;
}

// ---------------------------------------------------------------- painel
function adminLoja(r, db, brand, { uploadDir }) {
  const present = o => ({
    id: o.id, code: o.code, name: o.name, phone: o.phone, recipient: o.recipient, address: o.address,
    delivery_date: o.delivery_date, delivery_time: o.delivery_time, card_message: o.card_message,
    notes: o.notes, items: JSON.parse(o.items), details: JSON.parse(o.details || '{}'), status: o.status, created_at: o.created_at,
  });

  r.get('/loja/summary', (req, res) => {
    const n = sql => db.prepare(sql).get().n;
    res.json({
      orders_new: n("SELECT COUNT(*) n FROM orders WHERE status = 'new'"),
      orders_open: n("SELECT COUNT(*) n FROM orders WHERE status IN ('new','contacted','confirmed')"),
      leads_new: n("SELECT COUNT(*) n FROM leads WHERE status = 'new'"),
      products: n('SELECT COUNT(*) n FROM products WHERE active = 1'),
      recent_orders: db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 6").all().map(present),
    });
  });

  // ----- categorias
  r.get('/categories', (req, res) => {
    res.json(db.prepare('SELECT * FROM categories ORDER BY sort, id').all().map(c => ({ ...c, active: !!c.active })));
  });
  const readCategory = body => ({
    name: str(body.name, 60, { required: true, label: 'Nome da categoria' }),
    description: str(body.description, 200, { label: 'Descrição' }),
    image: readImage(body.image),
    active: body.active === false ? 0 : 1,
    sort: Number.isInteger(Number(body.sort)) ? Number(body.sort) : 0,
  });
  r.post('/categories', wrap((req, res) => {
    const c = readCategory(req.body);
    let slug = slugify(c.name), n = 1;
    while (db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug)) slug = `${slugify(c.name)}-${++n}`;
    const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 n FROM categories').get().n;
    const info = db.prepare('INSERT INTO categories(name, slug, description, image, active, sort) VALUES (?,?,?,?,?,?)')
      .run(c.name, slug, c.description, c.image, c.active, sort);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }));
  r.put('/categories/:id', wrap((req, res) => {
    const c = readCategory(req.body);
    const info = db.prepare('UPDATE categories SET name=?, description=?, image=?, active=?, sort=? WHERE id=?')
      .run(c.name, c.description, c.image, c.active, c.sort, Number(req.params.id));
    if (!info.changes) throw new HttpError(404, 'Categoria não encontrada.');
    res.json({ ok: true });
  }));
  r.delete('/categories/:id', wrap((req, res) => {
    const id = Number(req.params.id);
    if (db.prepare('SELECT COUNT(*) n FROM products WHERE category_id = ?').get(id).n) {
      throw new HttpError(409, 'Esta categoria ainda tem produtos. Mova ou exclua os produtos antes, ou apenas desative a categoria.');
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ ok: true });
  }));

  // ----- produtos
  r.get('/products', (req, res) => {
    res.json(db.prepare('SELECT * FROM products ORDER BY category_id, sort, id').all().map(presentProduct));
  });
  const readProduct = body => {
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(body.category_id));
    if (!cat) throw new HttpError(400, 'Escolha uma categoria.');
    const price = readPrice(body);
    let serviceId = null;
    if (body.service_id) {
      const svc = db.prepare('SELECT id FROM services WHERE id = ?').get(Number(body.service_id));
      if (!svc) throw new HttpError(400, 'Serviço de agendamento inválido.');
      serviceId = svc.id;
    }
    return {
      category_id: cat.id,
      name: str(body.name, 80, { required: true, label: 'Nome do produto' }),
      description: str(body.description, 400, { label: 'Descrição' }),
      price_mode: price.mode, price_cents: price.cents, image: readImage(body.image),
      service_id: serviceId, featured: body.featured ? 1 : 0, active: body.active === false ? 0 : 1,
      sort: Number.isInteger(Number(body.sort)) ? Number(body.sort) : 0,
    };
  };
  r.post('/products', wrap((req, res) => {
    const p = readProduct(req.body);
    const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 n FROM products WHERE category_id = ?').get(p.category_id).n;
    const info = db.prepare(`INSERT INTO products(category_id, name, description, price_mode, price_cents, image, service_id, featured, active, sort)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(p.category_id, p.name, p.description, p.price_mode, p.price_cents, p.image, p.service_id, p.featured, p.active, sort);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }));
  r.put('/products/:id', wrap((req, res) => {
    const p = readProduct(req.body);
    const info = db.prepare(`UPDATE products SET category_id=?, name=?, description=?, price_mode=?, price_cents=?, image=?, service_id=?, featured=?, active=?, sort=? WHERE id=?`)
      .run(p.category_id, p.name, p.description, p.price_mode, p.price_cents, p.image, p.service_id, p.featured, p.active, p.sort, Number(req.params.id));
    if (!info.changes) throw new HttpError(404, 'Produto não encontrado.');
    res.json({ ok: true });
  }));
  r.delete('/products/:id', (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ----- envio de fotos (o navegador reduz a imagem antes; aqui validamos tipo real e tamanho)
  r.post('/upload', express.json({ limit: '6mb' }), wrap((req, res) => {
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
    if (!m) throw new HttpError(400, 'Envie uma imagem PNG, JPG ou WebP.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1024 * 1024) throw new HttpError(400, 'A imagem passa de 4 MB.');
    const type = buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpg'
      : buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? 'png'
      : buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null;
    if (!type) throw new HttpError(400, 'O arquivo não é uma imagem válida.');
    fs.mkdirSync(uploadDir, { recursive: true });
    const name = `${crypto.randomBytes(10).toString('hex')}.${type}`;
    fs.writeFileSync(path.join(uploadDir, name), buf);
    res.status(201).json({ url: `/uploads/${name}` });
  }));

  // ----- pedidos
  r.get('/orders', (req, res) => {
    const st = ORDER_STATUSES.includes(req.query.status) ? req.query.status : null;
    const rows = st
      ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 200').all(st)
      : db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
    res.json(rows.map(present));
  });
  r.patch('/orders/:id', wrap((req, res) => {
    if (!ORDER_STATUSES.includes(req.body.status)) throw new HttpError(400, 'Status inválido.');
    const info = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, Number(req.params.id));
    if (!info.changes) throw new HttpError(404, 'Pedido não encontrado.');
    res.json({ ok: true });
  }));

  // ----- contatos "ligamos para você"
  r.get('/leads', (req, res) => res.json(db.prepare('SELECT * FROM leads ORDER BY status = \'called\', id DESC LIMIT 300').all()));
  r.patch('/leads/:id', wrap((req, res) => {
    if (!['new', 'called'].includes(req.body.status)) throw new HttpError(400, 'Status inválido.');
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(req.body.status, Number(req.params.id));
    res.json({ ok: true });
  }));
  r.delete('/leads/:id', (req, res) => {
    db.prepare('DELETE FROM leads WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });
}

module.exports = { publicLoja, adminLoja };
