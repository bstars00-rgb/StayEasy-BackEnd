// Boots the backend (SQLite fallback) and exercises the contract the GitHub
// Pages frontend + /admin/ console rely on. Gates the Render deploy hook.
// Responses are bare JSON (no envelope), matching server.js.
import { spawn } from 'node:child_process'

const port = 8799
const base = `http://localhost:${port}/api/v1`
const child = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(port),
    SQLITE_PATH: '.data/smoke.sqlite',
    ADMIN_EMAILS: 'demo.user@gmail.com',
    OPERATOR_EMAILS: 'operator@ohmyselect.local',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stderr.on('data', (d) => process.stderr.write(d))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const assert = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`) }
const jget = async (path, token) => fetch(`${base}${path}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
const jpost = async (path, body, token) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })

const signIn = async (credential) => (await (await jpost('/auth/google', { credential })).json())

// Next Saturday ~2 weeks out (deterministic future weekend) for the weekday-only voucher test.
function futureSaturday() {
  const d = new Date(); d.setDate(d.getDate() + 14)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

try {
  // Wait for boot + seed.
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`${base}/health`)).ok) break } catch {} await wait(250) }

  const health = await (await jget('/health')).json()
  assert(health.ok === true, 'health ok')
  console.log(`  persistence: ${health.persistence}`)

  const memberships = await (await jget('/memberships')).json()
  assert(Array.isArray(memberships) && memberships.some((m) => m.id === 'club-marriott-vietnam'), 'memberships seeded')

  const detail = await (await jget('/memberships/hilton-honors-vietnam')).json()
  assert(Array.isArray(detail.vouchers) && detail.vouchers.length > 0, 'membership detail has vouchers')

  // Public availability read.
  assert((await jget('/vouchers/cm-fnb50/availability')).status === 200, 'public availability 200')

  // Admin role + dashboard.
  const admin = await signIn('demo-google-user')
  assert(admin.user?.role === 'admin', 'admin role on demo-google-user')
  assert((await jget('/admin/dashboard', admin.accessToken)).status === 200, 'admin dashboard 200')

  // Operator role: read allowed, catalog write forbidden.
  const operator = await signIn('operator@ohmyselect.local')
  assert(operator.user?.role === 'operator', 'operator role')
  assert((await jget('/admin/dashboard', operator.accessToken)).status === 200, 'operator dashboard 200')
  assert((await jpost('/admin/memberships', { id: 'x', name: 'X', brand: 'X' }, operator.accessToken)).status === 403, 'operator catalog write 403')

  // Voucher i18n round-trips into the consumer catalog.
  const created = await jpost('/admin/memberships/hilton-honors-vietnam/vouchers',
    { templateId: 'smoke-i18n', title: 'Smoke EN', category: 'dining', quantity: 2, validUntil: '2026-12-31', i18n: { ko: { title: '스모크 한글' } } }, admin.accessToken)
  assert(created.status === 201, 'voucher create 201')
  const detail2 = await (await jget('/memberships/hilton-honors-vietnam')).json()
  const mine = (detail2.vouchers || []).find((v) => v.templateId === 'smoke-i18n')
  assert(mine?.i18n?.ko?.title === '스모크 한글', 'voucher i18n round-trips to /memberships/:id')

  // Server-side reservation availability: weekday-only voucher on a Saturday → 409.
  await jpost('/wallet/memberships', { membershipId: 'club-marriott-vietnam' }, admin.accessToken)
  const res = await jpost('/reservations',
    { membershipId: 'club-marriott-vietnam', templateId: 'cm-fnb50', date: futureSaturday(), adults: 2, children: 0, childAges: [], hotel: 'x' }, admin.accessToken)
  assert(res.status === 409, 'weekday-only voucher on Saturday rejected (409)')
  assert((await res.json()).code === 'DATE_NOT_AVAILABLE', 'DATE_NOT_AVAILABLE code')

  console.log('smoke test passed ✓')
} catch (err) {
  console.error(err?.message || err)
  child.kill('SIGTERM')
  process.exit(1)
} finally {
  child.kill('SIGTERM')
}
