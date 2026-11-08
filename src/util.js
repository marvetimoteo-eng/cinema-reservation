export const ROWS = 'ABCDEFGH'.split('')
export const COLS = Array.from({ length: 10 }, (_, i) => i + 1)
export const hm = (m) => `${Math.floor(m / 60)}h ${m % 60}m`
export const timeFmt = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
export const dayKey = (iso) => new Date(iso).toDateString()
export const dayLabel = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
export const peso = (n) => `₱${Number(n).toLocaleString()}`
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
