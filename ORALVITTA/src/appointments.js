const { transaction, getSettings } = require('./db');
const S = require('./schedule');
const { HttpError, normalizePhone, isEmail, newCode, str } = require('./util');
const { readDetails } = require('./purchase');

function present(row) {
  return {
    id: row.id,
    code: row.code,
    service_id: row.service_id,
    service: row.service_name,
    date: row.date,
    time: S.toHHMM(row.start_min),
    end_time: S.toHHMM(row.end_min),
    status: row.status,
    name: row.name,
    phone: row.phone,
    email: row.email,
    insurance: row.insurance,
    notes: row.notes,
    source: row.source,
    details: JSON.parse(row.details || '{}'),
    created_at: row.created_at,
  };
}

const SELECT = `SELECT a.*, s.name AS service_name FROM appointments a JOIN services s ON s.id = a.service_id`;

function getByCode(db, code) {
  return db.prepare(`${SELECT} WHERE a.code = ?`).get(String(code || '').toUpperCase().trim());
}

/**
 * Cria uma consulta garantindo, dentro de uma transação exclusiva, que o horário continua livre.
 * É a ÚNICA porta de entrada para gravar consultas (site e painel usam a mesma).
 */
function createAppointment(db, input, now, { admin = false, insurances, fields = [] } = {}) {
  const name = str(input.name, 100, { required: true, label: 'Nome' });
  const phone = normalizePhone(input.phone);
  if (!phone) throw new HttpError(400, 'Informe um telefone válido com DDD.');
  const email = str(input.email, 254, { label: 'E-mail' });
  if (email && !isEmail(email)) throw new HttpError(400, 'E-mail inválido.');
  const notes = str(input.notes, 500, { label: 'Observações' });
  const insurance = str(input.insurance || 'Particular', 60, { label: 'Convênio' }) || 'Particular';
  if (!insurances.includes(insurance)) throw new HttpError(400, 'Convênio inválido.');
  if (!S.isValidDate(input.date)) throw new HttpError(400, 'Data inválida.');
  const start = S.toMin(input.time);
  if (Number.isNaN(start)) throw new HttpError(400, 'Horário inválido.');
  const serviceId = Number(input.service_id);
  const details = readDetails(fields, input, { required: !admin });

  return transaction(db, () => {
    const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(serviceId);
    if (!service) throw new HttpError(400, 'Serviço inválido.');

    if (!admin) {
      const pending = db.prepare(
        `SELECT COUNT(*) n FROM appointments WHERE phone = ? AND date >= ?
         AND status IN ('scheduled','confirmed')`).get(phone, now.date).n;
      if (pending >= 3) {
        throw new HttpError(429, 'Este telefone já possui 3 consultas futuras. Cancele uma antes de marcar outra ou fale conosco.');
      }
    }

    const check = S.checkSlot(db, input.date, start, service.duration_min, now, { admin });
    if (!check.ok) throw new HttpError(409, check.error);

    let code;
    for (let i = 0; i < 10; i++) {
      code = newCode();
      if (!getByCode(db, code)) break;
    }
    const info = db.prepare(
      `INSERT INTO appointments(code, service_id, date, start_min, end_min, name, phone, email, insurance, notes, status, source, details)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      code, service.id, input.date, start, start + service.duration_min,
      name, phone, email, insurance, notes, admin ? 'confirmed' : 'scheduled', admin ? 'admin' : 'site', JSON.stringify(details));
    return present(db.prepare(`${SELECT} WHERE a.id = ?`).get(Number(info.lastInsertRowid)));
  });
}

function listRange(db, from, to, status) {
  const rows = status
    ? db.prepare(`${SELECT} WHERE a.date BETWEEN ? AND ? AND a.status = ? ORDER BY a.date, a.start_min`).all(from, to, status)
    : db.prepare(`${SELECT} WHERE a.date BETWEEN ? AND ? ORDER BY a.date, a.start_min`).all(from, to);
  return rows.map(present);
}

function overlappingAppointments(db, date, startMin, endMin) {
  return db.prepare(
    `${SELECT} WHERE a.date = ? AND a.status IN ('scheduled','confirmed')
     AND a.start_min < ? AND ? < a.end_min ORDER BY a.start_min`).all(date, endMin, startMin).map(present);
}

module.exports = { present, getByCode, createAppointment, listRange, overlappingAppointments, SELECT };
