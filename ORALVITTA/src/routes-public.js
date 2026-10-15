const express = require('express');
const { getSettings } = require('./db');
const S = require('./schedule');
const clock = require('./clock');
const A = require('./appointments');
const { HttpError, normalizePhone, wrap } = require('./util');
const { rateLimiter } = require('./auth');

module.exports = function publicRoutes(db, brand) {
  const r = express.Router();
  const bookLimit = rateLimiter({ windowMs: 3600_000, max: Number(process.env.BOOK_RATE_MAX) || 10 });
  const lookupLimit = rateLimiter({ windowMs: 900_000, max: 20 });

  const activeService = id => {
    const s = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(id));
    if (!s) throw new HttpError(400, 'Serviço inválido.');
    return s;
  };

  r.get('/info', (req, res) => {
    const st = getSettings(db);
    res.json({
      vertical: brand.vertical,
      vocab: brand.vocab,
      ask_insurance: brand.askInsurance !== false,
      booking: { notes_label: brand.copy.bookingNotesLabel || 'Observações', notes_hint: brand.copy.bookingNotesHint || '' },
      clinic: {
        name: st.clinic_name, phone: st.clinic_phone,
        whatsapp: st.clinic_whatsapp, instagram: st.clinic_instagram, address: st.clinic_address || '', whatsapp2: st.clinic_whatsapp2 || '', email: st.clinic_email || '',
      },
      show_insurances: !!brand.showInsurances,
      about: brand.about || null,
      gallery: brand.gallery,
      services: db.prepare('SELECT id, name, description, duration_min FROM services WHERE active = 1 ORDER BY sort, id').all(),
      hours: db.prepare('SELECT weekday, open, start_min, end_min, break_start_min, break_end_min FROM hours ORDER BY weekday')
        .all().map(h => ({
          weekday: h.weekday, open: !!h.open,
          start: S.toHHMM(h.start_min), end: S.toHHMM(h.end_min),
          break_start: h.break_start_min == null ? null : S.toHHMM(h.break_start_min),
          break_end: h.break_end_min == null ? null : S.toHHMM(h.break_end_min),
        })),
      insurances: brand.insurances,
      max_days_ahead: Number(st.max_days_ahead),
      today: clock.now().date,
    });
  });

  r.get('/month', wrap((req, res) => {
    const month = String(req.query.month || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'Mês inválido.');
    const service = activeService(req.query.service);
    res.json({ month, days: S.getMonthOverview(db, month, service.duration_min, clock.now()) });
  }));

  r.get('/slots', wrap((req, res) => {
    if (!S.isValidDate(req.query.date)) throw new HttpError(400, 'Data inválida.');
    const service = activeService(req.query.service);
    res.json(S.getDaySlots(db, req.query.date, service.duration_min, clock.now()));
  }));

  r.post('/appointments', wrap((req, res) => {
    if (!bookLimit(req.ip)) throw new HttpError(429, 'Muitas tentativas. Tente novamente mais tarde.');
    if (req.body.consent !== true) throw new HttpError(400, 'É necessário concordar com o uso dos dados para agendar.');
    const appt = A.createAppointment(db, req.body, clock.now(), { insurances: brand.insurances });
    res.status(201).json(appt);
  }));

  // Acompanhamento: o paciente precisa do código + telefone cadastrado.
  const findOwn = req => {
    if (!lookupLimit(req.ip)) throw new HttpError(429, 'Muitas tentativas. Tente novamente em alguns minutos.');
    const row = A.getByCode(db, req.body.code);
    const phone = normalizePhone(req.body.phone);
    if (!row || !phone || row.phone !== phone) throw new HttpError(404, 'Consulta não encontrada. Confira o código e o telefone.');
    return row;
  };

  r.post('/lookup', wrap((req, res) => {
    const row = findOwn(req);
    const { email, notes, source, id, ...safe } = A.present(row);
    res.json(safe);
  }));

  r.post('/cancel', wrap((req, res) => {
    const row = findOwn(req);
    const now = clock.now();
    if (!['scheduled', 'confirmed'].includes(row.status)) throw new HttpError(409, 'Esta consulta não pode mais ser cancelada.');
    if (row.date < now.date || (row.date === now.date && row.start_min <= now.min)) {
      throw new HttpError(409, 'Esta consulta já começou ou passou.');
    }
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(row.id);
    const { email, notes, source, id, ...safe } = A.present({ ...row, status: 'cancelled' });
    res.json(safe);
  }));

  if (brand.vertical === 'loja') r.use(require('./routes-loja').publicLoja(db, brand));

  return r;
};
