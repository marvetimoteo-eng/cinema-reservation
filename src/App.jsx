import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import AuthGate from './Auth.jsx'
import Admin from './Admin.jsx'
import { SeatPicker, MyTickets } from './Booking.jsx'
import { buildMovieTree, mergeSort } from './dsa.js'
import { hm, timeFmt, dayKey, dayLabel, peso } from './util.js'

export default function App() {
  return <AuthGate>{({ profile, signOut }) => <Shell profile={profile} signOut={signOut} />}</AuthGate>
}

function Shell({ profile, signOut }) {
  const [movies, setMovies] = useState([])
  const [showtimes, setShowtimes] = useState([])
  const [view, setView] = useState('browse')
  const [movie, setMovie] = useState(null)
  const [showtime, setShowtime] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [mine, setMine] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('default')
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([api.get('/api/movies'), api.get('/api/showtimes?upcoming=1')])
        setMovies(m); setShowtimes(s); setError('')
      } catch (e) { setError(e.message) }
    })()
  }, [view])

  const tree = useMemo(() => buildMovieTree(movies), [movies])                 // BST
  const shown = useMemo(() => {
    const base = q.trim() ? [...new Set(tree.prefixSearch(q.trim().toLowerCase()))] : movies
    const cmp = { rating: (a, b) => b.rating - a.rating, title: (a, b) => a.title.localeCompare(b.title), duration_min: (a, b) => a.duration_min - b.duration_min }[sort]
    return cmp ? mergeSort(base, cmp) : base                                     // Merge sort
  }, [movies, q, sort, tree])

  const back = () => { setView('browse'); setShowtime(null); setMovie(null); setTicket(null) }

  return (
    <div className="app">
      <header className="top">
        <button className="brand" onClick={back} aria-label="Back to all movies">Velvet Seat</button>
        <nav>
          {profile.role === 'admin' && <button className="link" onClick={() => setView(view === 'admin' ? 'browse' : 'admin')}>{view === 'admin' ? 'Movies' : 'Admin'}</button>}
          <button className="link" onClick={() => setMine(true)}>My tickets</button>
          <span className="who">{profile.email}{profile.role === 'admin' && <b className="tag">admin</b>}</span>
          <button className="link" onClick={signOut}>Sign out</button>
        </nav>
      </header>
      {error && <p className="banner err">Could not load data: {error}</p>}

      {view === 'admin' ? <Admin /> : ticket ? <TicketView ticket={ticket} onDone={back} /> : showtime ? (
        <SeatPicker movie={movie} showtime={showtime} profile={profile} onBack={() => setShowtime(null)} onBooked={setTicket} />
      ) : movie ? (
        <MovieDetail movie={movie} showtimes={showtimes.filter((s) => s.movie_id === movie.id)} onPick={setShowtime} onBack={() => setMovie(null)} />
      ) : (
        <>
          <section className="hero">
            <h1>Tonight, pick your seat.</h1>
            <p>Choose a movie, choose a time, and hold your exact seat in under a minute.</p>
          </section>
          <div className="toolbar">
            <input placeholder="Search movies…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search movies" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort movies">
              <option value="default">Sort: Default</option><option value="rating">Highest rated</option><option value="title">Title A-Z</option><option value="duration_min">Shortest first</option>
            </select>
          </div>
          <section className="grid">
            {shown.map((m) => (
              <button key={m.id} className="card" onClick={() => setMovie(m)}>
                <img src={m.poster_url} alt={`${m.title} poster`} loading="lazy" />
                <div className="card-body">
                  <h2>{m.title}</h2>
                  <div className="meta"><span className="rating">★ {m.rating}</span><span>{hm(m.duration_min)}</span></div>
                  <div className="genres">{m.genres.map((g) => <span key={g}>{g}</span>)}</div>
                </div>
              </button>
            ))}
            {!shown.length && <p className="muted">No movies match "{q}".</p>}
          </section>
        </>
      )}
      {mine && <MyTickets onClose={() => setMine(false)} />}
    </div>
  )
}

function MovieDetail({ movie, showtimes, onPick, onBack }) {
  const days = useMemo(() => [...new Set(showtimes.map((s) => dayKey(s.starts_at)))], [showtimes])
  const [day, setDay] = useState(days[0])
  const active = day || days[0]
  return (
    <section className="detail">
      <button className="link" onClick={onBack}>Back to movies</button>
      <div className="detail-grid">
        <img className="poster" src={movie.poster_url} alt={`${movie.title} poster`} />
        <div>
          <h1>{movie.title}</h1>
          <div className="meta big"><span className="rating">★ {movie.rating}</span><span>{hm(movie.duration_min)}</span><span>{movie.year}</span></div>
          <div className="genres">{movie.genres.map((g) => <span key={g}>{g}</span>)}</div>
          <h3>Pick a date</h3>
          <div className="chips">
            {days.map((d) => (
              <button key={d} className={`chip ${d === active ? 'on' : ''}`} onClick={() => setDay(d)}>{dayLabel(d)}</button>
            ))}
          </div>
          <h3>Pick a showtime</h3>
          <div className="chips">
            {showtimes.filter((s) => dayKey(s.starts_at) === active).map((s) => (
              <button key={s.id} className="slot" onClick={() => onPick(s)}>
                <strong>{timeFmt(s.starts_at)}</strong>
                <span>{s.hall} · {peso(s.price)}</span>
              </button>
            ))}
            {days.length === 0 && <p className="muted">No upcoming showtimes for this movie yet.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

function TicketView({ ticket, onDone }) {
  const { movie, showtime, seats, ref, name, total } = ticket
  return (
    <section className="done">
      <h1>You're booked, {name.split(' ')[0]}.</h1>
      <p className="muted">Show this ticket at the entrance. Look it up later with your email.</p>
      <div className="stub">
        <img src={movie.poster_url} alt="" />
        <div className="stub-main">
          <h2>{movie.title}</h2>
          <p>{dayLabel(showtime.starts_at)} · {timeFmt(showtime.starts_at)}</p>
          <p>{showtime.hall}</p>
          <p className="big-seats">Seats {[...seats].sort().join(', ')}</p>
          <p className="muted">Total {peso(total)} (pay at the counter)</p>
        </div>
        <div className="stub-tear"><span>Ref</span><strong>{ref}</strong></div>
      </div>
      <button className="primary" onClick={onDone}>Book another movie</button>
    </section>
  )
}

