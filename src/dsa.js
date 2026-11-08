// ===== DATA STRUCTURES =====

// Stack (LIFO): undo seat picks, booking history (newest on top)
export class Stack {
  constructor(items = []) { this.items = [...items] }
  push(x) { this.items.push(x); return this }
  pop() { return this.items.pop() }
  peek() { return this.items[this.items.length - 1] }
  get size() { return this.items.length }
}

// Queue (FIFO): waitlist for sold-out showtimes
export class Queue {
  constructor(items = []) { this.items = [...items]; this.head = 0 }
  enqueue(x) { this.items.push(x); return this }
  dequeue() { return this.items[this.head++] }
  peek() { return this.items[this.head] }
  get size() { return this.items.length - this.head }
  toArray() { return this.items.slice(this.head) }
}

// Binary Search Tree: movie title search (keys are lower-case title words)
class Node { constructor(key, val) { this.key = key; this.val = val; this.l = null; this.r = null } }
export class BST {
  constructor() { this.root = null }
  insert(key, val) {
    const n = new Node(key, val)
    if (!this.root) { this.root = n; return }
    let c = this.root
    for (;;) {
      if (key < c.key) { if (!c.l) { c.l = n; return } c = c.l }
      else { if (!c.r) { c.r = n; return } c = c.r }
    }
  }
  // all values whose key starts with prefix; prunes branches that cannot match
  prefixSearch(p) {
    const out = []
    const walk = (n) => {
      if (!n) return
      const pre = n.key.slice(0, p.length)
      if (p <= pre) walk(n.l)
      if (pre === p) out.push(n.val)
      if (p >= pre) walk(n.r)
    }
    walk(this.root)
    return out
  }
}
export function buildMovieTree(movies) {
  const t = new BST()
  movies.forEach((m) => m.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => t.insert(w, m)))
  return t
}

// 2D array (matrix) of taken seats is built in Booking.jsx; Hash Set/Map are used for O(1) lookups.

// ===== ALGORITHMS =====

// Merge sort, O(n log n), stable
export function mergeSort(arr, cmp) {
  if (arr.length < 2) return arr
  const mid = arr.length >> 1
  const a = mergeSort(arr.slice(0, mid), cmp), b = mergeSort(arr.slice(mid), cmp)
  const out = []
  let i = 0, j = 0
  while (i < a.length && j < b.length) out.push(cmp(a[i], b[j]) <= 0 ? a[i++] : b[j++])
  return out.concat(a.slice(i), b.slice(j))
}

// Binary search on an array sorted by keyFn, O(log n). Returns index (or -1) and number of steps.
export function binarySearch(sorted, target, keyFn) {
  let lo = 0, hi = sorted.length - 1, steps = 0
  while (lo <= hi) {
    steps++
    const mid = (lo + hi) >> 1, k = keyFn(sorted[mid])
    if (k === target) return { index: mid, steps }
    if (k < target) lo = mid + 1; else hi = mid - 1
  }
  return { index: -1, steps }
}

// Sliding window: best n adjacent free seats (closest to the screen centre/middle rows). O(rows*cols)
export function bestSeats(grid, n) {
  const R = grid.length, C = grid[0].length
  let best = null
  for (let r = 0; r < R; r++) {
    let taken = 0
    for (let c = 0; c < C; c++) {
      taken += grid[r][c] ? 1 : 0
      if (c >= n) taken -= grid[r][c - n] ? 1 : 0
      if (c >= n - 1 && taken === 0) {
        const start = c - n + 1
        const score = Math.abs(start + (n - 1) / 2 - (C - 1) / 2) + Math.abs(r - R * 0.6)
        if (!best || score < best.score) best = { r, start, score }
      }
    }
  }
  return best ? Array.from({ length: n }, (_, i) => [best.r, best.start + i]) : null
}
