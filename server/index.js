import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

try { process.loadEnvFile() } catch { /* .env is optional */ }

const { db, isConstraintError } = await import('./db.js')
const { signToken, requireAuth, requireAdmin } = await import('./auth.js')

const app = express()
app.use(cors())
app.use(express.json())

const wrap = (fn) => (req, res) => {
  try { fn(req, res) } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }) }
}
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg })
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '')

// ====================== AUTH ======================
const publicUser = (u) => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role })

app.post('/api/auth/register', wrap((req, res) => {
  const { full_name = '', email = '', password = '' } = req.body
  const mail = email.trim().toLowerCase()
  if (full_name.trim().length < 2) return bad(res, 'Enter your full name.')
  if (!validEmail(mail)) return bad(res, 'Enter a valid email address.')
  if (password.length < 8) return bad(res, 'Password must be at least 8 characters.')
  if (db.prepare('select 1 from users where email = ?').get(mail)) return bad(res, 'That email is already registered.', 409)
  const id = db.prepare('insert into users (email, full_name, password_hash) values (?,?,?)')
    .run(mail, full_name.trim(), bcrypt.hashSync(password, 10)).lastInsertRowid
  const user = db.prepare('select * from users where id = ?').get(id)
  res.status(201).json({ token: signToken(user), user: publicUser(user) })
}))

app.post('/api/auth/login', wrap((req, res) => {
  const mail = (req.body.email || '').trim().toLowerCase()
  const user = db.prepare('select * from users where email = ?').get(mail)
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) return bad(res, 'Wrong email or password.', 401)
  res.json({ token: signToken(user), user: publicUser(user) })
}))

app.get('/api/auth/me', requireAuth, wrap((req, res) => {
  const user = db.prepare('select * from users where id = ?').get(req.user.id)
  if (!user) return bad(res, 'Account not found.', 401)
  res.json(publicUser(user))
}))

// everything below needs a logged-in user
app.use('/api', requireAuth)

// ====================== MOVIES (CRUD) ======================
const movieOut = (m) => ({ ...m, genres: JSON.parse(m.genres) })

function checkMovie(b) {
  const genres = Array.isArray(b.genres) ? b.genres.map((g) => String(g).trim()).filter(Boolean) : []
  if (!String(b.title || '').trim() || String(b.title).length > 100) return ['Title is required (max 100 characters).']
  if (!(+b.year >= 1888 && +b.year <= 2100)) return ['Year must be between 1888 and 2100.']
  if (b.rating === '' || b.rating == null || !(+b.rating >= 0 && +b.rating <= 10)) return ['Rating must be 0 to 10.']
  if (!genres.length) return ['Add at least one genre.']
  if (!(+b.duration_min > 0 && +b.duration_min <= 600)) return ['Duration must be 1 to 600 minutes.']
  if (!String(b.poster_url || '').trim()) return ['Poster path is required.']
  return [null, [b.title.trim(), +b.year, +b.rating, JSON.stringify(genres), Math.round(+b.duration_min), b.poster_url.trim()]]
}

app.get('/api/movies', wrap((req, res) => {
  res.json(db.prepare('select * from movies order by id').all().map(movieOut))
}))
app.post('/api/movies', requireAdmin, wrap((req, res) => {
  const [err, v] = checkMovie(req.body); if (err) return bad(res, err)
  const id = db.prepare('insert into movies (title, year, rating, genres, duration_min, poster_url) values (?,?,?,?,?,?)').run(...v).lastInsertRowid
  res.status(201).json(movieOut(db.prepare('select * from movies where id = ?').get(id)))
}))
app.put('/api/movies/:id', requireAdmin, wrap((req, res) => {
  const [err, v] = checkMovie(req.body); if (err) return bad(res, err)
  const r = db.prepare('update movies set title=?, year=?, rating=?, genres=?, duration_min=?, poster_url=? where id=?').run(...v, req.params.id)
  if (!r.changes) return bad(res, 'Movie not found.', 404)
  res.json(movieOut(db.prepare('select * from movies where id = ?').get(req.params.id)))
}))
app.delete('/api/movies/:id', requireAdmin, wrap((req, res) => {
  const r = db.prepare('delete from movies where id = ?').run(req.params.id)
  if (!r.changes) return bad(res, 'Movie not found.', 404)
  res.json({ ok: true })
}))

// ====================== SHOWTIMES (CRUD) ======================
function checkShowtime(b) {
  if (!b.movie_id || !db.prepare('select 1 from movies where id = ?').get(b.movie_id)) return ['Choose a valid movie.']
  if (!b.starts_at || isNaN(new Date(b.starts_at))) return ['Pick a valid date and time.']
  if (!String(b.hall || '').trim()) return ['Hall is required.']
  if (!(+b.price > 0)) return ['Price must be greater than 0.']
  return [null, [+b.movie_id, new Date(b.starts_at).toISOString(), b.hall.trim(), +b.price]]
}

app.get('/api/showtimes', wrap((req, res) => {
  const { movie_id, upcoming } = req.query
  const rows = db.prepare(`select * from showtimes
    where (@movie_id is null or movie_id = @movie_id) and (@from is null or starts_at >= @from) order by starts_at`)
    .all({ movie_id: movie_id ?? null, from: upcoming ? new Date().toISOString() : null })
  res.json(rows)
}))
app.post('/api/showtimes', requireAdmin, wrap((req, res) => {
  const [err, v] = checkShowtime(req.body); if (err) return bad(res, err)
  const id = db.prepare('insert into showtimes (movie_id, starts_at, hall, price) values (?,?,?,?)').run(...v).lastInsertRowid
  res.status(201).json(db.prepare('select * from showtimes where id = ?').get(id))
}))
app.put('/api/showtimes/:id', requireAdmin, wrap((req, res) => {
  const [err, v] = checkShowtime(req.body); if (err) return bad(res, err)
  const r = db.prepare('update showtimes set movie_id=?, starts_at=?, hall=?, price=? where id=?').run(...v, req.params.id)
  if (!r.changes) return bad(res, 'Showtime not found.', 404)
  res.json(db.prepare('select * from showtimes where id = ?').get(req.params.id))
}))
app.delete('/api/showtimes/:id', requireAdmin, wrap((req, res) => {
  const r = db.prepare('delete from showtimes where id = ?').run(req.params.id)
  if (!r.changes) return bad(res, 'Showtime not found.', 404)
  res.json({ ok: true })
}))

// taken seats for a showtime + whether this user is already on the waitlist
app.get('/api/showtimes/:id/seats', wrap((req, res) => {
  const seats = db.prepare('select seat from bookings where showtime_id = ?').all(req.params.id).map((r) => r.seat)
  const joined = !!db.prepare('select 1 from waitlist where showtime_id = ? and user_id = ?').get(req.params.id, req.user.id)
  res.json({ seats, joined })
}))

// ====================== BOOKINGS ======================
const bookingSelect = `select b.*, s.starts_at, s.hall, m.title
  from bookings b join showtimes s on s.id = b.showtime_id join movies m on m.id = s.movie_id`
const bookingOut = (r) => {
  const { starts_at, hall, title, ...b } = r
  return { ...b, showtimes: { starts_at, hall, movies: { title } } }
}

// users see their own bookings; admins can add ?scope=all to see everyone's
app.get('/api/bookings', wrap((req, res) => {
  const all = req.user.role === 'admin' && req.query.scope === 'all'
  const rows = all
    ? db.prepare(`${bookingSelect} order by b.created_at desc, b.id desc`).all()
    : db.prepare(`${bookingSelect} where b.user_id = ? order by b.created_at, b.id`).all(req.user.id)
  res.json(rows.map(bookingOut))
}))

app.post('/api/bookings', wrap((req, res) => {
  const { showtime_id, seats, customer_name } = req.body
  const show = db.prepare('select * from showtimes where id = ?').get(showtime_id)
  if (!show) return bad(res, 'Showtime not found.', 404)
  if (new Date(show.starts_at) < new Date()) return bad(res, 'That showtime has already started.')
  if (String(customer_name || '').trim().length < 2) return bad(res, 'Enter the name for the booking.')
  if (!Array.isArray(seats) || !seats.length || seats.length > 8) return bad(res, 'Choose 1 to 8 seats.')
  const uniq = [...new Set(seats)]
  if (uniq.length !== seats.length || !uniq.every((s) => /^[A-H]([1-9]|10)$/.test(s))) return bad(res, 'Invalid seat selection.')
  const me = db.prepare('select email from users where id = ?').get(req.user.id)
  const ref = 'VS-' + Math.random().toString(36).slice(2, 8).toUpperCase()
  const add = db.prepare('insert into bookings (showtime_id, user_id, seat, customer_name, customer_email, booking_ref) values (?,?,?,?,?,?)')
  try {
    db.transaction(() => { for (const s of uniq) add.run(show.id, req.user.id, s, customer_name.trim(), me.email, ref) })()
  } catch (e) {
    if (isConstraintError(e)) return bad(res, 'Someone just booked one of those seats. The map is updated, so choose again.', 409)
    throw e
  }
  res.status(201).json({ ref, seats: uniq, total: uniq.length * show.price })
}))

const ownerOrAdmin = (req, row) => row && (row.user_id === req.user.id || req.user.role === 'admin')

app.delete('/api/bookings/ref/:ref', wrap((req, res) => {   // cancel a whole booking
  const rows = db.prepare('select * from bookings where booking_ref = ?').all(req.params.ref)
  if (!rows.length || !rows.every((r) => ownerOrAdmin(req, r))) return bad(res, 'Booking not found.', 404)
  db.prepare('delete from bookings where booking_ref = ?').run(req.params.ref)
  res.json({ ok: true })
}))
app.delete('/api/bookings/:id', wrap((req, res) => {         // cancel one seat
  const row = db.prepare('select * from bookings where id = ?').get(req.params.id)
  if (!ownerOrAdmin(req, row)) return bad(res, 'Booking not found.', 404)
  db.prepare('delete from bookings where id = ?').run(req.params.id)
  res.json({ ok: true })
}))
// update the name on a booking (all seats in the reference)
app.put('/api/bookings/ref/:ref', wrap((req, res) => {
  const name = String(req.body.customer_name || '').trim()
  if (name.length < 2) return bad(res, 'Enter the name for the booking.')
  const rows = db.prepare('select * from bookings where booking_ref = ?').all(req.params.ref)
  if (!rows.length || !rows.every((r) => ownerOrAdmin(req, r))) return bad(res, 'Booking not found.', 404)
  db.prepare('update bookings set customer_name = ? where booking_ref = ?').run(name, req.params.ref)
  res.json({ ok: true })
}))

// ====================== WAITLIST (FIFO queue) ======================
const waitSelect = `select w.*, s.starts_at, s.hall, m.title
  from waitlist w join showtimes s on s.id = w.showtime_id join movies m on m.id = s.movie_id`
const waitOut = (r) => { const { starts_at, hall, title, ...w } = r; return { ...w, showtimes: { starts_at, hall, movies: { title } } } }

app.get('/api/waitlist', requireAdmin, wrap((req, res) => {
  res.json(db.prepare(`${waitSelect} order by w.created_at, w.id`).all().map(waitOut))
}))
app.post('/api/waitlist', wrap((req, res) => {
  const me = db.prepare('select email from users where id = ?').get(req.user.id)
  if (!db.prepare('select 1 from showtimes where id = ?').get(req.body.showtime_id)) return bad(res, 'Showtime not found.', 404)
  try {
    db.prepare('insert into waitlist (showtime_id, user_id, email) values (?,?,?)').run(req.body.showtime_id, req.user.id, me.email)
  } catch (e) {
    if (isConstraintError(e)) return bad(res, "You're already on the waitlist.", 409)
    throw e
  }
  res.status(201).json({ ok: true })
}))
app.delete('/api/waitlist/:id', requireAdmin, wrap((req, res) => {
  db.prepare('delete from waitlist where id = ?').run(req.params.id)
  res.json({ ok: true })
}))

// ====================== DASHBOARD STATS ======================
app.get('/api/stats', requireAdmin, wrap((req, res) => {
  const one = (sql, ...a) => db.prepare(sql).get(...a)
  const now = new Date().toISOString()
  res.json({
    movies: one('select count(*) n from movies').n,
    showtimes: one('select count(*) n from showtimes').n,
    upcoming: one('select count(*) n from showtimes where starts_at >= ?', now).n,
    users: one("select count(*) n from users where role = 'user'").n,
    tickets: one('select count(*) n from bookings').n,
    reservations: one('select count(distinct booking_ref) n from bookings').n,
    revenue: one('select coalesce(sum(s.price),0) n from bookings b join showtimes s on s.id = b.showtime_id').n,
    waitlist: one('select count(*) n from waitlist').n,
    byMovie: db.prepare(`select m.title, count(b.id) tickets, coalesce(sum(s.price),0) revenue
      from movies m left join showtimes s on s.movie_id = m.id left join bookings b on b.showtime_id = s.id
      group by m.id order by tickets desc, m.title`).all(),
    recent: db.prepare(`${bookingSelect} order by b.created_at desc, b.id desc limit 5`).all().map(bookingOut),
  })
}))

app.use('/api', (req, res) => bad(res, 'Not found.', 404))

// In production (npm run build, then npm start) Express also serves the React app
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Velvet Seat API running on http://localhost:${PORT}`))
