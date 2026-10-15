const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.FAKE_NOW = '2026-10-13T09:00';
process.env.BOOK_RATE_MAX = '1000';
process.env.ADMIN_PASSWORD = 'senha-de-teste-123';
const { open } = require('../src/db');
const { ensureAdmin } = require('../src/auth');
const { createApp } = require('../server');
const { loadBrand } = require('../src/brand');

let server, base, cookie, uploadDir;

test.before(async () => {
  const brand = loadBrand('paraiso-das-mensagens');
  const db = open(':memory:', brand);
  ensureAdmin(db);
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  server = createApp(db, brand, { uploadDir }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); fs.rmSync(uploadDir, { recursive: true, force: true }); });

async function api(method, p, body, { admin = false } = {}) {
  const res = await fetch(base + p, {
    method, headers: { 'Content-Type': 'application/json', ...(admin && cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})), res };
}
const order = (over = {}) => ({
  name: 'Maria Souza', phone: '(85) 99999-1111', address: 'Rua das Flores, 10, Aldeota', consent: true,
  items: [{ id: 1, qty: 2 }], ...over,
});

test('info da loja: vocabulário, contatos e sem campo de convênio', async () => {
  const { json } = await api('GET', '/api/public/info');
  assert.equal(json.vertical, 'loja');
  assert.equal(json.vocab.appt, 'homenagem');
  assert.equal(json.ask_insurance, false);
  assert.equal(json.clinic.whatsapp, '5585994339478');
  assert.equal(json.clinic.whatsapp2, '5585999860751');
  assert.match(json.clinic.address, /Vital Brasil/);
  assert.equal(json.hours[0].start, '07:00'); // domingo abre às 7h
  assert.equal(json.hours[1].start, '06:00');
});

test('páginas da loja renderizam sem marcadores pendentes', async () => {
  for (const p of ['/', '/catalogo', '/pedido', '/agendar', '/consulta', '/admin']) {
    const res = await fetch(base + p); const html = await res.text();
    assert.equal(res.status, 200, p);
    assert.ok(!html.includes('{{'), `${p} com marcador pendente`);
  }
  const home = await (await fetch(base + '/')).text();
  assert.match(home, /Paraíso/);
  const visible = home.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!/clínica|consulta/i.test(visible), 'texto visível da loja não deve falar em clínica/consulta');
  assert.equal((await fetch(base + '/theme.css')).status, 200);
});

test('catálogo público: categorias, produtos e homenagens agendáveis', async () => {
  const { json } = await api('GET', '/api/public/catalog');
  assert.equal(json.categories.length, 5);
  const hom = json.categories.find(c => c.slug === 'homenagens');
  assert.ok(hom.products.filter(p => p.service_id).length >= 8);
  assert.ok(hom.products.some(p => p.name === 'Kits Personalizados' && !p.service_id));
});

test('pedido: validações e criação', async () => {
  assert.equal((await api('POST', '/api/public/orders', order({ consent: false }))).status, 400);
  assert.equal((await api('POST', '/api/public/orders', order({ phone: '123' }))).status, 400);
  assert.equal((await api('POST', '/api/public/orders', order({ address: '' }))).status, 400);
  assert.equal((await api('POST', '/api/public/orders', order({ items: [] }))).status, 400);
  assert.equal((await api('POST', '/api/public/orders', order({ items: [{ id: 99999, qty: 1 }] }))).status, 400);
  assert.equal((await api('POST', '/api/public/orders', order({ items: [{ id: 1, qty: 0 }] }))).status, 400);
  assert.equal((await api('POST', '/api/public/orders', order({ items: [{ id: 1, qty: 500 }] }))).status, 400);
  assert.equal((await api('POST', '/api/public/orders', order({ delivery_date: '2026-10-01' }))).status, 400); // passado
  const ok = await api('POST', '/api/public/orders', order({ delivery_date: '2026-10-20', delivery_time: '10:30', card_message: 'Parabéns!' }));
  assert.equal(ok.status, 201);
  assert.match(ok.json.code, /^[A-Z2-9]{6}$/);
  assert.equal(ok.json.total_cents, null);       // produtos sob consulta
  assert.equal(ok.json.items[0].name, 'Rosas');
});

test('painel exige login (loja)', async () => {
  for (const p of ['/api/admin/orders', '/api/admin/products', '/api/admin/leads', '/api/admin/loja/summary'])
    assert.equal((await api('GET', p)).status, 401, p);
  assert.equal((await api('POST', '/api/admin/upload', { image: 'x' })).status, 401);
  const r = await api('POST', '/api/admin/login', { username: 'admin', password: 'senha-de-teste-123' });
  cookie = r.res.headers.get('set-cookie').split(';')[0];
});

test('painel: produto com preço, total estimado no pedido e status', async () => {
  const cat = (await api('GET', '/api/admin/categories', null, { admin: true })).json[0];
  const bad = await api('POST', '/api/admin/products', { category_id: cat.id, name: 'Buquê', price_mode: 'fixed', price: 'abc' }, { admin: true });
  assert.equal(bad.status, 400);
  const created = await api('POST', '/api/admin/products', { category_id: cat.id, name: 'Buquê Teste', price_mode: 'fixed', price: '89,90', featured: true }, { admin: true });
  assert.equal(created.status, 201);
  const id = created.json.id;
  const cat2 = (await api('GET', '/api/public/catalog')).json.categories.flatMap(c => c.products).find(p => p.id === id);
  assert.equal(cat2.price_cents, 8990);
  const o = await api('POST', '/api/public/orders', order({ items: [{ id, qty: 2 }] }));
  assert.equal(o.json.total_cents, 17980);
  const list = (await api('GET', '/api/admin/orders', null, { admin: true })).json;
  const mine = list.find(x => x.code === o.json.code);
  assert.equal(mine.status, 'new');
  assert.equal((await api('PATCH', `/api/admin/orders/${mine.id}`, { status: 'confirmed' }, { admin: true })).status, 200);
  assert.equal((await api('PATCH', `/api/admin/orders/${mine.id}`, { status: 'xx' }, { admin: true })).status, 400);
  const s = (await api('GET', '/api/admin/loja/summary', null, { admin: true })).json;
  assert.ok(s.orders_new >= 1 && s.recent_orders.length > 0);
  // produto oculto some do site
  await api('PUT', `/api/admin/products/${id}`, { category_id: cat.id, name: 'Buquê Teste', price_mode: 'fixed', price: '89,90', active: false }, { admin: true });
  const after = (await api('GET', '/api/public/catalog')).json.categories.flatMap(c => c.products);
  assert.ok(!after.some(p => p.id === id));
  assert.equal((await api('POST', '/api/public/orders', order({ items: [{ id, qty: 1 }] }))).status, 400);
});

test('categoria com produtos não pode ser excluída; imagem só de origem permitida', async () => {
  const cat = (await api('GET', '/api/admin/categories', null, { admin: true })).json[0];
  assert.equal((await api('DELETE', `/api/admin/categories/${cat.id}`, null, { admin: true })).status, 409);
  const evil = await api('POST', '/api/admin/categories', { name: 'X', image: 'https://evil.example/a.png' }, { admin: true });
  assert.equal(evil.status, 400);
  const ok = await api('POST', '/api/admin/categories', { name: 'Temporada de Natal', description: 'Teste' }, { admin: true });
  assert.equal(ok.status, 201);
  assert.equal((await api('DELETE', `/api/admin/categories/${ok.json.id}`, null, { admin: true })).status, 200);
});

test('envio de foto: só imagem real, guardada e servida; nada fora da pasta', async () => {
  assert.equal((await api('POST', '/api/admin/upload', { image: 'data:image/png;base64,AAAA' }, { admin: true })).status, 400); // não é PNG de verdade
  assert.equal((await api('POST', '/api/admin/upload', { image: 'data:text/html;base64,PGI+' }, { admin: true })).status, 400);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]).toString('base64');
  const up = await api('POST', '/api/admin/upload', { image: `data:image/png;base64,${png}` }, { admin: true });
  assert.equal(up.status, 201);
  assert.match(up.json.url, /^\/uploads\/[a-f0-9]{20}\.png$/);
  const got = await fetch(base + up.json.url);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(base + '/uploads/..%2Fpackage.json')).status, 404);
  // produto aceita a foto enviada
  const cat = (await api('GET', '/api/admin/categories', null, { admin: true })).json[0];
  const p = await api('POST', '/api/admin/products', { category_id: cat.id, name: 'Com foto', image: up.json.url }, { admin: true });
  assert.equal(p.status, 201);
  // limite de tamanho (> 4 MB)
  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(4.5 * 1024 * 1024)]).toString('base64');
  assert.equal((await api('POST', '/api/admin/upload', { image: `data:image/jpeg;base64,${big}` }, { admin: true })).status, 400);
});

test('"ligamos para você": cria, não duplica e painel marca como ligado', async () => {
  assert.equal((await api('POST', '/api/public/leads', { name: 'João', phone: '12' })).status, 400);
  assert.equal((await api('POST', '/api/public/leads', { name: 'João', phone: '(85) 98888-7777' })).status, 201);
  assert.equal((await api('POST', '/api/public/leads', { name: 'João', phone: '85988887777' })).status, 201);
  const leads = (await api('GET', '/api/admin/leads', null, { admin: true })).json;
  assert.equal(leads.filter(l => l.phone === '85988887777').length, 1);
  assert.equal((await api('PATCH', `/api/admin/leads/${leads[0].id}`, { status: 'called' }, { admin: true })).status, 200);
});

test('homenagem: agenda sem convênio e sem conflito; serviço pré-selecionável', async () => {
  const hom = (await api('GET', '/api/public/catalog')).json.categories.find(c => c.slug === 'homenagens').products.find(p => p.service_id);
  const body = { service_id: hom.service_id, date: '2026-10-14', time: '10:00', name: 'Carlos', phone: '85977776666', consent: true, notes: 'Rua A, 100. Para Ana.' };
  const a = await api('POST', '/api/public/appointments', body);
  assert.equal(a.status, 201);
  assert.equal(a.json.insurance, 'Particular');
  assert.equal((await api('POST', '/api/public/appointments', { ...body, name: 'Outro', phone: '85966665555' })).status, 409);
  // domingo abre às 7h: 06:30 é recusado, 07:00 é aceito
  const sun = { ...body, date: '2026-10-18', phone: '85955554444' };
  assert.equal((await api('POST', '/api/public/appointments', { ...sun, time: '06:30' })).status, 409);
  assert.equal((await api('POST', '/api/public/appointments', { ...sun, time: '07:00' })).status, 201);
});
