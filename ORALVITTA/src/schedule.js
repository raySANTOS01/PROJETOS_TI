// Regras de agenda: horários livres, ocupados, bloqueados e verificação de conflito.
const { getSettings } = require('./db');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function weekdayOf(date) {
  return new Date(date + 'T12:00:00Z').getUTCDay();
}

function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}

function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
  if (!m) return NaN;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return NaN;
  return h * 60 + mi;
}

function toHHMM(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

// Tudo que ocupa a agenda de um dia: consultas não canceladas, bloqueios e a pausa (almoço).
function dayBusy(db, date, hoursRow) {
  const busy = [];
  for (const a of db.prepare(
    "SELECT start_min, end_min FROM appointments WHERE date = ? AND status != 'cancelled'").all(date)) {
    busy.push({ start: a.start_min, end: a.end_min, kind: 'busy' });
  }
  for (const b of db.prepare('SELECT start_min, end_min FROM blocks WHERE date = ?').all(date)) {
    busy.push({ start: b.start_min, end: b.end_min, kind: 'blocked' });
  }
  if (hoursRow && hoursRow.break_start_min != null && hoursRow.break_end_min != null) {
    busy.push({ start: hoursRow.break_start_min, end: hoursRow.break_end_min, kind: 'blocked' });
  }
  return busy;
}

/**
 * Lista os horários do dia para um serviço de `duration` minutos.
 * status: 'free' | 'busy' (já tem consulta) | 'blocked' (indisponível) | 'past' (já passou / antecedência mínima)
 * `admin: true` ignora a antecedência mínima e o limite de dias à frente (a dona pode marcar de última hora).
 */
function getDaySlots(db, date, duration, now, { admin = false } = {}) {
  const settings = getSettings(db);
  const step = Number(settings.slot_step_min) || 30;
  const minAdvance = admin ? 0 : Number(settings.min_advance_min) || 0;
  const maxAhead = Number(settings.max_days_ahead) || 60;

  const hoursRow = db.prepare('SELECT * FROM hours WHERE weekday = ?').get(weekdayOf(date));
  const result = { date, open: !!(hoursRow && hoursRow.open), slots: [] };
  if (!result.open) return result;

  const tooFar = !admin && daysBetween(now.date, date) > maxAhead;
  const inPast = date < now.date;
  const busy = dayBusy(db, date, hoursRow);

  for (let t = hoursRow.start_min; t + duration <= hoursRow.end_min; t += step) {
    const end = t + duration;
    let status = 'free';
    if (inPast || tooFar || (date === now.date && t < now.min + minAdvance)) {
      status = 'past';
    } else {
      for (const b of busy) {
        if (overlaps(t, end, b.start, b.end)) {
          // "busy" tem prioridade sobre "blocked" para mostrar ao paciente que o horário foi tomado
          if (b.kind === 'busy') { status = 'busy'; break; }
          status = 'blocked';
        }
      }
    }
    result.slots.push({ time: toHHMM(t), status });
  }
  return result;
}

/**
 * Verificação definitiva usada ao gravar uma consulta. Deve ser chamada dentro de uma transação.
 * Retorna { ok: true } ou { ok: false, error }.
 */
function checkSlot(db, date, startMin, duration, now, opts = {}) {
  const day = getDaySlots(db, date, duration, now, opts);
  if (!day.open) return { ok: false, error: 'A clínica não atende neste dia.' };
  const slot = day.slots.find(s => s.time === toHHMM(startMin));
  if (!slot) return { ok: false, error: 'Horário fora do expediente.' };
  if (slot.status === 'past') return { ok: false, error: 'Este horário não está mais disponível para agendamento.' };
  if (slot.status === 'busy') return { ok: false, error: 'Este horário acabou de ser ocupado. Escolha outro, por favor.' };
  if (slot.status === 'blocked') return { ok: false, error: 'Horário indisponível.' };
  return { ok: true };
}

/** Resumo do mês para colorir o calendário: closed | past | full | unavailable | available */
function getMonthOverview(db, month, duration, now) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const day = getDaySlots(db, date, duration, now);
    let status;
    if (!day.open) status = 'closed';
    else {
      const free = day.slots.filter(s => s.status === 'free').length;
      if (free > 0) status = 'available';
      else if (day.slots.some(s => s.status === 'busy')) status = 'full';
      else if (day.slots.some(s => s.status === 'blocked')) status = 'unavailable';
      else status = 'past';
    }
    out.push({ date, status, free: day.slots.filter(s => s.status === 'free').length });
  }
  return out;
}

module.exports = {
  isValidDate, weekdayOf, addDays, daysBetween, toMin, toHHMM, overlaps,
  getDaySlots, checkSlot, getMonthOverview,
};
