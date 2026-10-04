const express = require('express');
const { pool } = require('../db');

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// READ: jumlah catatan per tanggal dalam rentang (untuk badge di kalender)
router.get('/', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
      return res.status(400).json({ error: 'Parameter from & to harus YYYY-MM-DD' });
    }
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(note_date, '%Y-%m-%d') AS date, COUNT(*) AS count
         FROM daily_notes
        WHERE note_date BETWEEN ? AND ?
        GROUP BY note_date
        ORDER BY note_date`,
      [from, to]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// READ: semua catatan pada satu tanggal (tetap dibagikan ke semua orang;
// userId disertakan supaya frontend tahu tombol hapus mana yang boleh tampil)
router.get('/:date', async (req, res, next) => {
  try {
    if (!DATE_RE.test(req.params.date)) return res.status(400).json({ error: 'Format tanggal salah' });
    const [rows] = await pool.query(
      `SELECT id, content AS text, user_id AS userId FROM daily_notes WHERE note_date = ? ORDER BY created_at`,
      [req.params.date]
    );
    rows.forEach((r) => { r.id = String(r.id); });
    res.json({ date: req.params.date, notes: rows });
  } catch (err) { next(err); }
});

// CREATE: tambah catatan pada tanggal tertentu (pemilik dari token)
router.post('/', async (req, res, next) => {
  try {
    const { date, text } = req.body || {};
    const content = (text || '').trim();
    if (!DATE_RE.test(date || '') || !content) {
      return res.status(400).json({ error: 'Tanggal dan isi catatan wajib diisi' });
    }
    if (content.length > 500) return res.status(400).json({ error: 'Maksimal 500 karakter' });
    const [result] = await pool.query(
      'INSERT INTO daily_notes (note_date, content, user_id) VALUES (?, ?, ?)',
      [date, content, req.user.id]
    );
    res.status(201).json({ id: String(result.insertId) });
  } catch (err) { next(err); }
});

// UPDATE: ubah isi catatan — hanya pemilik
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const content = ((req.body || {}).text || '').trim();
    if (!Number.isInteger(id) || !content) return res.status(400).json({ error: 'Data tidak valid' });
    const [result] = await pool.query(
      'UPDATE daily_notes SET content = ? WHERE id = ? AND user_id = ?', [content, id, req.user.id]
    );
    if (!result.affectedRows) {
      const [[exists]] = await pool.query('SELECT id FROM daily_notes WHERE id = ?', [id]);
      return res.status(exists ? 403 : 404).json({ error: exists ? 'Bukan pemilik catatan ini' : 'Catatan tidak ditemukan' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE: hapus satu catatan — hanya pemilik
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid' });
    const [result] = await pool.query('DELETE FROM daily_notes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result.affectedRows) {
      const [[exists]] = await pool.query('SELECT id FROM daily_notes WHERE id = ?', [id]);
      return res.status(exists ? 403 : 404).json({ error: exists ? 'Bukan pemilik catatan ini' : 'Catatan tidak ditemukan' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
