const express = require('express');
const { pool } = require('../db');

const router = express.Router();
const REACTION_TYPES = ['likes', 'hearts', 'supports'];
const MOODS = ['happy', 'sad', 'angry', 'excited', 'confused', 'grateful'];

function parseId(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'ID tidak valid' });
    return null;
  }
  return id;
}

// Gabungkan baris reaksi & komentar ke tiap cerita (lebih sederhana & portable
// daripada memakai fungsi agregat JSON khusus dialek database tertentu).
function attachExtras(notes, reactionRows, commentRows) {
  const byNote = new Map(notes.map((n) => [n.id, n]));
  for (const n of notes) {
    n.likes = []; n.hearts = []; n.supports = [];
    n.totalReactions = 0;
    n.comments = [];
  }
  for (const r of reactionRows) {
    const n = byNote.get(String(r.note_id));
    if (!n) continue;
    n[r.type].push(r.user_id);
    n.totalReactions += 1;
  }
  for (const c of commentRows) {
    const n = byNote.get(String(c.note_id));
    if (!n) continue;
    n.comments.push({ text: c.text, author: c.author, userId: c.user_id, timestamp: c.created_at });
  }
  return notes;
}

// READ: semua cerita (terbaru dulu)
router.get('/', async (req, res, next) => {
  try {
    const [notes] = await pool.query(
      `SELECT id, nama, catatan, mood, category,
              is_anonymous AS isAnonymous, user_id AS userId,
              created_at AS createdAt, created_at AS waktu,
              updated_at AS updatedAt, last_edited AS lastEdited
         FROM notes ORDER BY created_at DESC`
    );
    notes.forEach((n) => { n.id = String(n.id); n.isAnonymous = !!n.isAnonymous; });

    const ids = notes.map((n) => n.id);
    let reactionRows = [];
    let commentRows = [];
    if (ids.length) {
      [reactionRows] = await pool.query(
        `SELECT note_id, user_id, type FROM note_reactions WHERE note_id IN (?)`, [ids]
      );
      [commentRows] = await pool.query(
        `SELECT note_id, author, text, user_id, created_at FROM note_comments
          WHERE note_id IN (?) ORDER BY created_at`, [ids]
      );
    }
    res.json(attachExtras(notes, reactionRows, commentRows));
  } catch (err) { next(err); }
});

// CREATE: cerita baru (pemilik selalu diambil dari token, tidak bisa dipalsukan client)
router.post('/', async (req, res, next) => {
  try {
    const { nama, catatan, mood, category, isAnonymous } = req.body || {};
    const text = (catatan || '').trim();
    const name = (nama || '').trim();

    if (!text || !mood || !category || (!isAnonymous && !name)) {
      return res.status(400).json({ error: 'Field belum lengkap' });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: 'Cerita maksimal 500 karakter' });
    }
    if (!MOODS.includes(mood)) {
      return res.status(400).json({ error: 'Mood tidak valid' });
    }

    const [result] = await pool.query(
      `INSERT INTO notes (nama, catatan, mood, category, is_anonymous, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [isAnonymous ? 'Anonim' : name, text, mood, category, !!isAnonymous, req.user.id]
    );
    res.status(201).json({ id: String(result.insertId) });
  } catch (err) { next(err); }
});

// UPDATE: edit isi cerita — hanya pemilik
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res); if (id === null) return;
    const text = ((req.body || {}).catatan || '').trim();
    if (!text) return res.status(400).json({ error: 'Cerita tidak boleh kosong' });
    if (text.length > 500) return res.status(400).json({ error: 'Cerita maksimal 500 karakter' });

    const [result] = await pool.query(
      `UPDATE notes SET catatan = ?, last_edited = NOW(), updated_at = NOW() WHERE id = ? AND user_id = ?`,
      [text, id, req.user.id]
    );
    if (!result.affectedRows) {
      const [[exists]] = await pool.query('SELECT id FROM notes WHERE id = ?', [id]);
      return res.status(exists ? 403 : 404).json({ error: exists ? 'Bukan pemilik cerita ini' : 'Cerita tidak ditemukan' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE: hapus cerita — hanya pemilik (reaksi & komentar ikut terhapus lewat ON DELETE CASCADE)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res); if (id === null) return;
    const [result] = await pool.query('DELETE FROM notes WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result.affectedRows) {
      const [[exists]] = await pool.query('SELECT id FROM notes WHERE id = ?', [id]);
      return res.status(exists ? 403 : 404).json({ error: exists ? 'Bukan pemilik cerita ini' : 'Cerita tidak ditemukan' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Toggle reaksi (like / heart / support). Klik sekali = tambah, klik lagi = batal.
router.post('/:id/reactions', async (req, res, next) => {
  try {
    const id = parseId(req, res); if (id === null) return;
    const { type } = req.body || {};
    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Reaksi tidak valid' });
    }
    const [del] = await pool.query(
      'DELETE FROM note_reactions WHERE note_id = ? AND user_id = ? AND type = ?',
      [id, req.user.id, type]
    );
    if (!del.affectedRows) {
      try {
        await pool.query(
          'INSERT INTO note_reactions (note_id, user_id, type) VALUES (?, ?, ?)',
          [id, req.user.id, type]
        );
      } catch (e) {
        if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: 'Cerita tidak ditemukan' });
        throw e;
      }
    }
    res.json({ ok: true, reacted: !del.affectedRows });
  } catch (err) { next(err); }
});

// Tambah komentar
router.post('/:id/comments', async (req, res, next) => {
  try {
    const id = parseId(req, res); if (id === null) return;
    const { text, author } = req.body || {};
    const body = (text || '').trim();
    if (!body) return res.status(400).json({ error: 'Komentar kosong' });
    if (body.length > 300) return res.status(400).json({ error: 'Komentar maksimal 300 karakter' });

    try {
      await pool.query(
        'INSERT INTO note_comments (note_id, author, text, user_id) VALUES (?, ?, ?, ?)',
        [id, (author || req.user.username).slice(0, 60), body, req.user.id]
      );
    } catch (e) {
      if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: 'Cerita tidak ditemukan' });
      throw e;
    }
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
