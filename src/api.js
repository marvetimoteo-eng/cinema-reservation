// Small helper for talking to the Express backend (/api/...).
const KEY = 'velvet_token'
export const getToken = () => { try { return localStorage.getItem(KEY) } catch { return null } }
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch { /* ignore */ } }

async function request(method, url, body) {
  const headers = { 'Content-Type': 'application/json' }
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`
  let res
  try { res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }) }
  catch { throw new Error('Cannot reach the server. Is it running (npm run dev)?') }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; throw e }
  return data
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b),
  put: (u, b) => request('PUT', u, b),
  del: (u) => request('DELETE', u),
}
