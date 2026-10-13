const crypto = require('node:crypto');

const COOKIE = 'ov_session';
const SESSION_HOURS = 12;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha = t => crypto.createHash('sha256').update(t).digest('hex');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createSession(db, adminId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions(token_hash, admin_id, expires_at) VALUES (?,?,?)').run(sha(token), adminId, expires);
  return { token, maxAge: SESSION_HOURS * 3600 };
}

function setCookie(res, req, token, maxAge) {
  const parts = [`${COOKIE}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAge}`];
  if (req.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function destroySession(db, req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
  setCookie(res, req, '', 0);
}

function requireAdmin(db) {
  return (req, res, next) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) {
      const row = db.prepare(
        `SELECT a.id, a.username FROM sessions s JOIN admins a ON a.id = s.admin_id
         WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha(token), Date.now());
      if (row) { req.admin = row; return next(); }
    }
    res.status(401).json({ error: 'Não autenticado.' });
  };
}

// Primeira execução: cria o usuário "admin". A senha vem de ADMIN_PASSWORD ou é gerada e mostrada uma única vez.
function ensureAdmin(db) {
  if (db.prepare('SELECT COUNT(*) n FROM admins').get().n > 0) return null;
  const password = process.env.ADMIN_PASSWORD
    || crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x');
  db.prepare('INSERT INTO admins(username, password_hash) VALUES (?, ?)').run('admin', hashPassword(password));
  return process.env.ADMIN_PASSWORD ? { username: 'admin', generated: false } : { username: 'admin', password, generated: true };
}

// Limitador simples em memória (por chave, ex.: IP) para frear tentativas de abuso.
function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return key => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
    return arr.length <= max;
  };
}

module.exports = {
  hashPassword, verifyPassword, createSession, setCookie, destroySession,
  requireAdmin, ensureAdmin, rateLimiter,
};
