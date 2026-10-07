# 💭 Keluh Kesah — Aplikasi Web Multi-Container 

Tugas Kelompok-1 MID DevOps: aplikasi web dengan fitur CRUD dan database yang berjalan penuh di dalam container.

**Nama tim**: _Kiboy_

**List Anggota**:
1. _Wan Saka Nasa_ — _231111488_
2. _Joni fernando.s_ — _231111598_
3. _Percaya Mendrofa_ — _231110553_

**Topik project**: Website Keluh Kesah untuk Mendukung Ruang Berbagi Cerita dan Pencatatan Pribadi Secara Anonim

## Deskripsi

**Keluh Kesah** adalah tempat berbagi cerita dan keluh kesah.

**A. Modul Cerita (Keluh Kesah)**
1. Tulis Cerita: Pengguna dapat menulis cerita/keluh kesah dengan memilih mood dan kategori, serta opsi mengirim secara anonim atau menggunakan nama.
2. Interaksi: Pengguna dapat memberi reaksi (like, heart, support) dan menambahkan komentar pada cerita pengguna lain.
3. Kelola Cerita: Pengguna dapat mengedit atau menghapus cerita yang pernah dibuat.

**B. Modul Kalender Catatan**
1. Catatan Harian: Pengguna dapat menambahkan catatan pada tanggal tertentu melalui tampilan kalender.
2. Kelola Catatan: Pengguna dapat melihat seluruh catatan pada satu tanggal, mengedit isi, serta menghapus catatan yang sudah tidak diperlukan.

**C. Modul Catatan Pribadi**
1. Kelola Catatan: Pengguna dapat membuat, mengedit, dan menghapus catatan pribadi lengkap dengan judul, isi, dan tag.
2. Pin Catatan: Pengguna dapat menandai (pin) catatan penting agar selalu tampil di bagian atas daftar.

**D. Modul Analitik & Tambahan**
1. Dashboard Analytics: Menampilkan statistik cerita seperti tren mood, kategori terpopuler, dan word cloud dari seluruh cerita yang masuk.
2. Trending & Mood Map: Menampilkan cerita dengan reaksi terbanyak dan visualisasi sebaran mood pengguna.
3. Nightcore & Cuaca: Fitur tambahan berbasis API eksternal / client-side.

**E. Keamanan**
1. Autentikasi: Pengguna mendaftar dan login dengan akun sendiri (username + password di-hash dengan bcrypt, sesi memakai token JWT).
2. Kepemilikan Data: Setiap cerita, catatan kalender, dan catatan pribadi tercatat kepemilikannya. Hanya pemilik yang bisa mengedit atau menghapus datanya sendiri — pengguna lain hanya bisa melihat (untuk cerita & kalender) atau sama sekali tidak bisa mengakses (untuk catatan pribadi, karena memang privat per akun).

Ringkasan CRUD per modul:

| Modul | CRUD |
|-------|------|
| Cerita | Create, Read, Update, Delete |
| Kalender Catatan | Create, Read, Update, Delete |
| Catatan Pribadi | Create, Read, Update, Delete |
| Trending, Analytics, Mood Map | Read |

Aplikasi awalnya berupa satu file HTML dengan Firebase Firestore + Supabase (layanan cloud). Untuk tugas ini
arsitekturnya dipindahkan ke **3 layanan yang berjalan di container**, sehingga database ikut ter-container
dan aplikasi bisa dijalankan siapa saja dengan satu perintah. Fitur **Galeri** dan **Translator** (termasuk
Anime Voice TTS yang menyatu dengannya) sudah dihapus dari aplikasi.

## Arsitektur

```
Browser ──:8080──► frontend (Nginx) ──/api──► backend (Node.js + Express) ──► db (MySQL 8)
                                                                                   ▲
                                                                             volume: dbdata
                                                                         adminer :8081 ──┘
```

| Container | Image | Fungsi | Port host |
|-----------|-------|--------|-----------|
| `frontend` | `nginx:1.27-alpine` | Menyajikan `index.html` + reverse proxy ke API | 8080 |
| `backend` | `node:20-alpine` (multi-stage build) | REST API, autentikasi JWT | – (internal) |
| `db` | `mysql:8.4` | Database; skema dibuat otomatis dari `db/init.sql` | – (internal) |
| `adminer` | `adminer:4` | Melihat isi database lewat browser | 8081 |

Poin teknis container: multi-stage build, user non-root pada backend, `.dockerignore`, healthcheck di semua
service utama, `depends_on` dengan `condition: service_healthy`, dua custom network (`frontend-net` dan
`backend-net`, sehingga database tidak bisa diakses langsung dari frontend), satu named volume (`dbdata`),
dan konfigurasi lewat `.env`.

## Cara menjalankan

Prasyarat: Docker + Docker Compose.

```bash
git clone <URL-REPO-GITHUB>
cd keluh-kesah-docker

cp .env.example .env        # lalu edit nilai password & JWT_SECRET di file .env
docker compose up --build -d
docker compose ps           # semua service harus running/healthy
```

- Aplikasi: <http://localhost:8080> — daftar akun baru lewat tombol "Daftar di sini" di modal login, atau pakai akun demo bawaan: **username `demo`, password `demo1234`**.
- Adminer: <http://localhost:8081> → System: **MySQL**, Server: **db**, isi user/password/database sesuai `.env`

Perintah berguna:

```bash
docker compose logs -f backend      # lihat log API
docker compose down                 # matikan container (data TETAP ada di volume)
docker compose down -v              # matikan + hapus volume (reset total, data hilang)
docker compose build --no-cache     # build ulang image dari nol
```

**Bukti persistensi data:** tambah beberapa cerita → `docker compose down` → `docker compose up -d` → data masih ada.

> `db/init.sql` hanya dijalankan saat volume `dbdata` masih kosong. Kalau kamu mengubah skema, jalankan `docker compose down -v` dulu.

## Struktur repo

```
keluh-kesah-docker/
├── docker-compose.yml
├── .env.example
├── db/init.sql                 # skema tabel + data contoh (MySQL)
├── backend/
│   ├── Dockerfile              # multi-stage, non-root
│   ├── package.json / package-lock.json
│   └── src/
│       ├── server.js           # entry point + routing
│       ├── db.js               # koneksi MySQL (mysql2)
│       ├── auth.js             # login & verifikasi JWT
│       └── routes/             # notes, dailyNotes, privateNotes
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── index.html
```

## Database (MySQL)

| Tabel | Isi |
|-------|-----|
| `users` | Akun (username unik, password tersimpan sebagai hash bcrypt) |
| `notes` | Cerita (nama, catatan, mood, kategori, anonim, waktu, `user_id` pemilik) |
| `note_reactions` | Reaksi like/heart/support per pengguna (PK gabungan → 1 reaksi per jenis per user) |
| `note_comments` | Komentar cerita (`user_id` penulis komentar) |
| `daily_notes` | Catatan per tanggal (`user_id` pemilik) |
| `private_notes` | Catatan pribadi (tag disimpan sebagai kolom `JSON`, `user_id` pemilik) |

Semua tabel kecuali `users` punya `user_id` dengan `FOREIGN KEY ... ON DELETE CASCADE` ke `users(id)` —
menghapus akun otomatis menghapus seluruh datanya. `note_reactions` dan `note_comments` juga `ON DELETE CASCADE`
ke `notes`: menghapus cerita otomatis menghapus reaksi & komentarnya.

> **Penting (emoji/UTF-8):** `init.sql` dimulai dengan `SET NAMES utf8mb4;` dan koneksi backend (`db.js`) diset `charset: 'utf8mb4'` secara eksplisit. Tanpa ini, emoji di teks cerita bisa tersimpan rusak (mojibake) — sudah diuji dan diperbaiki.

## API

Semua endpoint (kecuali health, register & login) butuh header `Authorization: Bearer <token>`.
Endpoint bertanda 🔒 hanya bisa diedit/dihapus oleh pemiliknya — pengguna lain mendapat `403 Forbidden`.

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/health` | Status API + database |
| POST | `/api/auth/register` | Body `{username, password}` → daftar akun baru, langsung dapat `{token}` |
| POST | `/api/auth/login` | Body `{username, password}` → `{token}` |
| GET | `/api/auth/me` | Info akun yang sedang login: `{id, username}` |
| GET / POST | `/api/notes` | Daftar / buat cerita (pemilik otomatis dari token) |
| PUT / DELETE 🔒 | `/api/notes/:id` | Edit / hapus cerita |
| POST | `/api/notes/:id/reactions` | Toggle reaksi `{type}` milik akun sendiri |
| POST | `/api/notes/:id/comments` | Tambah komentar |
| GET / POST | `/api/daily-notes` | Ringkasan per bulan (`?from=&to=`) / tambah catatan |
| GET | `/api/daily-notes/:date` | Catatan pada satu tanggal (shared, tiap catatan menyertakan `userId` pemilik) |
| PUT / DELETE 🔒 | `/api/daily-notes/:id` | Edit / hapus catatan |
| GET / POST | `/api/private-notes` | Daftar (hanya milik sendiri) / buat catatan pribadi |
| PUT / DELETE 🔒 | `/api/private-notes/:id` | Edit (parsial) / hapus |

## Perubahan dari aplikasi awal (Firebase + Supabase)

- Menggunakan backend Express + **MySQL**; frontend memakai `fetch()` ke `/api/...`.
- Password tunggal (`405090`, lalu `APP_PASSWORD`) diganti **akun per-pengguna**: daftar/login dengan username+password (di-hash bcrypt), sesi memakai token JWT.
- **Kepemilikan data**: tiap cerita, catatan kalender, dan catatan pribadi tercatat pemiliknya (`user_id` ber-`FOREIGN KEY` ke tabel `users`). Hanya pemilik yang bisa edit/hapus — tombol Edit/Hapus otomatis hilang di UI untuk pengguna lain, dan backend tetap menolak (403) kalau dicoba lewat API langsung.
- Perbaikan bug: **Catatan Pribadi** sebelumnya tidak difilter per pengguna sama sekali — siapapun yang login bisa melihat dan mengedit punya siapa saja. Sekarang benar-benar privat per akun.
- Kunci API Firebase/Supabase dan password lama dihapus dari kode.
- `userId` lama (string acak di `localStorage`) diganti ID akun sungguhan dari server, didapat lewat `/api/auth/me` setelah login.
- Realtime `onSnapshot` diganti polling ringan (8 detik, hanya render ulang jika data berubah).
- Kalender catatan kini bisa menghapus catatan (sebelumnya hanya tambah), dan tetap bisa dilihat bersama (shared), tapi hapus/edit dibatasi ke pemilik.

## Sumber referensi

- Kode aplikasi asli: karya kelompok/anggota (versi HTML + Firebase), dimigrasi untuk tugas ini.
- Dokumentasi: Docker Compose, image resmi Docker Hub (`nginx`, `node`, `mysql`, `adminer`), Express, mysql2, jsonwebtoken.

## Link

- GitHub: _https://github.com/WanSaka8/kiboy_
- Video dokumentasi: _isi_
- Docker Hub (opsional): _https://hub.docker.com/repository/docker/narasandrone/izinkompe_

## Opsional: push image ke Docker Hub

```bash
# set DOCKERHUB_USER=<username> di .env
docker login
docker compose build
docker compose push backend frontend
```

## Catatan keamanan

- Jangan commit file `.env` (sudah ada di `.gitignore`).
- Password pengguna disimpan sebagai hash (`bcrypt`), bukan teks asli — bahkan admin database tidak bisa melihat password asli pengguna.
- Akun demo bawaan (`demo` / `demo1234`) hanya untuk keperluan uji coba/presentasi. Ganti atau hapus sebelum dipakai di luar lingkungan tugas.
