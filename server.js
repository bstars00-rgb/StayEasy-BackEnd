import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { URL } from 'node:url'

const PORT = Number(process.env.PORT || 8787)
const API_PREFIX = '/api/v1'
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]

const cities = [
  { id: 'ho-chi-minh', country: 'vietnam' },
  { id: 'da-nang', country: 'vietnam' },
  { id: 'hanoi', country: 'vietnam' },
  { id: 'seoul', country: 'korea' },
  { id: 'bangkok', country: 'thailand' },
]

let memberships = [
  {
    id: 'club-marriott-vietnam', name: 'Club Marriott Vietnam', brand: 'Marriott', country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang', 'hanoi'], hotels: ['Sheraton Saigon Grand Opera Hotel', 'Le Meridien Saigon'],
    annualFee: 4500000, salePrice: 4200000, currency: 'VND', commissionRate: 0.12,
    diningDiscount: 50, roomDiscount: 20, freeNight: false, spaBenefit: true,
    benefits: ['Up to 50% off food for up to 4 diners', 'Up to 20% off room rates', '20% off spa treatments'],
    bestFor: ['familyDining', 'hotelBuffet', 'staycation'], estimatedSavings: 12000000,
    scores: { familyDining: 95, staycation: 80, businessTravel: 60, easeOfUse: 85, overall: 90 },
    notes: 'Strong pick for hotel dining in Vietnam.', officialUrl: 'https://www.clubmarriott.asia/', active: true,
  },
  {
    id: 'accor-plus-vietnam', name: 'Accor Plus Vietnam', brand: 'Accor', country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang', 'hanoi', 'bangkok'], hotels: ['Sofitel Saigon Plaza', 'Pullman Saigon Centre'],
    annualFee: 4900000, salePrice: 4500000, currency: 'VND', commissionRate: 0.12,
    diningDiscount: 50, roomDiscount: 10, freeNight: true, spaBenefit: false,
    benefits: ['One complimentary stay night every year', 'Up to 50% off dining', 'Member-only room rates'],
    bestFor: ['familyDining', 'staycation', 'freeNight'], estimatedSavings: 13000000,
    scores: { familyDining: 88, staycation: 90, businessTravel: 70, easeOfUse: 80, overall: 89 },
    notes: 'Includes a free stay night.', officialUrl: 'https://www.accorplus.com/', active: true,
  },
  {
    id: 'hilton-honors-vietnam', name: 'Hilton Honors Vietnam', brand: 'Hilton', country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang'], hotels: ['Hilton Saigon', 'Hilton Da Nang'],
    annualFee: 0, salePrice: null, currency: 'VND', commissionRate: 0,
    diningDiscount: null, roomDiscount: null, freeNight: true, spaBenefit: false,
    benefits: ['Free to join', 'Earn points on stays and dining', 'Exclusive member room rates'],
    bestFor: ['businessTravel', 'staycation', 'freeNight'], estimatedSavings: 6000000,
    scores: { familyDining: 55, staycation: 78, businessTravel: 90, easeOfUse: 92, overall: 84 },
    notes: 'Free loyalty program.', officialUrl: 'https://www.hilton.com/en/hilton-honors/', active: true,
  },
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

const CATEGORY_DEFAULTS = {
  dining: { daysOfWeek: ALL_DAYS, minLeadDays: 0, maxAdvanceDays: 120 },
  discount: { daysOfWeek: ALL_DAYS, minLeadDays: 0, maxAdvanceDays: 120 },
  room: { daysOfWeek: ALL_DAYS, minLeadDays: 2, maxAdvanceDays: 180 },
  spa: { daysOfWeek: ALL_DAYS, minLeadDays: 2, maxAdvanceDays: 120 },
  gift: { daysOfWeek: ALL_DAYS, minLeadDays: 2, maxAdvanceDays: 120 },
  other: { daysOfWeek: ALL_DAYS, minLeadDays: 1, maxAdvanceDays: 120 },
}
const TEMPLATE_OVERRIDES = { 'cm-stay2': { minLeadDays: 3 }, 'ap-dining50': { daysOfWeek: WEEKDAYS } }
let holidays = [
  { id: 'hol_vn_tet_2026', country: 'vietnam', from: '2026-02-14', to: '2026-02-22', key: 'tet', label: 'Tet 2026' },
  { id: 'hol_kr_seollal_2026', country: 'korea', from: '2026-02-16', to: '2026-02-18', key: 'seollal', label: 'Seollal 2026' },
]
let availabilityRules = Object.fromEntries(Object.values(voucherPacks).flat().map((v) => [v.templateId, { ...(CATEGORY_DEFAULTS[v.category] || CATEGORY_DEFAULTS.other), ...(TEMPLATE_OVERRIDES[v.templateId] || {}), blackouts: [] }]))

const usersByToken = new Map()
const usersBySubject = new Map()
const stateByUser = new Map()
const auditLogs = []

function now() { return new Date().toISOString() }
function makeId(prefix) { return `${prefix}_${randomUUID().slice(0, 8)}` }
function corsHeaders(extra = {}) { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Max-Age': '600', ...extra } }
function send(res, status, data) { res.writeHead(status, corsHeaders()); res.end(JSON.stringify(data)) }
function sendCsv(res, filename, data) { res.writeHead(200, corsHeaders({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` })); res.end(data) }
function noContent(res) { res.writeHead(204, corsHeaders()); res.end() }
function sendError(res, status, code, message, details = {}) { send(res, status, { code, message, details }) }
function normalizePath(pathname) { const raw = pathname.replace(/\/+$/, '') || '/'; return raw.startsWith(API_PREFIX) ? raw.slice(API_PREFIX.length) || '/' : raw }
function statusFor(code) { return { AUTH_REQUIRED: 401, ADMIN_REQUIRED: 403, FORBIDDEN: 403, NOT_FOUND: 404, MEMBERSHIP_NOT_FOUND: 404, VOUCHER_NOT_FOUND: 404, ORDER_NOT_FOUND: 404, RESERVATION_NOT_FOUND: 404, ASSISTANCE_REQUEST_NOT_FOUND: 404, VOUCHER_NOT_AVAILABLE: 409, VOUCHER_NOT_TRANSFERABLE: 409, INVALID_STATUS_TRANSITION: 409, DATE_NOT_AVAILABLE: 409, VALIDATION_ERROR: 400 }[code] || 500 }
async function readBody(req) { const chunks = []; for await (const c of req) chunks.push(c); if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} } }
function publicMembership(m) { const paidAmount = m.salePrice ?? m.annualFee; return { ...m, paidAmount, commissionAmount: Math.round(paidAmount * (m.commissionRate || 0)) } }
function getMembership(id, includeInactive = false) { return memberships.find((m) => m.id === id && (includeInactive || m.active !== false)) }
function getVoucherPack(membershipId) { return voucherPacks[membershipId] || [] }
function getVoucherTemplate(membershipId, templateId) { return getVoucherPack(membershipId).find((v) => v.templateId === templateId) }
function currentUser(req) { const auth = req.headers.authorization || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; return usersByToken.get(token) || null }
function requireUser(req, res) { const user = currentUser(req); if (!user) sendError(res, 401, 'AUTH_REQUIRED', 'Sign in is required.'); return user }
function adminEmails() { const defaults = 'demo-gle-user@stayeasy.local,demo.user@gmail.com'; return new Set(String(process.env.ADMIN_EMAILS || defaults).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) }
function operatorEmails() { return new Set(String(process.env.OPERATOR_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) }
function roleFor(user) { const email = String(user?.email || '').toLowerCase(); if (adminEmails().has(email) || user?.role === 'admin') return 'admin'; if (operatorEmails().has(email)) return 'operator'; return null }
function requireBackoffice(req, res, minRole = 'operator') { const user = requireUser(req, res); if (!user) return null; const role = roleFor(user); if (!role || (minRole === 'admin' && role !== 'admin')) { sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); return null } return { ...user, role } }
function userState(userId) { if (!stateByUser.has(userId)) stateByUser.set(userId, { savedMemberships: [], usage: {}, reservations: [], orders: [], transfers: [], assistance: [] }); return stateByUser.get(userId) }
function usageKey(membershipId, templateId) { return `${membershipId}:${templateId}` }
function countTransfers(state, membershipId, templateId) { return state.transfers.filter((t) => t.membershipId === membershipId && t.templateId === templateId).length }
function countOpenReservations(state, membershipId, templateId) { return state.reservations.filter((r) => r.membershipId === membershipId && r.templateId === templateId && ['requested', 'confirmed'].includes(r.status)).length }
function voucherView(state, membershipId, template) { const used = state.usage[usageKey(membershipId, template.templateId)] || 0; const held = countOpenReservations(state, membershipId, template.templateId); const transferred = countTransfers(state, membershipId, template.templateId); return { membershipId, ...template, used, held, transferred, available: Math.max(0, template.quantity - used - held - transferred) } }
function walletFor(user) { const state = userState(user.id); const owned = state.savedMemberships.map((id) => getMembership(id)).filter(Boolean).map(publicMembership); const vouchers = state.savedMemberships.flatMap((membershipId) => getVoucherPack(membershipId).map((template) => voucherView(state, membershipId, template))); return { summary: { membershipCount: owned.length, availableVoucherCount: vouchers.reduce((s, v) => s + v.available, 0), expiringSoonCount: vouchers.filter((v) => v.available > 0).length, openReservationCount: state.reservations.filter((r) => ['requested', 'confirmed'].includes(r.status)).length }, memberships: owned, vouchers, reservations: state.reservations, orders: state.orders, transfers: state.transfers } }
function seedDemoState(user) {
  const state = userState(user.id)
  if (state.seeded) return
  const cm = publicMembership(getMembership('club-marriott-vietnam'))
  const ap = publicMembership(getMembership('accor-plus-vietnam'))
  state.savedMemberships = ['club-marriott-vietnam', 'accor-plus-vietnam']
  state.orders = [
    { id: 'ord_demo_activated', membershipId: cm.id, buyerName: user.name, buyerEmail: user.email, buyerPhone: '+84 90 000 0000', city: 'ho-chi-minh', listPrice: cm.annualFee, salePrice: cm.salePrice, paidAmount: cm.paidAmount, currency: cm.currency, commissionRate: cm.commissionRate, commissionAmount: cm.commissionAmount, status: 'activated', invoiceUrl: null, createdAt: now(), updatedAt: now() },
    { id: 'ord_demo_paid', membershipId: ap.id, buyerName: 'Minji Kim', buyerEmail: 'minji@example.com', buyerPhone: '+82 10 0000 0000', city: 'da-nang', listPrice: ap.annualFee, salePrice: ap.salePrice, paidAmount: ap.paidAmount, currency: ap.currency, commissionRate: ap.commissionRate, commissionAmount: ap.commissionAmount, status: 'paid', invoiceUrl: null, createdAt: now(), updatedAt: now() },
  ]
  state.reservations = [
    { id: 'res_demo_requested', membershipId: cm.id, templateId: 'cm-dinner', title: 'Free Dinner Coupon', date: '2026-07-10', adults: 2, children: 0, childAges: [], hotel: 'Sheraton Saigon Grand Opera Hotel', note: 'Window table preferred', status: 'requested', createdAt: now(), updatedAt: now() },
    { id: 'res_demo_confirmed', membershipId: ap.id, templateId: 'ap-stay-night', title: 'Stay Plus Night', date: '2026-08-12', adults: 2, children: 1, childAges: [7], hotel: 'Sofitel Saigon Plaza', note: '', status: 'confirmed', createdAt: now(), updatedAt: now() },
  ]
  state.assistance = [
    { id: 'ast_demo_new', userId: user.id, name: user.name, contact: user.email, city: 'ho-chi-minh', membershipId: cm.id, preferredDate: '2026-07-10', adults: 2, children: 0, requestType: 'reservation', message: 'Please help confirm dinner availability.', status: 'new', adminNote: '', createdAt: now(), updatedAt: now() },
  ]
  state.seeded = true
}
function createUser(credential) { const subject = ['demo-google-user', 'demo.user@gmail.com'].includes(String(credential)) ? 'demo-google-user' : String(credential || 'demo-google-user'); if (usersBySubject.has(subject)) { const existing = usersBySubject.get(subject); seedDemoState(existing); return existing } const email = subject === 'demo-google-user' ? 'demo.user@gmail.com' : `demo-${subject.slice(-8)}@stayeasy.local`; const user = { id: makeId('usr'), provider: 'google', providerSubject: subject, name: subject === 'demo-google-user' ? 'Demo User' : 'OhmySelect Demo User', email, picture: '', createdAt: now(), updatedAt: now() }; usersBySubject.set(subject, user); seedDemoState(user); return user }
function paginate(items, params) { const page = Math.max(1, Number(params.get('page') || 1)); const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') || params.get('limit') || 20))); return { items: items.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: items.length } } }
function dateOnly(value) { return value ? String(value).slice(0, 10) : '' }
function inRange(value, from, to) { const d = dateOnly(value); return (!from || d >= from) && (!to || d <= to) }
function parseLocalDate(iso) { const [y, m, d] = String(iso || '').split('-').map(Number); if (!y || !m || !d) return null; const date = new Date(y, m - 1, d); return Number.isNaN(date.getTime()) ? null : date }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function dayDiff(a, b) { return Math.round((startOfDay(a) - startOfDay(b)) / 86400000) }
function audit(actor, action, targetType, targetId, before, after) { auditLogs.unshift({ id: makeId('aud'), actorEmail: actor?.email || 'system', action, targetType, targetId, before, after, createdAt: now() }) }
function toCsv(headers, rows) { const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`; return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n') }
function allStates() { return [...stateByUser.values()] }
function allOrders() { return allStates().flatMap((s) => s.orders) }
function allReservations() { return allStates().flatMap((s) => s.reservations) }
function allAssistance() { return allStates().flatMap((s) => s.assistance || []) }
function findOrder(id) { for (const s of allStates()) { const order = s.orders.find((o) => o.id === id); if (order) return { order, state: s } } return null }
function findReservation(id) { for (const s of allStates()) { const reservation = s.reservations.find((r) => r.id === id); if (reservation) return { reservation, state: s } } return null }
function findAssistance(id) { for (const s of allStates()) { const item = (s.assistance || []).find((a) => a.id === id); if (item) return item } return null }
function voucherUsage(templateId) { const template = Object.values(voucherPacks).flat().find((v) => v.templateId === templateId); const used = allStates().reduce((sum, s) => sum + Object.entries(s.usage).filter(([k]) => k.endsWith(`:${templateId}`)).reduce((a, [, v]) => a + v, 0), 0); const held = allReservations().filter((r) => r.templateId === templateId && ['requested', 'confirmed'].includes(r.status)).length; const transferred = allStates().reduce((sum, s) => sum + s.transfers.filter((t) => t.templateId === templateId).length, 0); const issued = template?.quantity || 0; return { issued, used, held, transferred, available: Math.max(0, issued - used - held - transferred) } }
function availabilityFor(templateId) { const template = Object.values(voucherPacks).flat().find((v) => v.templateId === templateId); if (!template) return null; const membership = memberships.find((m) => getVoucherPack(m.id).some((v) => v.templateId === templateId)); const rule = availabilityRules[templateId] || { ...(CATEGORY_DEFAULTS[template.category] || CATEGORY_DEFAULTS.other), blackouts: [] }; const holidayBlackouts = holidays.filter((h) => h.country === membership?.country).map((h) => ({ from: h.from, to: h.to, key: h.key, label: h.label })); return { ...rule, blackouts: [...(rule.blackouts || []), ...holidayBlackouts], validUntil: template.validUntil } }
function evaluateAvailability(membershipId, templateId, iso) { const date = parseLocalDate(iso); if (!date) return { ok: false, reason: 'invalid' }; const template = getVoucherTemplate(membershipId, templateId); if (!template) return { ok: false, reason: 'closed' }; const rule = availabilityFor(templateId); const d = startOfDay(date); const lead = dayDiff(d, startOfDay(new Date())); const exp = parseLocalDate(template.validUntil); if (exp && d > startOfDay(exp)) return { ok: false, reason: 'expired' }; if (lead < (rule.minLeadDays || 0)) return { ok: false, reason: 'leadTime' }; if (rule.maxAdvanceDays != null && lead > rule.maxAdvanceDays) return { ok: false, reason: 'tooFar' }; for (const b of rule.blackouts || []) { const from = parseLocalDate(b.from); const to = parseLocalDate(b.to); if (from && to && d >= startOfDay(from) && d <= startOfDay(to)) return { ok: false, reason: 'blackout', holidayKey: b.key } } const allowed = rule.daysOfWeek || ALL_DAYS; const dow = d.getDay(); if (!allowed.includes(dow)) return { ok: false, reason: dow === 0 || dow === 6 ? 'weekend' : 'closed' }; return { ok: true } }
function settlementSummary(params = new URLSearchParams()) { const from = params.get('from'), to = params.get('to'), brand = params.get('brand'); let orders = allOrders().filter((o) => o.status === 'activated' && inRange(o.createdAt, from, to)).map((o) => ({ ...o, brand: getMembership(o.membershipId, true)?.brand || '' })); if (brand) orders = orders.filter((o) => o.brand === brand); const byBrand = Object.values(orders.reduce((acc, o) => { acc[o.membershipId] ||= { membershipId: o.membershipId, gmv: 0, commission: 0, orders: 0 }; acc[o.membershipId].gmv += o.paidAmount; acc[o.membershipId].commission += o.commissionAmount; acc[o.membershipId].orders += 1; return acc }, {})); const byPeriod = Object.values(orders.reduce((acc, o) => { const date = dateOnly(o.createdAt); acc[date] ||= { date, gmv: 0, commission: 0 }; acc[date].gmv += o.paidAmount; acc[date].commission += o.commissionAmount; return acc }, {})).sort((a, b) => a.date.localeCompare(b.date)); return { gmv: orders.reduce((s, o) => s + o.paidAmount, 0), commission: orders.reduce((s, o) => s + o.commissionAmount, 0), activatedOrderCount: orders.length, currency: 'VND', byBrand, byPeriod } }
function dashboard(params) { const from = params.get('from'), to = params.get('to'); const orders = allOrders().filter((o) => inRange(o.createdAt, from, to)); const reservations = allReservations().filter((r) => inRange(r.createdAt, from, to)); const assistance = allAssistance().filter((a) => inRange(a.createdAt, from, to)); const byStatus = (items, statuses) => Object.fromEntries(statuses.map((s) => [s, items.filter((i) => i.status === s).length])); const activated = orders.filter((o) => o.status === 'activated'); const wallets = [...stateByUser.keys()].map((id) => walletFor({ id })); return { currency: 'VND', gmv: activated.reduce((s, o) => s + o.paidAmount, 0), commission: activated.reduce((s, o) => s + o.commissionAmount, 0), orders: { total: orders.length, byStatus: byStatus(orders, ['requested', 'invoiced', 'paid', 'activated', 'cancelled']) }, reservations: { total: reservations.length, byStatus: byStatus(reservations, ['requested', 'confirmed', 'completed', 'cancelled']) }, assistance: { open: assistance.filter((a) => a.status !== 'handled').length, handled: assistance.filter((a) => a.status === 'handled').length }, activeMemberships: allStates().reduce((s, st) => s + st.savedMemberships.length, 0), expiringVouchers: wallets.reduce((s, w) => s + w.summary.expiringSoonCount, 0) } }

async function route(req, res) {
  if (req.method === 'OPTIONS') return noContent(res)
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = normalizePath(url.pathname)
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {}

  if (req.method === 'GET' && path === '/') return send(res, 200, { ok: true, service: 'stayeasy-backend', docs: '/api/v1/health' })
  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, service: 'stayeasy-backend', time: now() })
  if (req.method === 'GET' && path === '/cities') return send(res, 200, cities)
  if (req.method === 'POST' && path === '/auth/google') { const user = createUser(body.idToken || body.credential); const accessToken = `demo_${randomUUID()}`; usersByToken.set(accessToken, user); return send(res, 200, { accessToken, refreshToken: accessToken, token: accessToken, user }) }
  if (req.method === 'GET' && (path === '/auth/me' || path === '/me')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, user) }
  if (req.method === 'POST' && path === '/auth/logout') return noContent(res)

  if (req.method === 'GET' && path === '/memberships') { let list = memberships.filter((m) => m.active !== false); const city = url.searchParams.get('city'), benefit = url.searchParams.get('benefit'); if (city) list = list.filter((m) => m.cities.includes(city)); if (benefit) list = list.filter((m) => m.bestFor.includes(benefit) || getVoucherPack(m.id).some((v) => v.category === benefit)); return send(res, 200, list.map(publicMembership).sort((a, b) => b.scores.overall - a.scores.overall)) }
  if (req.method === 'GET' && path === '/memberships/compare') { const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 3); return send(res, 200, ids.map((id) => getMembership(id)).filter(Boolean).map(publicMembership)) }
  const membershipVoucherMatch = path.match(/^\/memberships\/([^/]+)\/vouchers$/)
  if (req.method === 'GET' && membershipVoucherMatch) return send(res, 200, getVoucherPack(membershipVoucherMatch[1]))
  const membershipMatch = path.match(/^\/memberships\/([^/]+)$/)
  if (req.method === 'GET' && membershipMatch) { const membership = getMembership(membershipMatch[1]); if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.'); return send(res, 200, { ...publicMembership(membership), vouchers: getVoucherPack(membership.id) }) }
  const publicAvailabilityMatch = path.match(/^\/vouchers\/([^/]+)\/availability$/)
  if (req.method === 'GET' && publicAvailabilityMatch) { const rule = availabilityFor(publicAvailabilityMatch[1]); if (!rule) return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Voucher was not found.'); return send(res, 200, rule) }

  if (path.startsWith('/admin/')) {
    const admin = requireBackoffice(req, res); if (!admin) return
    if (req.method === 'GET' && path === '/admin/me') return send(res, 200, { user: admin, role: admin.role, permissions: admin.role === 'admin' ? ['read', 'catalog:write', 'settlement:write', 'reservation:write', 'assistance:write'] : ['read', 'reservation:write', 'assistance:write'] })
    if (req.method === 'GET' && path === '/admin/dashboard') return send(res, 200, dashboard(url.searchParams))
    if (req.method === 'GET' && path === '/admin/audit-logs') { let rows = auditLogs; const actor = (url.searchParams.get('actor') || '').toLowerCase(); if (actor) rows = rows.filter((a) => a.actorEmail.toLowerCase().includes(actor)); rows = rows.filter((a) => inRange(a.createdAt, url.searchParams.get('from'), url.searchParams.get('to'))); return send(res, 200, paginate(rows, url.searchParams)) }
    if (req.method === 'GET' && path === '/admin/users') { const rows = [...usersBySubject.values()].map((u) => ({ ...u, membershipsCount: userState(u.id).savedMemberships.length })); return send(res, 200, paginate(rows, url.searchParams)) }
    const adminUserMatch = path.match(/^\/admin\/users\/([^/]+)$/)
    if (req.method === 'GET' && adminUserMatch) { const user = [...usersBySubject.values()].find((u) => u.id === adminUserMatch[1]); if (!user) return sendError(res, 404, 'NOT_FOUND', 'User was not found.'); return send(res, 200, { user, wallet: walletFor(user) }) }
    if (req.method === 'GET' && path === '/admin/memberships') { let rows = memberships.map(publicMembership); return send(res, 200, paginate(rows, url.searchParams)) }
    if (req.method === 'POST' && path === '/admin/memberships') { if (admin.role !== 'admin') return sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); if (!body.id || !body.name || !body.brand) return sendError(res, 400, 'VALIDATION_ERROR', 'id, name and brand are required.'); const item = { ...body, active: body.active !== false }; memberships.push(item); audit(admin, 'create', 'membership', item.id, null, item); return send(res, 201, item) }
    const adminMembershipVoucherMatch = path.match(/^\/admin\/memberships\/([^/]+)\/vouchers$/)
    if (req.method === 'GET' && adminMembershipVoucherMatch) return send(res, 200, getVoucherPack(adminMembershipVoucherMatch[1]).map((v) => ({ membershipId: adminMembershipVoucherMatch[1], ...v, ...voucherUsage(v.templateId) })))
    if (req.method === 'POST' && adminMembershipVoucherMatch) { if (admin.role !== 'admin') return sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); const pack = voucherPacks[adminMembershipVoucherMatch[1]] ||= []; const item = { ...body, templateId: body.templateId || makeId('tpl'), quantity: Number(body.quantity || 1), validUntil: body.validUntil || '2026-12-31' }; pack.push(item); availabilityRules[item.templateId] = { ...(CATEGORY_DEFAULTS[item.category] || CATEGORY_DEFAULTS.other), blackouts: [] }; audit(admin, 'create', 'voucher', item.templateId, null, item); return send(res, 201, { membershipId: adminMembershipVoucherMatch[1], ...item, ...voucherUsage(item.templateId) }) }
    const adminMembershipMatch = path.match(/^\/admin\/memberships\/([^/]+)$/)
    if (adminMembershipMatch) { const membership = getMembership(adminMembershipMatch[1], true); if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.'); if (req.method === 'GET') return send(res, 200, { ...publicMembership(membership), vouchers: getVoucherPack(membership.id) }); if (admin.role !== 'admin') return sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); const before = { ...membership }; if (req.method === 'PATCH') { Object.assign(membership, body); audit(admin, 'update', 'membership', membership.id, before, membership); return send(res, 200, publicMembership(membership)) } if (req.method === 'DELETE') { membership.active = false; audit(admin, 'delete', 'membership', membership.id, before, membership); return send(res, 200, publicMembership(membership)) } }
    const adminVoucherAvailabilityMatch = path.match(/^\/admin\/vouchers\/([^/]+)\/availability$/)
    if (adminVoucherAvailabilityMatch) { const templateId = adminVoucherAvailabilityMatch[1]; const before = availabilityFor(templateId); if (!before) return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Voucher was not found.'); if (req.method === 'GET') return send(res, 200, before); if (req.method === 'PUT') { if (admin.role !== 'admin') return sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); availabilityRules[templateId] = { daysOfWeek: body.daysOfWeek || ALL_DAYS, minLeadDays: Number(body.minLeadDays || 0), maxAdvanceDays: Number(body.maxAdvanceDays || 120), blackouts: body.blackouts || [] }; audit(admin, 'update', 'availability', templateId, before, availabilityFor(templateId)); return send(res, 200, availabilityFor(templateId)) } }
    const adminVoucherUsageMatch = path.match(/^\/admin\/vouchers\/([^/]+)\/usage$/)
    if (req.method === 'GET' && adminVoucherUsageMatch) return send(res, 200, voucherUsage(adminVoucherUsageMatch[1]))
    const adminVoucherMatch = path.match(/^\/admin\/vouchers\/([^/]+)$/)
    if (adminVoucherMatch) { if (admin.role !== 'admin') return sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); const templateId = adminVoucherMatch[1]; for (const pack of Object.values(voucherPacks)) { const idx = pack.findIndex((v) => v.templateId === templateId); if (idx >= 0) { const before = { ...pack[idx] }; if (req.method === 'PATCH') { Object.assign(pack[idx], body); audit(admin, 'update', 'voucher', templateId, before, pack[idx]); return send(res, 200, { ...pack[idx], ...voucherUsage(templateId) }) } if (req.method === 'DELETE') { const [deleted] = pack.splice(idx, 1); audit(admin, 'delete', 'voucher', templateId, before, null); return send(res, 200, deleted) } } } return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Voucher was not found.') }
    if (req.method === 'GET' && path === '/admin/holidays') { let rows = holidays; const country = url.searchParams.get('country'); if (country) rows = rows.filter((h) => h.country === country); return send(res, 200, paginate(rows, url.searchParams)) }
    if (req.method === 'POST' && path === '/admin/holidays') { if (admin.role !== 'admin') return sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); const item = { id: body.id || makeId('hol'), country: body.country, from: body.from, to: body.to, key: body.key, label: body.label || body.key }; holidays.push(item); audit(admin, 'create', 'holiday', item.id, null, item); return send(res, 201, item) }
    const holidayMatch = path.match(/^\/admin\/holidays\/([^/]+)$/)
    if (holidayMatch) { if (admin.role !== 'admin') return sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); const idx = holidays.findIndex((h) => h.id === holidayMatch[1]); if (idx < 0) return sendError(res, 404, 'NOT_FOUND', 'Holiday was not found.'); const before = { ...holidays[idx] }; if (req.method === 'PATCH') { Object.assign(holidays[idx], body); audit(admin, 'update', 'holiday', holidays[idx].id, before, holidays[idx]); return send(res, 200, holidays[idx]) } if (req.method === 'DELETE') { const [deleted] = holidays.splice(idx, 1); audit(admin, 'delete', 'holiday', deleted.id, before, null); return send(res, 200, deleted) } }
    if (req.method === 'GET' && path === '/admin/reports/orders.csv') return sendCsv(res, 'orders.csv', toCsv(['id', 'membershipId', 'buyerEmail', 'status', 'paidAmount', 'commissionAmount', 'currency', 'createdAt'], allOrders()))
    if (req.method === 'GET' && path === '/admin/reports/settlements.csv') return sendCsv(res, 'settlements.csv', toCsv(['membershipId', 'gmv', 'commission', 'orders'], settlementSummary(url.searchParams).byBrand))
    if (req.method === 'GET' && path === '/admin/orders') return send(res, 200, allOrders())
    const adminOrderStatus = path.match(/^\/admin\/orders\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && adminOrderStatus) { if (admin.role !== 'admin') return sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.'); const found = findOrder(adminOrderStatus[1]); if (!found) return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order was not found.'); const valid = { requested: ['invoiced', 'cancelled'], invoiced: ['paid', 'cancelled'], paid: ['activated', 'cancelled'], activated: [], cancelled: [] }; if (!valid[found.order.status]?.includes(body.status)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', 'Order status transition is invalid.'); const before = { ...found.order }; found.order.status = body.status; found.order.updatedAt = now(); if (body.status === 'activated' && !found.state.savedMemberships.includes(found.order.membershipId)) found.state.savedMemberships.unshift(found.order.membershipId); audit(admin, 'update', 'order', found.order.id, before, found.order); return send(res, 200, found.order) }
    if (req.method === 'GET' && path === '/admin/reservations') return send(res, 200, allReservations())
    const adminReservationStatus = path.match(/^\/admin\/reservations\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && adminReservationStatus) { const found = findReservation(adminReservationStatus[1]); if (!found) return sendError(res, 404, 'RESERVATION_NOT_FOUND', 'Reservation was not found.'); const valid = { requested: ['confirmed', 'cancelled', 'completed'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] }; if (!valid[found.reservation.status]?.includes(body.status)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', 'Reservation status transition is invalid.'); const before = { ...found.reservation }; found.reservation.status = body.status; found.reservation.updatedAt = now(); if (body.status === 'completed') found.state.usage[usageKey(found.reservation.membershipId, found.reservation.templateId)] = (found.state.usage[usageKey(found.reservation.membershipId, found.reservation.templateId)] || 0) + 1; audit(admin, 'update', 'reservation', found.reservation.id, before, found.reservation); return send(res, 200, found.reservation) }
    if (req.method === 'GET' && path === '/admin/assistance-requests') { const rows = allAssistance(); if (!url.search) return send(res, 200, rows); let filtered = rows; const status = url.searchParams.get('status'), q = (url.searchParams.get('q') || '').toLowerCase(); if (status) filtered = filtered.filter((a) => a.status === status); if (q) filtered = filtered.filter((a) => [a.name, a.contact, a.message].join(' ').toLowerCase().includes(q)); return send(res, 200, paginate(filtered, url.searchParams)) }
    const adminAssistance = path.match(/^\/admin\/assistance-requests\/([^/]+)$/)
    if (req.method === 'PATCH' && adminAssistance) { const item = findAssistance(adminAssistance[1]); if (!item) return sendError(res, 404, 'ASSISTANCE_REQUEST_NOT_FOUND', 'Assistance request was not found.'); const before = { ...item }; item.status = body.status || item.status; item.adminNote = body.adminNote ?? item.adminNote ?? ''; item.updatedAt = now(); audit(admin, 'update', 'assistance', item.id, before, item); return send(res, 200, item) }
    if (req.method === 'GET' && path === '/admin/settlements/summary') return send(res, 200, settlementSummary(url.searchParams))
    return sendError(res, 404, 'NOT_FOUND', 'Endpoint was not found.')
  }

  if (req.method === 'GET' && (path === '/wallet' || path === '/me/wallet')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, walletFor(user)) }
  if (req.method === 'POST' && (path === '/wallet/memberships' || path === '/me/memberships')) { const user = requireUser(req, res); if (!user) return; const membership = getMembership(body.membershipId); if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.'); const state = userState(user.id); if (!state.savedMemberships.includes(body.membershipId)) state.savedMemberships.unshift(body.membershipId); return send(res, 201, walletFor(user)) }
  const ownedMembershipMatch = path.match(/^\/(?:wallet|me)\/memberships\/([^/]+)$/)
  if (req.method === 'DELETE' && ownedMembershipMatch) { const user = requireUser(req, res); if (!user) return; const state = userState(user.id); state.savedMemberships = state.savedMemberships.filter((id) => id !== ownedMembershipMatch[1]); return noContent(res) }
  if (req.method === 'GET' && path === '/wallet/vouchers') { const user = requireUser(req, res); if (!user) return; let vouchers = walletFor(user).vouchers; const category = url.searchParams.get('category'), membershipId = url.searchParams.get('membershipId'); if (membershipId) vouchers = vouchers.filter((v) => v.membershipId === membershipId); if (category && category !== 'all') vouchers = vouchers.filter((v) => v.category === category); return send(res, 200, vouchers) }
  if (req.method === 'GET' && (path === '/reservations' || path === '/me/reservations')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, userState(user.id).reservations) }
  if (req.method === 'POST' && (path === '/reservations' || path === '/me/reservations')) { const user = requireUser(req, res); if (!user) return; const state = userState(user.id); if (!state.savedMemberships.includes(body.membershipId)) return sendError(res, 403, 'FORBIDDEN', 'Membership is not in wallet.'); const template = getVoucherTemplate(body.membershipId, body.templateId); if (!template) return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Voucher was not found.'); const check = evaluateAvailability(body.membershipId, body.templateId, body.date); if (!check.ok) return sendError(res, 409, 'DATE_NOT_AVAILABLE', 'Date is not available.', check); const voucher = voucherView(state, body.membershipId, template); if (voucher.available <= 0) return sendError(res, 409, 'VOUCHER_NOT_AVAILABLE', 'No available voucher remains.'); const reservation = { id: makeId('res'), membershipId: body.membershipId, templateId: body.templateId, title: template.title, date: body.date, adults: Number(body.adults || 1), children: Number(body.children || 0), childAges: Array.isArray(body.childAges) ? body.childAges : [], hotel: body.hotel || '', note: body.note || '', status: 'requested', createdAt: now(), updatedAt: now() }; state.reservations.unshift(reservation); return send(res, 201, reservation) }
  const reservationStatus = path.match(/^\/(?:reservations|me\/reservations)\/([^/]+)(?:\/status)?$/)
  if (reservationStatus) { const user = requireUser(req, res); if (!user) return; const state = userState(user.id); const reservation = state.reservations.find((r) => r.id === reservationStatus[1]); if (!reservation) return sendError(res, 404, 'RESERVATION_NOT_FOUND', 'Reservation was not found.'); if (req.method === 'PATCH') { const valid = { requested: ['confirmed', 'cancelled', 'completed'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] }; if (!valid[reservation.status]?.includes(body.status)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', 'Reservation status transition is invalid.'); reservation.status = body.status; reservation.updatedAt = now(); if (body.status === 'completed') state.usage[usageKey(reservation.membershipId, reservation.templateId)] = (state.usage[usageKey(reservation.membershipId, reservation.templateId)] || 0) + 1; return send(res, 200, reservation) } if (req.method === 'DELETE') { state.reservations = state.reservations.filter((r) => r.id !== reservation.id); return noContent(res) } }
  if (req.method === 'GET' && (path === '/orders' || path === '/me/orders')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, userState(user.id).orders) }
  if (req.method === 'POST' && (path === '/orders' || path === '/me/orders')) { const user = requireUser(req, res); if (!user) return; const membership = getMembership(body.membershipId); if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.'); const p = publicMembership(membership); const order = { id: makeId('ord'), membershipId: membership.id, buyerName: body.buyerName || user.name, buyerEmail: body.buyerEmail || user.email, buyerPhone: body.buyerPhone || '', city: body.city || membership.cities[0], listPrice: membership.annualFee, salePrice: membership.salePrice, paidAmount: p.paidAmount, currency: membership.currency, commissionRate: membership.commissionRate || 0, commissionAmount: p.commissionAmount, status: 'requested', invoiceUrl: null, createdAt: now(), updatedAt: now() }; userState(user.id).orders.unshift(order); return send(res, 201, order) }
  const orderStatus = path.match(/^\/(?:orders|me\/orders)\/([^/]+)(?:\/status)?$/)
  if (req.method === 'PATCH' && orderStatus) { const user = requireUser(req, res); if (!user) return; const state = userState(user.id); const order = state.orders.find((o) => o.id === orderStatus[1]); if (!order) return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order was not found.'); const valid = { requested: ['invoiced', 'cancelled'], invoiced: ['paid', 'cancelled'], paid: ['activated', 'cancelled'], activated: [], cancelled: [] }; if (!valid[order.status]?.includes(body.status)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', 'Order status transition is invalid.'); order.status = body.status; order.updatedAt = now(); if (body.status === 'activated' && !state.savedMemberships.includes(order.membershipId)) state.savedMemberships.unshift(order.membershipId); return send(res, 200, order) }
  if (req.method === 'GET' && (path === '/transfers' || path === '/me/transfers')) { const user = requireUser(req, res); if (!user) return; return send(res, 200, userState(user.id).transfers) }
  if (req.method === 'POST' && (path === '/transfers' || path === '/me/transfers')) { const user = requireUser(req, res); if (!user) return; const state = userState(user.id); const template = getVoucherTemplate(body.membershipId, body.templateId); if (!template) return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Voucher was not found.'); if (!template.transferable) return sendError(res, 409, 'VOUCHER_NOT_TRANSFERABLE', 'Voucher is not transferable.'); const voucher = voucherView(state, body.membershipId, template); if (voucher.available <= 0) return sendError(res, 409, 'VOUCHER_NOT_AVAILABLE', 'No available voucher remains.'); const transfer = { id: makeId('trn'), membershipId: body.membershipId, templateId: body.templateId, title: template.title, recipientName: body.recipientName || '', recipientContact: body.recipientContact || '', message: body.message || '', createdAt: now() }; state.transfers.unshift(transfer); return send(res, 201, transfer) }
  if (req.method === 'GET' && (path === '/settlements/summary' || path === '/partner/settlement')) return send(res, 200, settlementSummary(url.searchParams))
  if (req.method === 'POST' && (path === '/assistance' || path === '/assistance-requests')) { const user = currentUser(req); const state = user ? userState(user.id) : userState('guest'); state.assistance ||= []; const item = { id: makeId('ast'), userId: user?.id || null, name: body.name || '', contact: body.contact || '', city: body.city || body.cityId || '', membershipId: body.membershipId || null, preferredDate: body.preferredDate || null, adults: Number(body.adults || 0), children: Number(body.children || 0), requestType: body.requestType || '', message: body.message || '', status: 'new', adminNote: '', createdAt: now(), updatedAt: now() }; state.assistance.unshift(item); return send(res, 201, item) }
  if (req.method === 'POST' && path === '/recommendations/quiz') { const city = body.city, benefits = Array.isArray(body.benefits) ? body.benefits : []; const ranked = memberships.filter((m) => m.active !== false).map((m) => { let score = m.scores.overall || 0; if (city && m.cities.includes(city)) score += 15; for (const b of benefits) if (m.bestFor.includes(b)) score += 10; if (body.budget === 'free_only' && m.annualFee > 0) score -= 25; return { membership: publicMembership(m), score, reasons: benefits.filter((b) => m.bestFor.includes(b)).map((b) => `benefit_${b}`) } }).sort((a, b) => b.score - a.score).slice(0, 3); return send(res, 200, ranked) }
  return sendError(res, 404, 'NOT_FOUND', 'Endpoint was not found.')
}

const server = http.createServer((req, res) => { route(req, res).catch((err) => { console.error(err); sendError(res, statusFor(err.code), err.code || 'INTERNAL_ERROR', err.message || 'Unexpected server error.', err.details || {}) }) })
server.listen(PORT, '0.0.0.0', () => { console.log(`StayEasy backend listening on http://0.0.0.0:${PORT}`) })
