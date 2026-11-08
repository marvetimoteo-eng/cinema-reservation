# Velvet Seat Cinema – Dashboard Application (React + Express.js + SQLite)

A cinema reservation system with a customer side (browse movies, pick seats, book, cancel) and an **admin dashboard** with full **CRUD** (Create, Read, Update, Delete).

- **Frontend:** React (Vite)
- **Backend:** Express.js REST API (`server/`)
- **Database:** SQLite (`server/cinema.db`, created and seeded automatically on first run)
- **Login:** email + password, JWT tokens, passwords hashed with bcrypt

## Requirements
Node.js 22.13 or newer (https://nodejs.org). The database uses the SQLite built into Node, so nothing needs compiling.

## Run it (development)
```bash
npm install
npm run dev
```
Open **http://localhost:5173**. The Express API runs on port 3001 (the React app forwards `/api` calls to it automatically).

## Run it (production mode, one server)
```bash
npm run build
npm start
```
Open **http://localhost:3001**.

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Admin | `admin@velvetseat.com` | `admin12345` |
| Customer | Click **Create an account** | any (8+ characters) |

Log in as admin and click **Admin** in the header to open the dashboard.

## Dashboard (admin)
- **Dashboard** tab: totals (movies, upcoming showtimes, tickets sold, reservations, revenue, customers, waitlist) and tickets per movie.
- **Movies**: add, edit, delete, search, sort.
- **Showtimes**: add, edit, delete per movie.
- **Bookings**: view, search by reference, edit customer name, cancel.
- **Waitlist**: view the queue and serve the next person.

## REST API
| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/auth/me` | logged in |
| GET / POST / PUT / DELETE | `/api/movies`, `/api/movies/:id` | read: logged in, write: admin |
| GET / POST / PUT / DELETE | `/api/showtimes`, `/api/showtimes/:id` | read: logged in, write: admin |
| GET | `/api/showtimes/:id/seats` | logged in |
| GET / POST | `/api/bookings` | logged in (own bookings; admin sees all with `?scope=all`) |
| PUT / DELETE | `/api/bookings/ref/:ref`, DELETE `/api/bookings/:id` | owner or admin |
| GET / DELETE | `/api/waitlist`, `/api/waitlist/:id` | admin |
| POST | `/api/waitlist` | logged in |
| GET | `/api/stats` | admin |

## Optional settings
Copy `.env.example` to `.env` to change the port or set your own `JWT_SECRET`. To reset the database, stop the server and delete `server/cinema.db`.

See `DOCS.md` for the data structures and algorithms used.
