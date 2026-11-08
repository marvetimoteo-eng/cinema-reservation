# Velvet Seat Cinema: DSA documentation

**Stack:** React (Vite) · Express.js REST API · SQLite (built-in node:sqlite) · JWT login with bcrypt password hashing

## Data structures (5)
| Data structure | Where it is used | Why it was chosen |
|---|---|---|
| **Queue (FIFO)** | Waitlist per sold-out showtime (`Admin > Waitlist`, `dsa.js`) | The first person to join must be served first, which is exactly FIFO order. |
| **Stack (LIFO)** | "Undo last pick" in the seat picker; "My tickets" shows the newest booking on top | Undo always reverses the most recent action, and history is read newest-first. |
| **Binary Search Tree** | Movie search (customer and admin pages) | Keys are lower-case title words; a prefix search prunes whole branches instead of scanning every movie. |
| **2D array (matrix)** | Seat map: 8 rows × 10 columns of taken/free | Rows and columns map directly to seat letters and numbers and to the sliding-window algorithm. |
| **Hash Set** | Set of taken seat IDs | Checking whether seat "C7" is taken is O(1) while rendering 80 seats. |

## Algorithms (4)
| Algorithm | Where it is used | Complexity |
|---|---|---|
| **Merge sort** | Sorting movies (rating, title, duration, year) and bookings (newest, reference, name, seat) | O(n log n), stable |
| **BST prefix search / in-order pruning** | Searching movies by title while typing | O(h + k) |
| **Binary search** | Admin finds a booking by reference in a list sorted by reference; the UI shows the number of steps | O(log n) |
| **Sliding window** | "Suggest best seats": finds N adjacent free seats closest to the centre | O(rows × cols) |

## Required system features
- **Add / update / delete / display:** movies and showtimes (admin, full CRUD); bookings (users book and cancel; admin edits the name and cancels); waitlist (join / serve next). The admin **Dashboard** tab shows live totals from `GET /api/stats`.
- **Search and sort:** see above.
- **Data validation:** checked in the browser and again on the Express server: email format, password length, name, movie fields (year, rating 0-10, duration), showtime (date, hall, price > 0), seat format and limit (8), plus database CHECK, UNIQUE and FOREIGN KEY constraints.
- **Persistent storage:** SQLite file `server/cinema.db`. `unique (showtime_id, seat)` stops double booking, and seats are inserted inside a transaction so a booking is all-or-nothing.
- **Security:** passwords are hashed with bcrypt; every API route except login/register needs a JWT; write routes for movies, showtimes, waitlist and stats use an admin-only middleware; users can only see and cancel their own bookings.
