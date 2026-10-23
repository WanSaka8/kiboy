const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  charset: 'utf8mb4', // wajib eksplisit, kalau tidak teks emoji (mis. mood/catatan) bisa korup
  dateStrings: true, // tanggal/waktu dikembalikan sebagai string, bukan objek Date lokal server
});

// Tunggu sampai database siap (berguna kalau backend start lebih cepat dari db)
async function waitForDb(retries = 20, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] terhubung ke MySQL');
      return;
    } catch (err) {
      console.log(`[db] belum siap (percobaan ${i}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Tidak bisa terhubung ke database');
}

module.exports = { pool, waitForDb };
