// SQLite database (persistent storage). The file cinema.db is created automatically on first run.
import { DatabaseSync } from 'node:sqlite'   // SQLite built into Node.js (no compiling needed)
import bcrypt from 'bcryptjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const db = new DatabaseSync(path.join(here, 'cinema.db'))
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

// db.transaction(fn)() runs fn all-or-nothing (rolls back if anything throws)
db.transaction = (fn) => () => {
  db.exec('BEGIN')
  try { const r = fn(); db.exec('COMMIT'); return r } catch (e) { db.exec('ROLLBACK'); throw e }
}
export const isConstraintError = (e) => /constraint failed/i.test(String(e?.message))

db.exec(`
create table if not exists users (
  id integer primary key autoincrement,
  email text not null unique,
  full_name text not null default '',
  password_hash text not null,
  role text not null default 'user' check (role in ('user','admin')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create table if not exists movies (
  id integer primary key autoincrement,
  title text not null,
  year integer,
  rating real not null check (rating between 0 and 10),
  genres text not null,                       -- JSON array, e.g. ["Action","Sci-Fi"]
  duration_min integer not null check (duration_min > 0),
  poster_url text not null
);
create table if not exists showtimes (
  id integer primary key autoincrement,
  movie_id integer not null references movies(id) on delete cascade,
  starts_at text not null,                    -- ISO date-time (UTC)
  hall text not null default 'Hall 1',
  price real not null default 350 check (price > 0)
);
create table if not exists bookings (
  id integer primary key autoincrement,
  showtime_id integer not null references showtimes(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  seat text not null,
  customer_name text not null,
  customer_email text not null,
  booking_ref text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (showtime_id, seat)                  -- stops double booking
);
create table if not exists waitlist (          -- FIFO queue for sold-out shows
  id integer primary key autoincrement,
  showtime_id integer not null references showtimes(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  email text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (showtime_id, user_id)
);
`)

// ---------- seed data (only when the database is empty) ----------
if (!db.prepare('select count(*) n from users').get().n) {
  db.prepare('insert into users (email, full_name, password_hash, role) values (?,?,?,?)')
    .run('admin@velvetseat.com', 'Cinema Admin', bcrypt.hashSync('admin12345', 10), 'admin')
}
if (!db.prepare('select count(*) n from movies').get().n) {
  const movies = [
    ['Obsession', 2025, 7.8, ['Horror', 'Romance'], 109, '/posters/obsession.jpg'],
    ['Spider-Man: Brand New Day', 2026, 8.4, ['Action', 'Adventure'], 145, '/posters/spider-man.jpg'],
    ['Coyote vs Acme', 2026, 7.5, ['Animation', 'Adventure'], 103, '/posters/coyote-vs-acme.jpg'],
    ['The Maze Runner', 2014, 6.8, ['Sci-Fi', 'Thriller'], 113, '/posters/maze-runner.jpg'],
    ['Titanic', 1997, 8.0, ['Drama', 'Romance'], 194, '/posters/titanic.jpg'],
  ]
  const addMovie = db.prepare('insert into movies (title, year, rating, genres, duration_min, poster_url) values (?,?,?,?,?,?)')
  const addShow = db.prepare('insert into showtimes (movie_id, starts_at, hall, price) values (?,?,?,?)')
  const slots = [[13, 0], [17, 0], [20, 30]]
  db.transaction(() => {
    for (const m of movies) {
      const id = addMovie.run(m[0], m[1], m[2], JSON.stringify(m[3]), m[4], m[5]).lastInsertRowid
      for (let d = 0; d < 7; d++) for (const [h, min] of slots) {
        const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, min, 0, 0)
        addShow.run(id, t.toISOString(), 'Hall ' + (1 + ((Number(id) + d) % 3)), 350)
      }
    }
  })()
}
