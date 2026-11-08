import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { buildMovieTree, mergeSort, binarySearch, Queue } from './dsa.js'
import { dayLabel, timeFmt, peso, hm } from './util.js'

export default function Admin() {
  const [tab, setTab] = useState('dashboard')
  const tabs = ['dashboard', 'movies', 'showtimes', 'bookings', 'waitlist']
  return (
    <section>
      <h1>Admin</h1>
      <div className="chips tabs">{tabs.map((t) => <button key={t} className={`chip ${t === tab ? 'on' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'movies' && <Movies />}
      {tab === 'showtimes' && <Showtimes />}
      {tab === 'bookings' && <Bookings />}
      {tab === 'waitlist' && <Waitlist />}
    </section>
  )
}

const emptyMovie = { title: '', year: '', rating: '', genres: '', duration_min: '', poster_url: '/posters/' }

function Movies() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('title')
  const [form, setForm] = useState(null)
  const [err, setErr] = useState('')
  const load = async () => setRows(await api.get('/api/movies').catch(() => []))
  useEffect(() => { load() }, [])

  const tree = useMemo(() => buildMovieTree(rows), [rows])              // BST
  const visible = useMemo(() => {
    const base = q.trim() ? [...new Set(tree.prefixSearch(q.trim().toLowerCase()))] : rows
    const cmp = { title: (a, b) => a.title.localeCompare(b.title), rating: (a, b) => b.rating - a.rating, duration_min: (a, b) => a.duration_min - b.duration_min, year: (a, b) => b.year - a.year }[sort]
    return mergeSort(base, cmp)                                         // Merge sort
  }, [rows, q, sort, tree])

  const validate = (f) => {
    if (!f.title.trim() || f.title.length > 100) return 'Title is required (max 100 characters).'
    if (!(+f.year >= 1888 && +f.year <= 2100)) return 'Year must be between 1888 and 2100.'
    if (!(f.rating !== '' && +f.rating >= 0 && +f.rating <= 10)) return 'Rating must be 0 to 10.'
    if (!f.genres.split(',').some((g) => g.trim())) return 'Add at least one genre (comma separated).'
    if (!(+f.duration_min > 0 && +f.duration_min <= 600)) return 'Duration must be 1 to 600 minutes.'
    if (!f.poster_url.trim()) return 'Poster path is required.'
    return ''
  }
  const save = async (e) => {
    e.preventDefault()
    const v = validate(form); if (v) return setErr(v)
    const body = { title: form.title.trim(), year: +form.year, rating: +form.rating, genres: form.genres.split(',').map((g) => g.trim()).filter(Boolean), duration_min: +form.duration_min, poster_url: form.poster_url.trim() }
    try { await (form.id ? api.put(`/api/movies/${form.id}`, body) : api.post('/api/movies', body)) } catch (e) { return setErr(e.message) }
    setForm(null); setErr(''); load()
  }
  const del = async (m) => { if (confirm(`Delete "${m.title}" and all its showtimes and bookings?`)) { await api.del(`/api/movies/${m.id}`).catch((e) => alert(e.message)); load() } }

  return (
    <div>
      <div className="toolbar">
        <input placeholder="Search title (BST)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          <option value="title">Sort: Title</option><option value="rating">Sort: Rating</option><option value="duration_min">Sort: Duration</option><option value="year">Sort: Year</option>
        </select>
        <button className="primary" onClick={() => { setForm(emptyMovie); setErr('') }}>Add movie</button>
      </div>
      {form && (
        <form className="panel grid2" onSubmit={save}>
          <h3>{form.id ? 'Edit movie' : 'New movie'}</h3>
          {[['title', 'Title'], ['year', 'Year'], ['rating', 'Rating (0-10)'], ['genres', 'Genres (comma separated)'], ['duration_min', 'Duration (minutes)'], ['poster_url', 'Poster path or URL']].map(([k, l]) => (
            <label key={k}>{l}<input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
          ))}
          {err && <p className="banner err">{err}</p>}
          <div className="inline"><button className="primary">Save</button><button type="button" className="link" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <div className="tablewrap"><table>
        <thead><tr><th>Title</th><th>Year</th><th>Rating</th><th>Genres</th><th>Length</th><th></th></tr></thead>
        <tbody>{visible.map((m) => (
          <tr key={m.id}><td>{m.title}</td><td>{m.year}</td><td>{m.rating}</td><td>{m.genres.join(' · ')}</td><td>{hm(m.duration_min)}</td>
            <td className="act"><button className="link" onClick={() => { setForm({ ...m, genres: m.genres.join(', ') }); setErr('') }}>Edit</button><button className="link danger" onClick={() => del(m)}>Delete</button></td></tr>
        ))}</tbody>
      </table></div>
    </div>
  )
}

function Showtimes() {
  const [movies, setMovies] = useState([])
  const [mid, setMid] = useState('')
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/api/movies').then((data) => { data.sort((a, b) => a.title.localeCompare(b.title)); setMovies(data); if (data.length) setMid(String(data[0].id)) }).catch(() => {}) }, [])
  const load = async () => mid && setRows(await api.get(`/api/showtimes?movie_id=${mid}`).catch(() => []))
  useEffect(() => { load() }, [mid])

  const localISO = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
  const save = async (e) => {
    e.preventDefault()
    if (!form.starts_at || isNaN(new Date(form.starts_at))) return setErr('Pick a valid date and time.')
    if (!form.hall.trim()) return setErr('Hall is required.')
    if (!(+form.price > 0)) return setErr('Price must be greater than 0.')
    const body = { movie_id: +mid, starts_at: new Date(form.starts_at).toISOString(), hall: form.hall.trim(), price: +form.price }
    try { await (form.id ? api.put(`/api/showtimes/${form.id}`, body) : api.post('/api/showtimes', body)) } catch (e) { return setErr(e.message) }
    setForm(null); setErr(''); load()
  }
  const del = async (s) => { if (confirm('Delete this showtime and its bookings?')) { await api.del(`/api/showtimes/${s.id}`).catch((e) => alert(e.message)); load() } }

  return (
    <div>
      <div className="toolbar">
        <select value={mid} onChange={(e) => setMid(e.target.value)} aria-label="Movie">{movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
        <button className="primary" onClick={() => { setForm({ starts_at: '', hall: 'Hall 1', price: 350 }); setErr('') }}>Add showtime</button>
      </div>
      {form && (
        <form className="panel grid2" onSubmit={save}>
          <label>Date and time<input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label>
          <label>Hall<input value={form.hall} onChange={(e) => setForm({ ...form, hall: e.target.value })} /></label>
          <label>Price (₱)<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          {err && <p className="banner err">{err}</p>}
          <div className="inline"><button className="primary">Save</button><button type="button" className="link" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <div className="tablewrap"><table>
        <thead><tr><th>Date</th><th>Time</th><th>Hall</th><th>Price</th><th></th></tr></thead>
        <tbody>{rows.map((s) => (
          <tr key={s.id}><td>{dayLabel(s.starts_at)}</td><td>{timeFmt(s.starts_at)}</td><td>{s.hall}</td><td>{peso(s.price)}</td>
            <td className="act"><button className="link" onClick={() => { setForm({ id: s.id, starts_at: localISO(s.starts_at), hall: s.hall, price: s.price }); setErr('') }}>Edit</button><button className="link danger" onClick={() => del(s)}>Delete</button></td></tr>
        ))}</tbody>
      </table></div>
    </div>
  )
}

function Bookings() {
  const [rows, setRows] = useState([])
  const [sort, setSort] = useState('created_at')
  const [ref, setRef] = useState('')
  const [found, setFound] = useState(null)
  const load = async () => setRows(await api.get('/api/bookings?scope=all').catch(() => []))
  useEffect(() => { load() }, [])

  const sorted = useMemo(() => {
    const cmp = { created_at: (a, b) => b.created_at.localeCompare(a.created_at), booking_ref: (a, b) => a.booking_ref.localeCompare(b.booking_ref), customer_name: (a, b) => a.customer_name.localeCompare(b.customer_name), seat: (a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true }) }[sort]
    return mergeSort(rows, cmp)                                           // Merge sort
  }, [rows, sort])

  const search = (e) => {
    e.preventDefault()
    const target = ref.trim().toUpperCase(); if (!target) return setFound(null)
    const byRef = mergeSort(rows, (a, b) => (a.booking_ref < b.booking_ref ? -1 : a.booking_ref > b.booking_ref ? 1 : 0))
    const { index, steps } = binarySearch(byRef, target, (r) => r.booking_ref)   // Binary search
    if (index < 0) return setFound({ rows: [], steps })
    let lo = index, hi = index
    while (lo > 0 && byRef[lo - 1].booking_ref === target) lo--
    while (hi < byRef.length - 1 && byRef[hi + 1].booking_ref === target) hi++
    setFound({ rows: byRef.slice(lo, hi + 1), steps })
  }
  const cancel = async (b) => { if (confirm(`Cancel seat ${b.seat} (${b.booking_ref})?`)) { await api.del(`/api/bookings/${b.id}`).catch((e) => alert(e.message)); setFound(null); load() } }
  const rename = async (b) => {
    const name = prompt(`New name for booking ${b.booking_ref}:`, b.customer_name)
    if (name === null) return
    try { await api.put(`/api/bookings/ref/${b.booking_ref}`, { customer_name: name }); setFound(null); load() } catch (e) { alert(e.message) }
  }
  const list = found ? found.rows : sorted

  return (
    <div>
      <form className="toolbar" onSubmit={search}>
        <input placeholder="Find by reference, e.g. VS-AB12CD" value={ref} onChange={(e) => setRef(e.target.value)} />
        <button className="primary">Search</button>
        {found && <button type="button" className="link" onClick={() => { setFound(null); setRef('') }}>Clear</button>}
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          <option value="created_at">Sort: Newest</option><option value="booking_ref">Sort: Reference</option><option value="customer_name">Sort: Name</option><option value="seat">Sort: Seat</option>
        </select>
      </form>
      {found && <p className="muted">{found.rows.length ? `Found ${found.rows.length} seat(s)` : 'No booking with that reference'} using binary search in {found.steps} step(s).</p>}
      <div className="tablewrap"><table>
        <thead><tr><th>Ref</th><th>Movie</th><th>Showtime</th><th>Seat</th><th>Customer</th><th></th></tr></thead>
        <tbody>{list.map((b) => (
          <tr key={b.id}><td>{b.booking_ref}</td><td>{b.showtimes?.movies?.title}</td><td>{b.showtimes && `${dayLabel(b.showtimes.starts_at)} ${timeFmt(b.showtimes.starts_at)}`}</td><td>{b.seat}</td><td>{b.customer_name}<br /><span className="muted small">{b.customer_email}</span></td>
            <td className="act"><button className="link" onClick={() => rename(b)}>Edit name</button><button className="link danger" onClick={() => cancel(b)}>Cancel</button></td></tr>
        ))}</tbody>
      </table></div>
    </div>
  )
}

function Waitlist() {
  const [groups, setGroups] = useState([])
  const load = async () => {
    const data = await api.get('/api/waitlist').catch(() => [])
    const by = {}
    ;(data || []).forEach((w) => { (by[w.showtime_id] ||= new Queue()).enqueue(w) })   // one FIFO queue per showtime
    setGroups(Object.values(by))
  }
  useEffect(() => { load() }, [])
  const dequeue = async (q) => {
    const front = q.dequeue()
    alert(`Notify ${front.email}: a seat may be available.`)
    await api.del(`/api/waitlist/${front.id}`).catch((e) => alert(e.message)); load()
  }
  return (
    <div>
      {!groups.length && <p className="muted">No one is on a waitlist. Waitlists open when a showtime sells out.</p>}
      {groups.map((q) => { const s = q.peek().showtimes; return (
        <div className="panel" key={q.peek().showtime_id}>
          <h3>{s.movies.title} · {dayLabel(s.starts_at)} {timeFmt(s.starts_at)}</h3>
          <ol>{q.toArray().map((w) => <li key={w.id}>{w.email}</li>)}</ol>
          <button className="primary" onClick={() => dequeue(q)}>Serve next in line</button>
        </div>) })}
    </div>
  )
}

function Dashboard() {
  const [st, setSt] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/api/stats').then(setSt).catch((e) => setErr(e.message)) }, [])
  if (err) return <p className="banner err">{err}</p>
  if (!st) return <p className="muted">Loading dashboard…</p>
  const cards = [
    ['Movies', st.movies], ['Upcoming showtimes', st.upcoming], ['Tickets sold', st.tickets],
    ['Reservations', st.reservations], ['Revenue', peso(st.revenue)], ['Customers', st.users], ['On waitlist', st.waitlist],
  ]
  const max = Math.max(1, ...st.byMovie.map((m) => m.tickets))
  return (
    <div>
      <div className="stats">{cards.map(([label, value]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="panel">
        <h3>Tickets sold per movie</h3>
        {st.byMovie.map((m) => (
          <div className="barrow" key={m.title}>
            <span className="barlabel">{m.title}</span>
            <div className="bar"><i style={{ width: `${(m.tickets / max) * 100}%` }} /></div>
            <span className="barval">{m.tickets} · {peso(m.revenue)}</span>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Latest bookings</h3>
        {!st.recent.length && <p className="muted">No bookings yet.</p>}
        {st.recent.map((b) => <p key={b.id} className="muted">{b.booking_ref} · {b.showtimes.movies.title} · seat {b.seat} · {b.customer_name}</p>)}
      </div>
    </div>
  )
}
