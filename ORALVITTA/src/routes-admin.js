const express = require('express');
const { getSettings, transaction } = require('./db');
const S = require('./schedule');
const clock = require('./clock');
const A = require('./appointments');
const auth = require('./auth');
const { HttpError, str, wrap } = require('./util');

const STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];

module.exports = function adminRoutes(db) {
  const r = express.Router();
  const loginLimit = auth.rateLimiter({ windowMs: 900_000, max: 10 });

  // ---------- sessão ----------
  r.post('/login', wrap((req, res) => {
    if (!loginLimit(req.ip)) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    const user = db.prepare('SELECT * FROM admins WHERE username = ?').get(String(req.body.username || '').trim());
    const ok = user && auth.verifyPassword(String(req.body.password || ''), user.password_hash);
    if (!ok) throw new HttpError(401, 'Usuário ou senha incorretos.');
    const { token, maxAge } = auth.createSession(db, user.id);
    auth.setCookie(res, req, token, maxAge);
    res.json({ username: user.username });
  }));

  r.post('/logout', (req, res) => { auth.destroySession(db, req, res); res.json({ ok: true }); });

  r.use(auth.requireAdmin(db));

  r.get('/me', (req, res) => res.json(req.admin));

  r.post('/password', wrap((req, res) => {
    const user = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
    if (!auth.verifyPassword(String(req.body.current || ''), user.password_hash)) throw new HttpError(400, 'Senha atual incorreta.');
    const next = String(req.body.next || '');
    if (next.length < 10) throw new HttpError(400, 'A nova senha deve ter no mínimo 10 caracteres.');
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(auth.hashPassword(next), user.id);
    res.json({ ok: true });
  }));

  // ---------- painel / agenda ----------
  r.get('/dashboard', (req, res) => {
    const now = clock.now();
    const weekEnd = S.addDays(now.date, 6);
    const count = (from, to, st) => db.prepare(
      `SELECT COUNT(*) n FROM appointments WHERE date BETWEEN ? AND ? AND status IN (${st})`).get(from, to).n;
    const active = "'scheduled','confirmed'";
    res.json({
      today: now.date,
      now_min: now.min,
      count_today: count(now.date, now.date, active),
      count_week: count(now.date, weekEnd, active),
      to_confirm: db.prepare("SELECT COUNT(*) n FROM appointments WHERE date >= ? AND status = 'scheduled'").get(now.date).n,
      upcoming: A.listRange(db, now.date, weekEnd).filter(a => ['scheduled', 'confirmed'].includes(a.status)).slice(0, 8),
    });
  });

  r.get('/appointments', wrap((req, res) => {
    const { from, to, status } = req.query;
    if (!S.isValidDate(from) || !S.isValidDate(to)) throw new HttpError(400, 'Período inválido.');
    if (S.daysBetween(from, to) > 93) throw new HttpError(400, 'Período máximo de 93 dias.');
    if (status && !STATUSES.includes(status)) throw new HttpError(400, 'Status inválido.');
    res.json({
      appointments: A.listRange(db, from, to, status),
      blocks: db.prepare('SELECT id, date, start_min, end_min, reason FROM blocks WHERE date BETWEEN ? AND ? ORDER BY date, start_min')
        .all(from, to).map(presentBlock),
    });
  }));

  r.get('/slots', wrap((req, res) => {
    if (!S.isValidDate(req.query.date)) throw new HttpError(400, 'Data inválida.');
    const svc = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(req.query.service));
    if (!svc) throw new HttpError(400, 'Serviço inválido.');
    res.json(S.getDaySlots(db, req.query.date, svc.duration_min, clock.now(), { admin: true }));
  }));

  r.post('/appointments', wrap((req, res) => {
    res.status(201).json(A.createAppointment(db, req.body, clock.now(), { admin: true }));
  }));

  r.patch('/appointments/:id', wrap((req, res) => {
    const id = Number(req.params.id);
    const now = clock.now();
    const out = transaction(db, () => {
      const row = db.prepare(`${A.SELECT} WHERE a.id = ?`).get(id);
      if (!row) throw new HttpError(404, 'Consulta não encontrada.');

      if (req.body.date !== undefined || req.body.time !== undefined) {
        // Remarcar: libera o horário atual dentro da transação e confere o novo (rollback se der conflito).
        const date = req.body.date ?? row.date;
        const start = S.toMin(req.body.time ?? S.toHHMM(row.start_min));
        if (!S.isValidDate(date) || Number.isNaN(start)) throw new HttpError(400, 'Data ou horário inválido.');
        const duration = row.end_min - row.start_min;
        db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
        const check = S.checkSlot(db, date, start, duration, now, { admin: true });
        if (!check.ok) throw new HttpError(409, check.error);
        db.prepare("UPDATE appointments SET date = ?, start_min = ?, end_min = ?, status = ? WHERE id = ?")
          .run(date, start, start + duration, STATUSES.includes(req.body.status) ? req.body.status : row.status === 'cancelled' ? 'confirmed' : row.status, id);
      } else if (req.body.status !== undefined) {
        if (!STATUSES.includes(req.body.status)) throw new HttpError(400, 'Status inválido.');
        if (row.status === 'cancelled' && req.body.status !== 'cancelled') {
          // Reativar uma consulta cancelada exige que o horário ainda esteja livre.
          db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
          const check = S.checkSlot(db, row.date, row.start_min, row.end_min - row.start_min, now, { admin: true });
          if (!check.ok) throw new HttpError(409, 'Não é possível reativar: ' + check.error.toLowerCase());
        }
        db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(req.body.status, id);
      }
      if (req.body.notes !== undefined) {
        db.prepare('UPDATE appointments SET notes = ? WHERE id = ?').run(str(req.body.notes, 500, { label: 'Observações' }), id);
      }
      return A.present(db.prepare(`${A.SELECT} WHERE a.id = ?`).get(id));
    });
    res.json(out);
  }));

  // ---------- bloqueios (dona indisponível) ----------
  function presentBlock(b) {
    return {
      id: b.id, date: b.date, reason: b.reason,
      full_day: b.start_min === 0 && b.end_min === 1440,
      start: S.toHHMM(b.start_min), end: b.end_min === 1440 ? '24:00' : S.toHHMM(b.end_min),
    };
  }

  r.get('/blocks', (req, res) => {
    const from = S.isValidDate(req.query.from) ? req.query.from : clock.now().date;
    res.json(db.prepare('SELECT * FROM blocks WHERE date >= ? ORDER BY date, start_min LIMIT 500').all(from).map(presentBlock));
  });

  r.post('/blocks', wrap((req, res) => {
    const { date, end_date, full_day } = req.body;
    if (!S.isValidDate(date)) throw new HttpError(400, 'Data inválida.');
    const last = end_date ? end_date : date;
    if (!S.isValidDate(last) || last < date) throw new HttpError(400, 'Data final inválida.');
    if (S.daysBetween(date, last) > 120) throw new HttpError(400, 'Período máximo de 120 dias.');
    const reason = str(req.body.reason, 120, { label: 'Motivo' });
    let start = 0, end = 1440;
    if (!full_day) {
      start = S.toMin(req.body.start); end = S.toMin(req.body.end);
      if (Number.isNaN(start) || Number.isNaN(end) || end <= start) throw new HttpError(400, 'Informe um intervalo de horário válido (início antes do fim).');
    }
    const created = [], affected = [];
    transaction(db, () => {
      const ins = db.prepare('INSERT INTO blocks(date, start_min, end_min, reason) VALUES (?,?,?,?)');
      for (let d = date; d <= last; d = S.addDays(d, 1)) {
        // Em bloqueio de vários dias, só cria nos dias em que a clínica abre
        if (last !== date) {
          const h = db.prepare('SELECT open FROM hours WHERE weekday = ?').get(S.weekdayOf(d));
          if (!h || !h.open) continue;
        }
        const info = ins.run(d, start, end, reason);
        created.push(Number(info.lastInsertRowid));
        affected.push(...A.overlappingAppointments(db, d, start, end));
      }
    });
    res.status(201).json({ created: created.length, affected });
  }));

  r.delete('/blocks/:id', (req, res) => {
    db.prepare('DELETE FROM blocks WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- horário de funcionamento ----------
  r.get('/hours', (req, res) => {
    res.json(db.prepare('SELECT * FROM hours ORDER BY weekday').all().map(h => ({
      weekday: h.weekday, open: !!h.open, start: S.toHHMM(h.start_min), end: S.toHHMM(h.end_min),
      break_start: h.break_start_min == null ? '' : S.toHHMM(h.break_start_min),
      break_end: h.break_end_min == null ? '' : S.toHHMM(h.break_end_min),
    })));
  });

  r.put('/hours', wrap((req, res) => {
    const rows = req.body;
    if (!Array.isArray(rows) || rows.length !== 7) throw new HttpError(400, 'Envie os 7 dias da semana.');
    transaction(db, () => {
      const upd = db.prepare('UPDATE hours SET open=?, start_min=?, end_min=?, break_start_min=?, break_end_min=? WHERE weekday=?');
      for (const h of rows) {
        const wd = Number(h.weekday);
        if (!Number.isInteger(wd) || wd < 0 || wd > 6) throw new HttpError(400, 'Dia da semana inválido.');
        const start = S.toMin(h.start), end = S.toMin(h.end);
        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) throw new HttpError(400, 'Horário de funcionamento inválido (o fim deve ser depois do início).');
        let bs = null, be = null;
        if (h.break_start && h.break_end) {
          bs = S.toMin(h.break_start); be = S.toMin(h.break_end);
          if (Number.isNaN(bs) || Number.isNaN(be) || be <= bs || bs < start || be > end) throw new HttpError(400, 'Pausa inválida: deve estar dentro do expediente.');
        }
        upd.run(h.open ? 1 : 0, start, end, bs, be, wd);
      }
    });
    res.json({ ok: true });
  }));

  // ---------- configurações ----------
  const SETTING_RULES = {
    clinic_name: v => str(v, 80, { required: true, label: 'Nome da clínica' }),
    clinic_phone: v => str(v, 30, { required: true, label: 'Telefone' }),
    clinic_whatsapp: v => { const d = String(v).replace(/\D/g, ''); if (d.length < 10 || d.length > 13) throw new HttpError(400, 'WhatsApp inválido.'); return d.length <= 11 ? '55' + d : d; },
    clinic_instagram: v => str(v, 40, { label: 'Instagram' }).replace(/^@/, ''),
    slot_step_min: v => intRange(v, 10, 120, 'Intervalo entre horários'),
    min_advance_min: v => intRange(v, 0, 10080, 'Antecedência mínima'),
    max_days_ahead: v => intRange(v, 1, 365, 'Dias à frente'),
  };
  function intRange(v, min, max, label) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${label} deve ser um número entre ${min} e ${max}.`);
    return String(n);
  }

  r.get('/settings', (req, res) => res.json(getSettings(db)));

  r.put('/settings', wrap((req, res) => {
    transaction(db, () => {
      const upd = db.prepare('INSERT INTO settings(key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      for (const [k, v] of Object.entries(req.body)) {
        if (SETTING_RULES[k]) upd.run(k, SETTING_RULES[k](v));
      }
    });
    res.json(getSettings(db));
  }));

  // ---------- serviços ----------
  const readService = body => {
    const duration = Number(body.duration_min);
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) throw new HttpError(400, 'Duração deve ser entre 5 e 480 minutos.');
    return {
      name: str(body.name, 80, { required: true, label: 'Nome do serviço' }),
      description: str(body.description, 200, { label: 'Descrição' }),
      duration, active: body.active === false ? 0 : 1,
    };
  };

  r.get('/services', (req, res) => {
    res.json(db.prepare('SELECT * FROM services ORDER BY sort, id').all().map(s => ({ ...s, active: !!s.active })));
  });

  r.post('/services', wrap((req, res) => {
    const s = readService(req.body);
    const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 n FROM services').get().n;
    const info = db.prepare('INSERT INTO services(name, description, duration_min, active, sort) VALUES (?,?,?,?,?)')
      .run(s.name, s.description, s.duration, s.active, sort);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  }));

  r.put('/services/:id', wrap((req, res) => {
    const s = readService(req.body);
    const info = db.prepare('UPDATE services SET name=?, description=?, duration_min=?, active=? WHERE id=?')
      .run(s.name, s.description, s.duration, s.active, Number(req.params.id));
    if (!info.changes) throw new HttpError(404, 'Serviço não encontrado.');
    res.json({ ok: true });
  }));

  r.delete('/services/:id', wrap((req, res) => {
    const id = Number(req.params.id);
    const used = db.prepare('SELECT COUNT(*) n FROM appointments WHERE service_id = ?').get(id).n;
    if (used) {
      db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(id);
      return res.json({ ok: true, deactivated: true });
    }
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    res.json({ ok: true, deactivated: false });
  }));

  return r;
};
