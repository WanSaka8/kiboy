const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET wajib diisi (lihat file .env)');
  process.exit(1);
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

// Daftar akun baru
async function registerHandler(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!USERNAME_RE.test(username || '')) {
      return res.status(400).json({ error: 'Username 3-30 karakter, hanya huruf/angka/underscore' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    const hash = await bcrypt.hash(password, 10);
    try {
      const [result] = await pool.query(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, hash]
      );
      const user = { id: result.insertId, username };
      res.status(201).json({ token: signToken(user) });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username sudah dipakai' });
      throw e;
    }
  } catch (err) { next(err); }
}

// Login akun yang sudah ada
async function loginHandler(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username & password wajib diisi' });

    const [rows] = await pool.query('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Username atau password salah' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Username atau password salah' });

    res.json({ token: signToken(user) });
  } catch (err) { next(err); }
}

// Wajib login untuk mengakses route di bawahnya; req.user diisi dari isi token
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Belum login' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' });
  }
}

module.exports = { registerHandler, loginHandler, requireAuth };
