import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export const signToken = (user) => jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '8h' })

// Middleware: requires a valid "Authorization: Bearer <token>" header
export function requireAuth(req, res, next) {
  const h = req.headers.authorization || ''
  try {
    req.user = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Please log in.' })
  }
}

// Middleware: admin only
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' })
  next()
}
