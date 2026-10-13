const test = require('node:test');
const assert = require('node:assert/strict');

process.env.FAKE_NOW = '2026-10-13T09:00'; // terça-feira
process.env.BOOK_RATE_MAX = '1000';
const { open } = require('../src/db');
const { ensureAdmin } = require('../src/auth');
const { createApp } = require('../server');

let server, base, cookie;

test.before(async () => {
  process.env.ADMIN_PASSWORD = 'senha-de-teste-123';
  const db = open(':memory:');
  ensureAdmin(db);
  server = createApp(db).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

async function api(method, path, body, { admin = false } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(admin && cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, res };
}

const booking = (over = {}) => ({
  service_id: 6, date: '2026-10-14', time: '10:00', name: 'Maria Souza', phone: '(85) 99999-1111',
  insurance: 'Particular', consent: true, ...over,
});

test('lista serviços e horários', async () => {
  const { json } = await api('GET', '/api/public/info');
  assert.equal(json.services.length, 11);
  assert.equal(json.hours[0].open, false);       // domingo fechado
  assert.equal(json.hours[6].end, '12:00');      // sábado até 12h
});

test('slots: seg-sex 8h30, domingo fechado, passado indisponível', async () => {
  let r = (await api('GET', '/api/public/slots?date=2026-10-14&service=6')).json;
  assert.equal(r.slots[0].time, '08:30');
  assert.equal(r.slots.at(-1).time, '17:00');
  assert.ok(r.slots.every(s => s.status === 'free'));
  r = (await api('GET', '/api/public/slots?date=2026-10-18&service=6')).json; // domingo
  assert.equal(r.open, false);
  r = (await api('GET', '/api/public/slots?date=2026-10-13&service=6')).json; // hoje 09:00, antecedência 2h
  assert.equal(r.slots.find(s => s.time === '10:30').status, 'past');
  assert.equal(r.slots.find(s => s.time === '11:30').status, 'free');
});

test('agendamento ocupa o horário e o segundo paciente recebe conflito', async () => {
  const a = await api('POST', '/api/public/appointments', booking());
  assert.equal(a.status, 201);
  assert.match(a.json.code, /^[A-Z2-9]{6}$/);

  const b = await api('POST', '/api/public/appointments', booking({ name: 'João', phone: '85988880000' }));
  assert.equal(b.status, 409);

  const slots = (await api('GET', '/api/public/slots?date=2026-10-14&service=6')).json.slots;
  assert.equal(slots.find(s => s.time === '10:00').status, 'busy');
  assert.equal(slots.find(s => s.time === '10:30').status, 'free');
});

test('serviço longo não pode invadir consulta seguinte (sobreposição parcial)', async () => {
  // canal (id 7) = 90 min. Consulta às 10:00 de 30min já existe. 09:30+90 = 11:00 invade.
  const r = await api('POST', '/api/public/appointments', booking({ service_id: 7, time: '09:30', phone: '85977770000' }));
  assert.equal(r.status, 409);
  const ok = await api('POST', '/api/public/appointments', booking({ service_id: 7, time: '10:30', phone: '85977770000' }));
  assert.equal(ok.status, 201);
});

test('50 requisições simultâneas pelo mesmo horário: só uma vence', async () => {
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) =>
    api('POST', '/api/public/appointments', booking({ date: '2026-10-15', time: '14:00', name: 'P' + i, phone: '8599' + String(1000000 + i) }))));
  // o limitador de IP (10/h) também pode barrar; o essencial é que NUNCA haja mais de 1 sucesso
  assert.equal(results.filter(r => r.status === 201).length, 1);
});

test('validações do paciente', async () => {
  assert.equal((await api('POST', '/api/public/appointments', booking({ consent: false }))).status, 400);
  assert.equal((await api('POST', '/api/public/appointments', booking({ phone: '123' }))).status, 400);
  assert.equal((await api('POST', '/api/public/appointments', booking({ date: '2026-10-18' }))).status, 409); // domingo
  assert.equal((await api('POST', '/api/public/appointments', booking({ date: '2026-10-12' }))).status, 409); // passado
  assert.equal((await api('POST', '/api/public/appointments', booking({ time: '07:00' }))).status, 409);
});

test('admin exige login; login errado falha', async () => {
  assert.equal((await api('GET', '/api/admin/appointments?from=2026-10-01&to=2026-10-31')).status, 401);
  assert.equal((await api('POST', '/api/admin/login', { username: 'admin', password: 'errada' })).status, 401);
  const r = await api('POST', '/api/admin/login', { username: 'admin', password: 'senha-de-teste-123' });
  assert.equal(r.status, 200);
  cookie = r.res.headers.get('set-cookie').split(';')[0];
  assert.match(r.res.headers.get('set-cookie'), /HttpOnly/);
});

test('bloqueio da dona: horário vira indisponível e avisa consultas afetadas', async () => {
  // 14/10 tem consulta às 10:00 e 10:30-12:00
  const r = await api('POST', '/api/admin/blocks',
    { date: '2026-10-14', start: '09:30', end: '10:30', reason: 'Consulta médica' }, { admin: true });
  assert.equal(r.status, 201);
  assert.equal(r.json.affected.length, 1);

  const slots = (await api('GET', '/api/public/slots?date=2026-10-14&service=6')).json.slots;
  assert.equal(slots.find(s => s.time === '09:30').status, 'blocked');
  assert.equal(slots.find(s => s.time === '09:00').status, 'free');
  const p = await api('POST', '/api/public/appointments', booking({ time: '09:30', phone: '85966660000' }));
  assert.equal(p.status, 409);
});

test('bloqueio de dia inteiro e de vários dias (pula domingo)', async () => {
  const r = await api('POST', '/api/admin/blocks',
    { date: '2026-10-19', end_date: '2026-10-25', full_day: true, reason: 'Doente' }, { admin: true });
  assert.equal(r.json.created, 6); // seg..sáb
  const m = (await api('GET', '/api/public/month?month=2026-10&service=6')).json.days;
  assert.equal(m.find(d => d.date === '2026-10-20').status, 'unavailable');
  assert.equal(m.find(d => d.date === '2026-10-18').status, 'closed');
  assert.equal(m.find(d => d.date === '2026-10-14').status, 'available');
  assert.equal(m.find(d => d.date === '2026-10-05').status, 'past');
});

test('paciente acompanha e cancela com código + telefone; horário volta a ficar livre', async () => {
  const a = await api('POST', '/api/public/appointments', booking({ date: '2026-10-16', time: '09:00', phone: '85955550000' }));
  assert.equal(a.status, 201);
  const bad = await api('POST', '/api/public/lookup', { code: a.json.code, phone: '85911112222' });
  assert.equal(bad.status, 404);
  const ok = await api('POST', '/api/public/lookup', { code: a.json.code.toLowerCase(), phone: '(85) 95555-0000' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.status, 'scheduled');
  assert.equal(ok.json.email, undefined);
  const c = await api('POST', '/api/public/cancel', { code: a.json.code, phone: '85955550000' });
  assert.equal(c.json.status, 'cancelled');
  const again = await api('POST', '/api/public/appointments', booking({ date: '2026-10-16', time: '09:00', phone: '85944440000' }));
  assert.equal(again.status, 201);
});

test('admin: marca manual, remarca sem conflito, e impede remarcar para horário ocupado', async () => {
  const m = await api('POST', '/api/admin/appointments',
    { ...booking({ date: '2026-10-16', time: '15:00', phone: '85933330000' }), consent: undefined }, { admin: true });
  assert.equal(m.status, 201);
  assert.equal(m.json.status, 'confirmed');
  const conflict = await api('PATCH', `/api/admin/appointments/${m.json.id}`, { time: '09:00' }, { admin: true });
  assert.equal(conflict.status, 409);
  const still = await api('GET', '/api/admin/appointments?from=2026-10-16&to=2026-10-16', null, { admin: true });
  assert.equal(still.json.appointments.find(a => a.id === m.json.id).time, '15:00'); // rollback preservou
  assert.equal(still.json.appointments.find(a => a.id === m.json.id).status, 'confirmed');
  const moved = await api('PATCH', `/api/admin/appointments/${m.json.id}`, { time: '16:00' }, { admin: true });
  assert.equal(moved.status, 200);
  assert.equal(moved.json.time, '16:00');
});

test('admin: altera horário de funcionamento e serviços', async () => {
  const hours = (await api('GET', '/api/admin/hours', null, { admin: true })).json;
  hours[3].end = '15:00'; // quarta fecha às 15h
  hours[3].break_start = '12:00'; hours[3].break_end = '13:00';
  assert.equal((await api('PUT', '/api/admin/hours', hours, { admin: true })).status, 200);
  const slots = (await api('GET', '/api/public/slots?date=2026-10-21&service=6')).json.slots;
  assert.equal(slots.at(-1).time, '14:30');
  assert.equal(slots.find(s => s.time === '12:00').status, 'blocked');
  hours[3].end = '08:00';
  assert.equal((await api('PUT', '/api/admin/hours', hours, { admin: true })).status, 400);

  const s = await api('POST', '/api/admin/services', { name: 'Limpeza', duration_min: 45, description: '' }, { admin: true });
  assert.equal(s.status, 201);
  const info = (await api('GET', '/api/public/info')).json;
  assert.ok(info.services.some(x => x.name === 'Limpeza'));
});

test('entradas maliciosas são tratadas como texto', async () => {
  const r = await api('POST', '/api/public/appointments',
    booking({ date: '2026-10-29', time: '09:00', name: '<img src=x onerror=alert(1)>', phone: '85922220000' }));
  assert.equal(r.status, 201);
  assert.equal(r.json.name, '<img src=x onerror=alert(1)>'); // armazenado literal; o front usa textContent
  assert.equal((await api('GET', "/api/public/slots?date=2026-10-29';DROP TABLE x&service=6")).status, 400);
});
