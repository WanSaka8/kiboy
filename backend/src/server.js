const express = require('express');
const { pool, waitForDb } = require('./db');
const { registerHandler, loginHandler, requireAuth } = require('./auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// --- Endpoint publik ---
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch {
    res.status(503).json({ status: 'error', db: 'down' });
  }
});
app.post('/api/auth/register', registerHandler);
app.post('/api/auth/login', loginHandler);

// --- Semua endpoint di bawah ini wajib login ---
app.use('/api', requireAuth);
app.get('/api/auth/me', (req, res) => res.json(req.user));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/daily-notes', require('./routes/dailyNotes'));
app.use('/api/private-notes', require('./routes/privateNotes'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

waitForDb()
  .then(() => app.listen(PORT, () => console.log(`[api] berjalan di port ${PORT}`)))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
