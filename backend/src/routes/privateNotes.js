const express = require('express');
const { pool } = require('../db');

const router = express.Router();

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20);
}

function mapRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    pinned: !!row.pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// READ: hanya catatan milik sendiri (yang dipin di atas)
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, content, tags, pinned, created_at, updated_at
         FROM private_notes WHERE user_id = ? ORDER BY pinned DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(mapRow));
  } catch (err) { next(err); }
});

// CREATE (pemilik dari token)
router.post('/', async (req, res, next) => {
  try {
    const { title, content, tags, pinned } = req.body || {};
    if (!(content || '').trim()) return res.status(400).json({ error: 'Isi catatan tidak boleh kosong' });
    const [result] = await pool.query(
      `INSERT INTO private_notes (title, content, tags, pinned, user_id) VALUES (?, ?, ?, ?, ?)`,
      [(title || '').trim(), content.trim(), JSON.stringify(cleanTags(tags)), !!pinned, req.user.id]
    );
    res.status(201).json({ id: String(result.insertId) });
  } catch (err) { next(err); }
});

// UPDATE (parsial: boleh kirim sebagian field saja, mis. hanya { pinned }) — hanya pemilik
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid' });
    const { title, content, tags, pinned } = req.body || {};
    const [result] = await pool.query(
      `UPDATE private_notes SET
         title      = COALESCE(?, title),
         content    = COALESCE(?, content),
         tags       = COALESCE(?, tags),
         pinned     = COALESCE(?, pinned),
         updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        title === undefined ? null : String(title).trim(),
        content === undefined ? null : String(content).trim(),
        tags === undefined ? null : JSON.stringify(cleanTags(tags)),
        pinned === undefined ? null : !!pinned,
        id, req.user.id,
      ]
    );
    if (!result.affectedRows) {
      const [[exists]] = await pool.query('SELECT id FROM private_notes WHERE id = ?', [id]);
      return res.status(exists ? 403 : 404).json({ error: exists ? 'Bukan pemilik catatan ini' : 'Catatan tidak ditemukan' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE — hanya pemilik
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID tidak valid' });
    const [result] = await pool.query('DELETE FROM private_notes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result.affectedRows) {
      const [[exists]] = await pool.query('SELECT id FROM private_notes WHERE id = ?', [id]);
      return res.status(exists ? 403 : 404).json({ error: exists ? 'Bukan pemilik catatan ini' : 'Catatan tidak ditemukan' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
