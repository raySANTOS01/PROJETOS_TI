const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function open(file, brand) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );
    -- weekday: 0 = domingo ... 6 = sábado. Horários em minutos desde 00:00.
    CREATE TABLE IF NOT EXISTS hours (
      weekday INTEGER PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
      open INTEGER NOT NULL DEFAULT 0,
      start_min INTEGER NOT NULL DEFAULT 510,
      end_min INTEGER NOT NULL DEFAULT 1050,
      break_start_min INTEGER,
      break_end_min INTEGER
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration_min INTEGER NOT NULL CHECK (duration_min BETWEEN 5 AND 480),
      active INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0
    );
    -- Bloqueios criados pela dona (doença, folga, curso...). Dia inteiro = 0..1440.
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      end_min INTEGER NOT NULL CHECK (end_min > start_min),
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks(date);
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      date TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      end_min INTEGER NOT NULL CHECK (end_min > start_min),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      insurance TEXT NOT NULL DEFAULT 'Particular',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
      source TEXT NOT NULL DEFAULT 'site',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(date, status);
    CREATE INDEX IF NOT EXISTS idx_appt_phone ON appointments(phone);
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);
  seed(db, brand);
  return db;
}

function seed(db, brand) {
  const c = brand.clinic;
  const defaults = {
    clinic_name: brand.fullName,
    clinic_phone: c.phone,
    clinic_whatsapp: c.whatsapp,
    clinic_instagram: c.instagram,
    clinic_address: c.address || '',
    slot_step_min: '30',        // intervalo entre horários oferecidos
    min_advance_min: '120',     // antecedência mínima para agendar pelo site
    max_days_ahead: '60',       // até quantos dias à frente o site aceita agendamentos
  };
  const insSetting = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)');
  for (const [k, v] of Object.entries(defaults)) insSetting.run(k, v);

  const nHours = db.prepare('SELECT COUNT(*) n FROM hours').get().n;
  if (nHours === 0) {
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const ins = db.prepare('INSERT INTO hours(weekday, open, start_min, end_min) VALUES (?,?,?,?)');
    for (let d = 0; d <= 6; d++) {
      const range = d === 0 ? brand.hours.sunday : d === 6 ? brand.hours.saturday : brand.hours.weekdays;
      if (range) ins.run(d, 1, toMin(range[0]), toMin(range[1]));
      else ins.run(d, 0, 510, 1050);
    }
  }

  const nServices = db.prepare('SELECT COUNT(*) n FROM services').get().n;
  if (nServices === 0) {
    const ins = db.prepare('INSERT INTO services(name, description, duration_min, sort) VALUES (?,?,?,?)');
    brand.services.forEach(([n, d, m], i) => ins.run(n, d, m, i));
  }
}

function getSettings(db) {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

// Executa fn dentro de uma transação exclusiva: ninguém mais escreve enquanto
// verificamos o conflito e gravamos, então dois pacientes nunca pegam o mesmo horário.
function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { open, getSettings, transaction };
