-- Skema database "Keluh Kesah" (MySQL 8)
-- File ini dijalankan otomatis oleh image MySQL pada start pertama (volume masih kosong).

-- Wajib: paksa koneksi memakai utf8mb4, kalau tidak emoji di data contoh bisa korup (mojibake)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(40)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nama         VARCHAR(60)  NOT NULL,
  catatan      VARCHAR(500) NOT NULL,
  mood         VARCHAR(20)  NOT NULL,
  category     VARCHAR(30)  NOT NULL,
  is_anonymous BOOLEAN      NOT NULL DEFAULT FALSE,
  user_id      INT          NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_edited  DATETIME     NULL,
  CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notes_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS note_reactions (
  note_id    INT      NOT NULL,
  user_id    INT      NOT NULL,
  type       VARCHAR(10) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (note_id, user_id, type),
  CONSTRAINT fk_reactions_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_reaction_type CHECK (type IN ('likes', 'hearts', 'supports'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS note_comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  note_id    INT          NOT NULL,
  author     VARCHAR(60)  NOT NULL,
  text       VARCHAR(300) NOT NULL,
  user_id    INT          NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_note_comments_note (note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daily_notes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  note_date  DATE         NOT NULL,
  content    VARCHAR(500) NOT NULL,
  user_id    INT          NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_daily_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_daily_notes_date (note_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS private_notes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(150) NOT NULL DEFAULT '',
  content    TEXT         NOT NULL,
  tags       JSON         NOT NULL,
  pinned     BOOLEAN      NOT NULL DEFAULT FALSE,
  user_id    INT          NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_private_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User contoh untuk demo (password: demo1234)
INSERT INTO users (username, password_hash) VALUES
  ('demo', '$2b$10$dscy4ot/l/KcWjuQkpLVXu7.6l/ubkE0TTfCMajaFdYBKldtjxWmi');

-- Data contoh supaya demo tidak kosong (milik user 'demo', id=1)
INSERT INTO notes (nama, catatan, mood, category, is_anonymous, user_id) VALUES
  ('Demo',   'Akhirnya berhasil menjalankan aplikasi ini di dalam container 🐳', 'excited',  'education', FALSE, 1),
  ('Anonim', 'Deadline tugas numpuk, tapi tetap semangat!',                       'grateful', 'personal',  TRUE,  1);

INSERT INTO private_notes (title, content, tags, pinned, user_id) VALUES
  ('Catatan pertama', 'Ini contoh catatan pribadi. Coba edit, pin, atau hapus.', JSON_ARRAY('contoh', 'docker'), TRUE, 1);
