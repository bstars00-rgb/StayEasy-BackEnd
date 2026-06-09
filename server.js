import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { URL } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const PORT = Number(process.env.PORT || 8787)
const API_PREFIX = '/api/v1'
const DB_KEY = 'stayeasy-prototype-state-v1'

const cities = [
  { id: 'ho-chi-minh', country: 'vietnam' },
  { id: 'da-nang', country: 'vietnam' },
  { id: 'hanoi', country: 'vietnam' },
  { id: 'seoul', country: 'korea' },
  { id: 'bangkok', country: 'thailand' },
]

let memberships = [
  { id: 'club-marriott-vietnam', name: 'Club Marriott Vietnam', brand: 'Marriott', country: 'vietnam', cities: ['ho-chi-minh', 'da-nang', 'hanoi'], hotels: ['Sheraton Saigon Grand Opera Hotel', 'Le Meridien Saigon'], annualFee: 4500000, salePrice: 4200000, currency: 'VND', commissionRate: 0.12, diningDiscount: 50, roomDiscount: 20, freeNight: false, spaBenefit: true, benefits: ['Up to 50% off food for up to 4 diners', 'Up to 20% off room rates', '20% off spa treatments'], bestFor: ['familyDining', 'hotelBuffet', 'staycation'], estimatedSavings: 12000000, scores: { familyDining: 95, staycation: 80, businessTravel: 60, easeOfUse: 85, overall: 90 }, notes: 'Strong pick for hotel dining in Vietnam.', officialUrl: 'https://www.clubmarriott.asia/', active: true },
  { id: 'accor-plus-vietnam', name: 'Accor Plus Vietnam', brand: 'Accor', country: 'vietnam', cities: ['ho-chi-minh', 'da-nang', 'hanoi', 'bangkok'], hotels: ['Sofitel Saigon Plaza', 'Pullman Saigon Centre'], annualFee: 4900000, salePrice: 4500000, currency: 'VND', commissionRate: 0.12, diningDiscount: 50, roomDiscount: 10, freeNight: true, spaBenefit: false, benefits: ['One complimentary stay night every year', 'Up to 50% off dining', 'Member-only room rates'], bestFor: ['familyDining', 'staycation', 'freeNight'], estimatedSavings: 13000000, scores: { familyDining: 88, staycation: 90, businessTravel: 70, easeOfUse: 80, overall: 89 }, notes: 'Includes a free stay night.', officialUrl: 'https://www.accorplus.com/', active: true },
  { id: 'hilton-honors-vietnam', name: 'Hilton Honors Vietnam', brand: 'Hilton', country: 'vietnam', cities: ['ho-chi-minh', 'da-nang'], hotels: ['Hilton Saigon', 'Hilton Da Nang'], annualFee: 0, salePrice: null, currency: 'VND', commissionRate: 0, diningDiscount: null, roomDiscount: null, freeNight: true, spaBenefit: false, benefits: ['Free to join', 'Earn points on stays and dining', 'Exclusive member room rates'], bestFor: ['businessTravel', 'staycation', 'freeNight'], estimatedSavings: 6000000, scores: { familyDining: 55, staycation: 78, businessTravel: 90, easeOfUse: 92, overall: 84 }, notes: 'Free loyalty program.', officialUrl: 'https://www.hilton.com/en/hilton-honors/', active: true },
]

let voucherPacks = {
  'club-marriott-vietnam': [
    { templateId: 'cm-dinner', category: 'dining', title: 'Free Dinner Coupon', description: 'Set dinner benefit.', quantity: 2, validUntil: '2026-11-30', hotels: ['Sheraton Saigon Grand Opera Hotel'], city: 'ho-chi-minh', transferable: true, note: 'Reservation required.' },
    { templateId: 'cm-breakfast', category: 'dining', title: 'Breakfast for Two', description: 'Breakfast voucher.', quantity: 2, validUntil: '2026-11-30', hotels: ['Sheraton Saigon Grand Opera Hotel'], city: 'ho-chi-minh', transferable: true, note: '' },
    { templateId: 'cm-stay2', category: 'room', title: 'Complimentary Weekend Night', description: 'Room voucher.', quantity: 1, validUntil: '2026-11-30', hotels: ['Sheraton Grand Danang Resort'], city: 'da-nang', transferable: false, note: 'Blackout dates apply.' },
  ],
  'accor-plus-vietnam': [
    { templateId: 'ap-stay-night', category: 'room', title: 'Stay Plus Night', description: 'Free night.', quantity: 1, validUntil: '2026-12-31', hotels: ['Sofitel Saigon Plaza'], city: 'ho-chi-minh', transferable: false, note: 'Subject to availability.' },
    { templateId: 'ap-dining50', category: 'dining', title: 'Up to 50% Dining', description: 'Dining discount.', quantity: 8, validUntil: '2026-12-31', hotels: [], city: null, transferable: false, note: 'Weekdays only.' },
  ],
  'hilton-honors-vietnam': [
    { templateId: 'hh-member-rate', category: 'discount', title: 'Member Rate', description: 'Exclusive member rate.', quantity: 12, validUntil: '2026-12-31', hotels: ['Hilton Saigon'], city: 'ho-chi-minh', transferable: false, note: '' },
  ],
}

const usersByToken = new Map()
const usersBySubject = new Map()
const stateByUser = new Map()
const auditLogs = []
let pool = null
let persistenceError = null

function now() { return new Date().toISOString() }
function makeId(prefix) { return `${prefix}_${randomUUID().slice(0, 8)}` }
function publicMembership(m) { const paidAmount = m.salePrice ?? m.annualFee; return { ...m, paidAmount, commissionAmount: Math.round(paidAmount * (m.commissionRate || 0)) } }
function getMembership(id, includeInactive = false) { return memberships.find((m) => m.id === id && (includeInactive || m.active !== false)) }
function getVoucherPack(membershipId) { return voucherPacks[membershipId] || [] }
function getVoucherTemplate(membershipId, templateId) { return getVoucherPack(membershipId).find((v) => v.templateId === templateId) }
function headers(extra = {}) { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Max-Age': '600', ...extra } }
function send(res, status, data) { res.writeHead(status, headers()); res.end(JSON.stringify(data)) }
function sendCsv(res, filename, data) { res.writeHead(200, headers({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` })); res.end(data) }
function noContent(res) { res.writeHead(204, headers()); res.end() }
function sendError(res, status, code, message, details = {}) { send(res, status, { code, message, details }) }
function normalizePath(pathname) { const raw = pathname.replace(/\/+$/, '') || '/'; return raw.startsWith(API_PREFIX) ? raw.slice(API_PREFIX.length) || '/' : raw }
async function readBody(req) { const chunks = []; for await (const c of req) chunks.push(c); if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} } }
function userState(userId) { if (!stateByUser.has(userId)) stateByUser.set(userId, { savedMemberships: [], usage: {}, reservations: [], orders: [], transfers: [], assistance: [], seeded: false }); return stateByUser.get(userId) }
function usageKey(membershipId, templateId) { return `${membershipId}:${templateId}` }
function countTransfers(state, membershipId, templateId) { return state.transfers.filter((t) => t.membershipId === membershipId && t.templateId === templateId).length }
function countOpenReservations(state, membershipId, templateId) { return state.reservations.filter((r) => r.membershipId === membershipId && r.templateId === templateId && ['requested', 'confirmed'].includes(r.status)).length }
function voucherView(state, membershipId, template) { const used = state.usage[usageKey(membershipId, template.templateId)] || 0; const held = countOpenReservations(state, membershipId, template.templateId); const transferred = countTransfers(state, membershipId, template.templateId); return { membershipId, ...template, used, held, transferred, available: Math.max(0, template.quantity - used - held - transferred) } }
function walletFor(user) { const state = userState(user.id); const owned = state.savedMemberships.map((id) => getMembership(id)).filter(Boolean).map(publicMembership); const vouchers = state.savedMemberships.flatMap((membershipId) => getVoucherPack(membershipId).map((template) => voucherView(state, membershipId, template))); return { summary: { membershipCount: owned.length, availableVoucherCount: vouchers.reduce((s, v) => s + v.available, 0), expiringSoonCount: vouchers.filter((v) => v.available > 0).length, openReservationCount: state.reservations.filter((r) => ['requested', 'confirmed'].includes(r.status)).length }, memberships: owned, vouchers, reservations: state.reservations, orders: state.orders, transfers: state.transfers } }
function allStates() { return [...stateByUser.values()] }
function allOrders() { return allStates().flatMap((s) => s.orders) }
function allReservations() { return allStates().flatMap((s) => s.reservations) }
function allAssistance() { return allStates().flatMap((s) => s.assistance || []) }
function findOrder(id) { for (const s of allStates()) { const order = s.orders.find((o) => o.id === id); if (order) return { order, state: s } } return null }
function findReservation(id) { for (const s of allStates()) { const reservation = s.reservations.find((r) => r.id === id); if (reservation) return { reservation, state: s } } return null }
function findAssistance(id) { for (const s of allStates()) { const item = (s.assistance || []).find((a) => a.id === id); if (item) return item } return null }
function currentUser(req) { const auth = req.headers.authorization || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; return usersByToken.get(token) || null }
function requireUser(req, res) { const user = currentUser(req); if (!user) sendError(res, 401, 'AUTH_REQUIRED', 'Sign in is required.'); return user }
function adminEmails() { const defaults = 'demo-gle-user@stayeasy.local,demo.user@gmail.com'; return new Set(String(process.env.ADMIN_EMAILS || defaults).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) }
function roleFor(user) { return adminEmails().has(String(user?.email || '').toLowerCase()) || user?.role === 'admin' ? 'admin' : null }
function requireAdmin(req, res) { const user = requireUser(req, res); if (!user) return null; if (!roleFor(user)) { sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); return null } return { ...user, role: 'admin' } }
function seedDemoState(user) { const state = userState(user.id); if (state.seeded) return; const cm = publicMembership(getMembership('club-marriott-vietnam')); const ap = publicMembership(getMembership('accor-plus-vietnam')); state.savedMemberships = ['club-marriott-vietnam', 'accor-plus-vietnam']; state.orders = [{ id: 'ord_demo_activated', membershipId: cm.id, buyerName: user.name, buyerEmail: user.email, buyerPhone: '+84 90 000 0000', city: 'ho-chi-minh', listPrice: cm.annualFee, salePrice: cm.salePrice, paidAmount: cm.paidAmount, currency: cm.currency, commissionRate: cm.commissionRate, commissionAmount: cm.commissionAmount, status: 'activated', invoiceUrl: null, createdAt: now(), updatedAt: now() }, { id: 'ord_demo_paid', membershipId: ap.id, buyerName: 'Minji Kim', buyerEmail: 'minji@example.com', buyerPhone: '+82 10 0000 0000', city: 'da-nang', listPrice: ap.annualFee, salePrice: ap.salePrice, paidAmount: ap.paidAmount, currency: ap.currency, commissionRate: ap.commissionRate, commissionAmount: ap.commissionAmount, status: 'paid', invoiceUrl: null, createdAt: now(), updatedAt: now() }]; state.reservations = [{ id: 'res_demo_requested', membershipId: cm.id, templateId: 'cm-dinner', title: 'Free Dinner Coupon', date: '2026-07-10', adults: 2, children: 0, childAges: [], hotel: 'Sheraton Saigon Grand Opera Hotel', note: 'Window table preferred', status: 'requested', createdAt: now(), updatedAt: now() }, { id: 'res_demo_confirmed', membershipId: ap.id, templateId: 'ap-stay-night', title: 'Stay Plus Night', date: '2026-08-12', adults: 2, children: 1, childAges: [7], hotel: 'Sofitel Saigon Plaza', note: '', status: 'confirmed', createdAt: now(), updatedAt: now() }]; state.assistance = [{ id: 'ast_demo_new', userId: user.id, name: user.name, contact: user.email, city: 'ho-chi-minh', membershipId: cm.id, preferredDate: '2026-07-10', adults: 2, children: 0, requestType: 'reservation', message: 'Please help confirm dinner availability.', status: 'new', adminNote: '', createdAt: now(), updatedAt: now() }]; state.seeded = true }
function createUser(credential) { const subject = ['demo-google-user', 'demo.user@gmail.com'].includes(String(credential)) ? 'demo-google-user' : String(credential || 'demo-google-user'); if (usersBySubject.has(subject)) { const existing = usersBySubject.get(subject); seedDemoState(existing); return existing } const email = subject === 'demo-google-user' ? 'demo.user@gmail.com' : `demo-${subject.slice(-8)}@stayeasy.local`; const user = { id: makeId('usr'), provider: 'google', providerSubject: subject, name: subject === 'demo-google-user' ? 'Demo User' : 'StayEasy Demo User', email, picture: '', createdAt: now(), updatedAt: now() }; usersBySubject.set(subject, user); seedDemoState(user); return user }
function settlementSummary() { const orders = allOrders().filter((o) => o.status === 'activated'); return { gmv: orders.reduce((s, o) => s + o.paidAmount, 0), commission: orders.reduce((s, o) => s + o.commissionAmount, 0), activatedOrderCount: orders.length, currency: 'VND' } }
function toCsv(cols, rows) { const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') }
function snapshot() { return { memberships, voucherPacks, users: [...usersBySubject.entries()], states: [...stateByUser.entries()], auditLogs } }
function restore(s) { if (!s) return; memberships = s.memberships || memberships; voucherPacks = s.voucherPacks || voucherPacks; usersBySubject.clear(); for (const [k, v] of s.users || []) usersBySubject.set(k, v); stateByUser.clear(); for (const [k, v] of s.states || []) stateByUser.set(k, v); auditLogs.splice(0, auditLogs.length, ...(s.auditLogs || [])) }
async function initPersistence() { if (!process.env.DATABASE_URL) return; try { pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } }); await pool.query('CREATE TABLE IF NOT EXISTS app_state (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())'); const row = await pool.query('SELECT value FROM app_state WHERE key=$1', [DB_KEY]); if (row.rows[0]) restore(row.rows[0].value); persistenceError = null; console.log('StayEasy persistence enabled: Postgres') } catch (err) { persistenceError = err.message; console.error('StayEasy persistence disabled:', err.message); try { await pool?.end() } catch {} pool = null } }
async function saveSnapshot() { if (!pool) return; try { await pool.query('INSERT INTO app_state (key,value,updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value=excluded.value, updated_at=now()', [DB_KEY, snapshot()]) } catch (err) { persistenceError = err.message; console.error('StayEasy persistence save failed:', err.message) } }

async function route(req, res) {
  if (req.method === 'OPTIONS') return noContent(res)
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = normalizePath(url.pathname)
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {}
  const health = { ok: true, service: 'stayeasy-backend', persistence: pool ? 'postgres' : 'memory', ...(persistenceError ? { persistenceError } : {}), time: now() }

  if (req.method === 'GET' && path === '/') return send(res, 200, { ...health, docs: '/api/v1/health' })
  if (req.method === 'GET' && path === '/health') return send(res, 200, health)
  if (req.method === 'GET' && path === '/cities') return send(res, 200, cities)
  if (req.method === 'POST' && path === '/auth/google') { const user = createUser(body.idToken || body.credential); const accessToken = `demo_${randomUUID()}`; usersByToken.set(accessToken, user); return send(res, 200, { accessToken, refreshToken: accessToken, token: accessToken, user }) }
  if (req.method === 'GET' && (path === '/auth/me' || path === '/me')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, user) }
  if (req.method === 'POST' && path === '/auth/logout') return noContent(res)
  if (req.method === 'GET' && path === '/memberships') return send(res, 200, memberships.filter((m) => m.active !== false).map(publicMembership).sort((a, b) => b.scores.overall - a.scores.overall))
  if (req.method === 'GET' && path === '/memberships/compare') { const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 3); return send(res, 200, ids.map((id) => getMembership(id)).filter(Boolean).map(publicMembership)) }
  const membershipVoucherMatch = path.match(/^\/memberships\/([^/]+)\/vouchers$/)
  if (req.method === 'GET' && membershipVoucherMatch) return send(res, 200, getVoucherPack(membershipVoucherMatch[1]))
  const membershipMatch = path.match(/^\/memberships\/([^/]+)$/)
  if (req.method === 'GET' && membershipMatch) { const membership = getMembership(membershipMatch[1]); if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.'); return send(res, 200, { ...publicMembership(membership), vouchers: getVoucherPack(membership.id) }) }
  const publicAvailabilityMatch = path.match(/^\/vouchers\/([^/]+)\/availability$/)
  if (req.method === 'GET' && publicAvailabilityMatch) return send(res, 200, { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], minLeadDays: 0, maxAdvanceDays: 120, blackouts: [], validUntil: '2026-12-31' })

  if (path.startsWith('/admin/')) {
    const admin = requireAdmin(req, res); if (!admin) return
    if (req.method === 'GET' && path === '/admin/me') return send(res, 200, { user: admin, role: admin.role, permissions: ['read', 'catalog:write', 'settlement:write', 'reservation:write', 'assistance:write'] })
    if (req.method === 'GET' && path === '/admin/dashboard') return send(res, 200, { currency: 'VND', gmv: settlementSummary().gmv, commission: settlementSummary().commission, orders: { total: allOrders().length }, reservations: { total: allReservations().length }, assistance: { open: allAssistance().filter((a) => a.status !== 'handled').length }, activeMemberships: allStates().reduce((s, st) => s + st.savedMemberships.length, 0), expiringVouchers: 0 })
    if (req.method === 'GET' && path === '/admin/users') return send(res, 200, { items: [...usersBySubject.values()], meta: { page: 1, pageSize: 20, total: usersBySubject.size } })
    if (req.method === 'GET' && path === '/admin/memberships') return send(res, 200, { items: memberships.map(publicMembership), meta: { page: 1, pageSize: 20, total: memberships.length } })
    if (req.method === 'GET' && path === '/admin/orders') return send(res, 200, allOrders())
    if (req.method === 'GET' && path === '/admin/reservations') return send(res, 200, allReservations())
    if (req.method === 'GET' && path === '/admin/assistance-requests') return send(res, 200, allAssistance())
    if (req.method === 'GET' && path === '/admin/settlements/summary') return send(res, 200, settlementSummary())
    if (req.method === 'GET' && path === '/admin/reports/orders.csv') return sendCsv(res, 'orders.csv', toCsv(['id', 'membershipId', 'buyerEmail', 'status', 'paidAmount', 'commissionAmount', 'currency', 'createdAt'], allOrders()))
    if (req.method === 'GET' && path === '/admin/reports/settlements.csv') return sendCsv(res, 'settlements.csv', toCsv(['gmv', 'commission', 'activatedOrderCount', 'currency'], [settlementSummary()]))
    const adminOrderStatus = path.match(/^\/admin\/orders\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && adminOrderStatus) { const found = findOrder(adminOrderStatus[1]); if (!found) return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order was not found.'); found.order.status = body.status; found.order.updatedAt = now(); if (body.status === 'activated' && !found.state.savedMemberships.includes(found.order.membershipId)) found.state.savedMemberships.unshift(found.order.membershipId); return send(res, 200, found.order) }
    const adminReservationStatus = path.match(/^\/admin\/reservations\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && adminReservationStatus) { const found = findReservation(adminReservationStatus[1]); if (!found) return sendError(res, 404, 'RESERVATION_NOT_FOUND', 'Reservation was not found.'); found.reservation.status = body.status; found.reservation.updatedAt = now(); return send(res, 200, found.reservation) }
    const adminAssistance = path.match(/^\/admin\/assistance-requests\/([^/]+)$/)
    if (req.method === 'PATCH' && adminAssistance) { const item = findAssistance(adminAssistance[1]); if (!item) return sendError(res, 404, 'ASSISTANCE_REQUEST_NOT_FOUND', 'Assistance request was not found.'); item.status = body.status || item.status; item.adminNote = body.adminNote ?? item.adminNote ?? ''; item.updatedAt = now(); return send(res, 200, item) }
    return sendError(res, 404, 'NOT_FOUND', 'Endpoint was not found.')
  }

  if (req.method === 'GET' && (path === '/wallet' || path === '/me/wallet')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, walletFor(user)) }
  if (req.method === 'POST' && (path === '/wallet/memberships' || path === '/me/memberships')) { const user = requireUser(req, res); if (!user) return; const membership = getMembership(body.membershipId); if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.'); const state = userState(user.id); if (!state.savedMemberships.includes(body.membershipId)) state.savedMemberships.unshift(body.membershipId); return send(res, 201, walletFor(user)) }
  if (req.method === 'GET' && (path === '/orders' || path === '/me/orders')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, userState(user.id).orders) }
  if (req.method === 'POST' && (path === '/orders' || path === '/me/orders')) { const user = requireUser(req, res); if (!user) return; const membership = getMembership(body.membershipId); if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.'); const p = publicMembership(membership); const order = { id: makeId('ord'), membershipId: membership.id, buyerName: body.buyerName || user.name, buyerEmail: body.buyerEmail || user.email, buyerPhone: body.buyerPhone || '', city: body.city || membership.cities[0], listPrice: membership.annualFee, salePrice: membership.salePrice, paidAmount: p.paidAmount, currency: membership.currency, commissionRate: membership.commissionRate || 0, commissionAmount: p.commissionAmount, status: 'requested', invoiceUrl: null, createdAt: now(), updatedAt: now() }; userState(user.id).orders.unshift(order); return send(res, 201, order) }
  if (req.method === 'GET' && (path === '/reservations' || path === '/me/reservations')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, userState(user.id).reservations) }
  if (req.method === 'POST' && (path === '/reservations' || path === '/me/reservations')) { const user = requireUser(req, res); if (!user) return; const state = userState(user.id); const template = getVoucherTemplate(body.membershipId, body.templateId); if (!template) return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Voucher was not found.'); const voucher = voucherView(state, body.membershipId, template); if (voucher.available <= 0) return sendError(res, 409, 'VOUCHER_NOT_AVAILABLE', 'No available voucher remains.'); const reservation = { id: makeId('res'), membershipId: body.membershipId, templateId: body.templateId, title: template.title, date: body.date, adults: Number(body.adults || 1), children: Number(body.children || 0), childAges: Array.isArray(body.childAges) ? body.childAges : [], hotel: body.hotel || '', note: body.note || '', status: 'requested', createdAt: now(), updatedAt: now() }; state.reservations.unshift(reservation); return send(res, 201, reservation) }
  if (req.method === 'POST' && (path === '/assistance' || path === '/assistance-requests')) { const user = currentUser(req); const state = user ? userState(user.id) : userState('guest'); const item = { id: makeId('ast'), userId: user?.id || null, name: body.name || '', contact: body.contact || '', city: body.city || body.cityId || '', membershipId: body.membershipId || null, preferredDate: body.preferredDate || null, adults: Number(body.adults || 0), children: Number(body.children || 0), requestType: body.requestType || '', message: body.message || '', status: 'new', adminNote: '', createdAt: now(), updatedAt: now() }; state.assistance.unshift(item); return send(res, 201, item) }
  if (req.method === 'POST' && path === '/recommendations/quiz') return send(res, 200, memberships.map((m) => ({ membership: publicMembership(m), score: m.scores.overall, reasons: [] })).sort((a, b) => b.score - a.score).slice(0, 3))
  return sendError(res, 404, 'NOT_FOUND', 'Endpoint was not found.')
}

async function handle(req, res) { await route(req, res); if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) await saveSnapshot() }
await initPersistence()
const server = http.createServer((req, res) => { handle(req, res).catch((err) => { console.error(err); sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected server error.') }) })
server.listen(PORT, '0.0.0.0', () => { console.log(`StayEasy backend listening on http://0.0.0.0:${PORT}`) })
