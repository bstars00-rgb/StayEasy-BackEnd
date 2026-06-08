import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { URL } from 'node:url'

const PORT = Number(process.env.PORT || 8787)
const API_PREFIX = '/api/v1'

const cities = [
  { id: 'ho-chi-minh', country: 'vietnam' },
  { id: 'da-nang', country: 'vietnam' },
  { id: 'hanoi', country: 'vietnam' },
  { id: 'seoul', country: 'korea' },
  { id: 'bangkok', country: 'thailand' },
  { id: 'tokyo', country: 'japan' },
]

const memberships = [
  {
    id: 'club-marriott-vietnam', name: 'Club Marriott Vietnam', brand: 'Marriott', country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang', 'hanoi'], hotels: ['Sheraton Saigon Grand Opera Hotel', 'Le Meridien Saigon'],
    annualFee: 4500000, currency: 'VND', salePrice: 4200000, commissionRate: 0.12,
    diningDiscount: 50, roomDiscount: 20, freeNight: false, spaBenefit: true,
    benefits: ['Up to 50% off food for up to 4 diners', 'Up to 20% off room rates', '20% off spa treatments'],
    bestFor: ['familyDining', 'hotelBuffet', 'staycation'], estimatedSavings: 12000000,
    scores: { familyDining: 95, staycation: 80, businessTravel: 60, easeOfUse: 85, overall: 90 },
    notes: 'Strong pick for hotel dining in Vietnam.', officialUrl: 'https://www.clubmarriott.asia/'
  },
  {
    id: 'accor-plus-vietnam', name: 'Accor Plus Vietnam', brand: 'Accor', country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang', 'hanoi', 'bangkok'], hotels: ['Sofitel Saigon Plaza', 'Pullman Saigon Centre'],
    annualFee: 4900000, currency: 'VND', salePrice: 4500000, commissionRate: 0.12,
    diningDiscount: 50, roomDiscount: 10, freeNight: true, spaBenefit: false,
    benefits: ['One complimentary stay night every year', 'Up to 50% off dining', 'Member-only room rates'],
    bestFor: ['familyDining', 'staycation', 'freeNight'], estimatedSavings: 13000000,
    scores: { familyDining: 88, staycation: 90, businessTravel: 70, easeOfUse: 80, overall: 89 },
    notes: 'Includes a free stay night.', officialUrl: 'https://www.accorplus.com/'
  },
  {
    id: 'hilton-honors-vietnam', name: 'Hilton Honors Vietnam', brand: 'Hilton', country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang'], hotels: ['Hilton Saigon', 'Hilton Da Nang'],
    annualFee: 0, currency: 'VND', salePrice: null, commissionRate: 0,
    diningDiscount: null, roomDiscount: null, freeNight: true, spaBenefit: false,
    benefits: ['Free to join', 'Earn points on stays and dining', 'Exclusive member room rates'],
    bestFor: ['businessTravel', 'staycation', 'freeNight'], estimatedSavings: 6000000,
    scores: { familyDining: 55, staycation: 78, businessTravel: 90, easeOfUse: 92, overall: 84 },
    notes: 'Free loyalty program.', officialUrl: 'https://www.hilton.com/en/hilton-honors/'
  },
  {
    id: 'ihg-one-rewards-vietnam', name: 'IHG One Rewards Vietnam', brand: 'IHG', country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang'], hotels: ['InterContinental Saigon', 'Holiday Inn & Suites Saigon Airport'],
    annualFee: 0, currency: 'VND', salePrice: null, commissionRate: 0,
    diningDiscount: 20, roomDiscount: null, freeNight: true, spaBenefit: true,
    benefits: ['Free to join', 'Fourth reward night free', 'Up to 20% off dining'],
    bestFor: ['businessTravel', 'familyDining', 'freeNight'], estimatedSavings: 7000000,
    scores: { familyDining: 70, staycation: 75, businessTravel: 88, easeOfUse: 85, overall: 82 },
    notes: 'Good all-rounder.', officialUrl: 'https://www.ihg.com/onerewards/'
  }
]

const voucherPacks = {
  'club-marriott-vietnam': [
    { templateId: 'cm-stay2', category: 'room', title: 'Free 2-Night Stay', quantity: 1, validUntil: '2026-11-30', hotels: ['Sheraton Saigon Grand Opera Hotel'], transferable: false, note: 'Subject to availability.' },
    { templateId: 'cm-breakfast', category: 'dining', title: 'Free Breakfast Coupon', quantity: 3, validUntil: '2026-11-30', hotels: [], transferable: true, note: 'One person per coupon.' },
    { templateId: 'cm-dinner', category: 'dining', title: 'Free Dinner Coupon', quantity: 2, validUntil: '2026-11-30', hotels: [], transferable: true, note: 'Set menu only.' },
    { templateId: 'cm-spa', category: 'spa', title: 'Free Spa Treatment', quantity: 1, validUntil: '2026-11-30', hotels: [], transferable: true, note: 'Reservation required.' }
  ],
  'accor-plus-vietnam': [
    { templateId: 'ap-stay1', category: 'room', title: 'Complimentary Stay Night', quantity: 1, validUntil: '2026-12-31', hotels: ['Sofitel Saigon Plaza'], transferable: false, note: 'Reservation required.' },
    { templateId: 'ap-dining50', category: 'discount', title: '50% Off Dining', quantity: 4, validUntil: '2026-12-31', hotels: [], transferable: true, note: 'Member + up to 3 guests.' },
    { templateId: 'ap-breakfast', category: 'dining', title: 'Free Breakfast for Two', quantity: 2, validUntil: '2026-07-15', hotels: [], transferable: true, note: 'Valid with paid stay.' }
  ],
  'hilton-honors-vietnam': [
    { templateId: 'hh-lateco', category: 'room', title: 'Late Check-out (4pm)', quantity: 3, validUntil: '2026-12-31', hotels: [], transferable: false, note: 'Subject to availability.' },
    { templateId: 'hh-fnb15', category: 'discount', title: '15% Off Food & Beverage', quantity: 5, validUntil: '2026-12-31', hotels: [], transferable: true, note: 'At participating outlets.' }
  ],
  'ihg-one-rewards-vietnam': [
    { templateId: 'ihg-4thnight', category: 'room', title: 'Fourth Night Free', quantity: 1, validUntil: '2026-12-31', hotels: [], transferable: false, note: 'On a 4-night reward stay.' },
    { templateId: 'ihg-dining20', category: 'discount', title: '20% Off Dining', quantity: 3, validUntil: '2026-12-31', hotels: [], transferable: true, note: 'At select hotels.' }
  ]
}

const usersByToken = new Map()
const usersByEmail = new Map()
const stateByUser = new Map()
const assistanceRequests = []

function envelope(data, meta = {}) { return { data, meta, error: null } }
function failure(code, message, details = {}) { return { data: null, meta: {}, error: { code, message, details } } }
function now() { return new Date().toISOString() }
function makeId(prefix) { return `${prefix}_${randomUUID().slice(0, 8)}` }
function getMembership(id) { return memberships.find((m) => m.id === id) }
function getVoucherPack(membershipId) { return voucherPacks[membershipId] || [] }
function getVoucherTemplate(membershipId, templateId) { return getVoucherPack(membershipId).find((v) => v.templateId === templateId) }
function pricing(m) {
  const paidAmount = m.salePrice ?? m.annualFee
  return { paidAmount, commissionAmount: Math.round(paidAmount * (m.commissionRate || 0)) }
}
function publicMembership(m) { return { ...m, ...pricing(m) } }
function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'
  })
  res.end(JSON.stringify(payload))
}
function send(res, status, data) { json(res, status, envelope(data)) }
function sendError(res, status, code, message, details) { json(res, status, failure(code, message, details)) }
function noContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600'
  })
  res.end()
}
async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return {} }
}
function currentUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return usersByToken.get(token) || null
}
function requireUser(req, res) {
  const user = currentUser(req)
  if (!user) sendError(res, 401, 'AUTH_REQUIRED', 'Sign in is required.')
  return user
}
function adminEmails() {
  const defaults = 'demo-gle-user@stayeasy.local,demo.user@gmail.com'
  return new Set(String(process.env.ADMIN_EMAILS || defaults).split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
}
function requireAdmin(req, res) {
  const user = requireUser(req, res)
  if (!user) return null
  if (!adminEmails().has(String(user.email || '').toLowerCase())) {
    sendError(res, 403, 'ADMIN_REQUIRED', 'Admin access is required.')
    return null
  }
  return user
}
function userState(userId) {
  if (!stateByUser.has(userId)) stateByUser.set(userId, { savedMemberships: [], usage: {}, reservations: [], orders: [], transfers: [] })
  return stateByUser.get(userId)
}
function usageKey(membershipId, templateId) { return `${membershipId}:${templateId}` }
function countOpenReservations(state, membershipId, templateId) {
  return state.reservations.filter((r) => r.membershipId === membershipId && r.templateId === templateId && ['requested', 'confirmed'].includes(r.status)).length
}
function countTransfers(state, membershipId, templateId) {
  return state.transfers.filter((t) => t.membershipId === membershipId && t.templateId === templateId).length
}
function voucherView(state, membershipId, template) {
  const used = state.usage[usageKey(membershipId, template.templateId)] || 0
  const held = countOpenReservations(state, membershipId, template.templateId)
  const transferred = countTransfers(state, membershipId, template.templateId)
  const available = Math.max(0, template.quantity - used - held - transferred)
  return { membershipId, ...template, used, held, transferred, available }
}
function daysUntil(date) { return Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - Date.now()) / 86400000) }
function walletFor(user) {
  const state = userState(user.id)
  const owned = state.savedMemberships.map(getMembership).filter(Boolean).map(publicMembership)
  const vouchers = state.savedMemberships.flatMap((membershipId) => getVoucherPack(membershipId).map((template) => voucherView(state, membershipId, template)))
  return {
    summary: {
      membershipCount: owned.length,
      availableVoucherCount: vouchers.reduce((sum, v) => sum + v.available, 0),
      expiringSoonCount: vouchers.filter((v) => v.available > 0 && daysUntil(v.validUntil) <= 30).length,
      openReservationCount: state.reservations.filter((r) => ['requested', 'confirmed'].includes(r.status)).length
    },
    memberships: owned, vouchers, reservations: state.reservations, orders: state.orders, transfers: state.transfers
  }
}
function createUser(idToken) {
  const suffix = String(idToken || 'demo').slice(-8)
  const email = `demo-${suffix}@stayeasy.local`
  const existing = usersByEmail.get(email)
  if (existing) return existing
  const user = { id: makeId('usr'), provider: 'google', name: 'StayEasy Demo User', email, picture: '', createdAt: now() }
  usersByEmail.set(email, user)
  return user
}
function normalizePath(urlPath) {
  const raw = urlPath.replace(/\/+$/, '') || '/'
  return raw.startsWith(API_PREFIX) ? raw.slice(API_PREFIX.length) || '/' : raw
}
function allOrders() { return [...stateByUser.values()].flatMap((state) => state.orders) }
function allReservations() { return [...stateByUser.values()].flatMap((state) => state.reservations) }
function findOrder(id) {
  for (const state of stateByUser.values()) {
    const order = state.orders.find((item) => item.id === id)
    if (order) return { order, state }
  }
  return null
}
function findReservation(id) {
  for (const state of stateByUser.values()) {
    const reservation = state.reservations.find((item) => item.id === id)
    if (reservation) return { reservation, state }
  }
  return null
}
function settlementSummary() {
  const orders = allOrders().filter((order) => order.status === 'activated')
  return { gmv: orders.reduce((sum, order) => sum + order.paidAmount, 0), commission: orders.reduce((sum, order) => sum + order.commissionAmount, 0), currency: 'VND', activatedOrderCount: orders.length }
}

async function route(req, res) {
  if (req.method === 'OPTIONS') return noContent(res)
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = normalizePath(url.pathname)
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {}

  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, service: 'stayeasy-backend', time: now() })
  if (req.method === 'GET' && path === '/cities') return send(res, 200, cities)

  if (req.method === 'POST' && path === '/auth/google') {
    const user = createUser(body.idToken || body.credential)
    const accessToken = `demo_${randomUUID()}`
    usersByToken.set(accessToken, user)
    return send(res, 200, { accessToken, refreshToken: accessToken, user })
  }
  if (req.method === 'GET' && path === '/me') {
    const user = requireUser(req, res); if (!user) return
    return send(res, 200, user)
  }
  if (req.method === 'POST' && path === '/auth/logout') return noContent(res)

  if (req.method === 'GET' && path === '/memberships') {
    let list = memberships
    const city = url.searchParams.get('city')
    const benefit = url.searchParams.get('benefit')
    if (city) list = list.filter((m) => m.cities.includes(city))
    if (benefit) list = list.filter((m) => m.bestFor.includes(benefit) || getVoucherPack(m.id).some((v) => v.category === benefit))
    return send(res, 200, list.map(publicMembership).sort((a, b) => b.scores.overall - a.scores.overall))
  }
  if (req.method === 'GET' && path === '/memberships/compare') {
    const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 3)
    return send(res, 200, ids.map(getMembership).filter(Boolean).map(publicMembership))
  }
  const membershipMatch = path.match(/^\/memberships\/([^/]+)$/)
  if (req.method === 'GET' && membershipMatch) {
    const membership = getMembership(membershipMatch[1])
    if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.')
    return send(res, 200, { ...publicMembership(membership), vouchers: getVoucherPack(membership.id) })
  }

  if (path.startsWith('/admin/')) {
    const admin = requireAdmin(req, res); if (!admin) return
    if (req.method === 'GET' && path === '/admin/orders') return send(res, 200, allOrders())
    const adminOrderStatus = path.match(/^\/admin\/orders\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && adminOrderStatus) {
      const found = findOrder(adminOrderStatus[1])
      if (!found) return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order was not found.')
      const valid = { requested: ['invoiced', 'cancelled'], invoiced: ['paid', 'cancelled'], paid: ['activated', 'cancelled'], activated: [], cancelled: [] }
      if (!valid[found.order.status]?.includes(body.status)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', 'Order status transition is invalid.')
      found.order.status = body.status; found.order.updatedAt = now()
      if (body.status === 'activated' && !found.state.savedMemberships.includes(found.order.membershipId)) found.state.savedMemberships.unshift(found.order.membershipId)
      return send(res, 200, found.order)
    }
    if (req.method === 'GET' && path === '/admin/reservations') return send(res, 200, allReservations())
    const adminReservationStatus = path.match(/^\/admin\/reservations\/([^/]+)\/status$/)
    if (req.method === 'PATCH' && adminReservationStatus) {
      const found = findReservation(adminReservationStatus[1])
      if (!found) return sendError(res, 404, 'RESERVATION_NOT_FOUND', 'Reservation was not found.')
      const valid = { requested: ['confirmed', 'completed', 'cancelled'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] }
      if (!valid[found.reservation.status]?.includes(body.status)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', 'Reservation status transition is invalid.')
      found.reservation.status = body.status; found.reservation.updatedAt = now()
      if (body.status === 'completed') found.state.usage[usageKey(found.reservation.membershipId, found.reservation.templateId)] = (found.state.usage[usageKey(found.reservation.membershipId, found.reservation.templateId)] || 0) + 1
      return send(res, 200, found.reservation)
    }
    if (req.method === 'GET' && path === '/admin/assistance-requests') return send(res, 200, assistanceRequests)
    const adminAssistance = path.match(/^\/admin\/assistance-requests\/([^/]+)$/)
    if (req.method === 'PATCH' && adminAssistance) {
      const request = assistanceRequests.find((item) => item.id === adminAssistance[1])
      if (!request) return sendError(res, 404, 'ASSISTANCE_REQUEST_NOT_FOUND', 'Assistance request was not found.')
      request.status = body.status || request.status
      request.adminNote = body.adminNote ?? request.adminNote ?? ''
      request.updatedAt = now()
      return send(res, 200, request)
    }
    if (req.method === 'GET' && path === '/admin/settlements/summary') return send(res, 200, settlementSummary())
    return sendError(res, 404, 'NOT_FOUND', 'Endpoint was not found.')
  }

  const user = ['/wallet', '/reservations', '/orders', '/transfers'].some((p) => path === p || path.startsWith(`${p}/`)) ? requireUser(req, res) : null
  if (res.writableEnded) return
  const state = user ? userState(user.id) : null

  if (req.method === 'GET' && path === '/wallet') return send(res, 200, walletFor(user))
  if (req.method === 'POST' && path === '/wallet/memberships') {
    if (!getMembership(body.membershipId)) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.')
    if (!state.savedMemberships.includes(body.membershipId)) state.savedMemberships.unshift(body.membershipId)
    return send(res, 201, walletFor(user))
  }
  if (req.method === 'GET' && path === '/wallet/vouchers') {
    let vouchers = walletFor(user).vouchers
    const category = url.searchParams.get('category')
    const membershipId = url.searchParams.get('membershipId')
    if (membershipId) vouchers = vouchers.filter((v) => v.membershipId === membershipId)
    if (category && category !== 'all') vouchers = vouchers.filter((v) => v.category === category)
    return send(res, 200, vouchers)
  }

  if (req.method === 'GET' && path === '/reservations') return send(res, 200, state.reservations)
  if (req.method === 'POST' && path === '/reservations') {
    const template = getVoucherTemplate(body.membershipId, body.templateId)
    if (!template) return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Voucher was not found.')
    const voucher = voucherView(state, body.membershipId, template)
    if (!state.savedMemberships.includes(body.membershipId)) return sendError(res, 403, 'FORBIDDEN', 'Membership is not in wallet.')
    if (voucher.available <= 0) return sendError(res, 409, 'VOUCHER_NOT_AVAILABLE', 'No available voucher remains.')
    const reservation = { id: makeId('res'), membershipId: body.membershipId, templateId: body.templateId, title: template.title, date: body.date, adults: Number(body.adults || 1), children: Number(body.children || 0), childAges: Array.isArray(body.childAges) ? body.childAges : [], hotel: body.hotel || '', note: body.note || '', status: 'requested', createdAt: now(), updatedAt: now() }
    state.reservations.unshift(reservation)
    return send(res, 201, reservation)
  }
  const reservationStatus = path.match(/^\/reservations\/([^/]+)\/status$/)
  if (req.method === 'PATCH' && reservationStatus) {
    const reservation = state.reservations.find((r) => r.id === reservationStatus[1])
    if (!reservation) return sendError(res, 404, 'RESERVATION_NOT_FOUND', 'Reservation was not found.')
    const valid = { requested: ['confirmed', 'completed', 'cancelled'], confirmed: ['completed', 'cancelled'], completed: [], cancelled: [] }
    if (!valid[reservation.status]?.includes(body.status)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', 'Reservation status transition is invalid.')
    reservation.status = body.status; reservation.updatedAt = now()
    if (body.status === 'completed') state.usage[usageKey(reservation.membershipId, reservation.templateId)] = (state.usage[usageKey(reservation.membershipId, reservation.templateId)] || 0) + 1
    return send(res, 200, reservation)
  }

  if (req.method === 'GET' && path === '/orders') return send(res, 200, state.orders)
  if (req.method === 'POST' && path === '/orders') {
    const membership = getMembership(body.membershipId)
    if (!membership) return sendError(res, 404, 'MEMBERSHIP_NOT_FOUND', 'Membership was not found.')
    const p = pricing(membership)
    const order = { id: makeId('ord'), membershipId: membership.id, buyerName: body.buyerName || user.name, buyerEmail: body.buyerEmail || user.email, buyerPhone: body.buyerPhone || '', city: body.city || membership.cities[0], listPrice: membership.annualFee, salePrice: membership.salePrice, paidAmount: p.paidAmount, currency: membership.currency, commissionRate: membership.commissionRate || 0, commissionAmount: p.commissionAmount, status: 'requested', createdAt: now(), updatedAt: now() }
    state.orders.unshift(order)
    return send(res, 201, order)
  }
  const orderStatus = path.match(/^\/orders\/([^/]+)\/status$/)
  if (req.method === 'PATCH' && orderStatus) {
    const order = state.orders.find((o) => o.id === orderStatus[1])
    if (!order) return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order was not found.')
    const valid = { requested: ['invoiced', 'cancelled'], invoiced: ['paid', 'cancelled'], paid: ['activated', 'cancelled'], activated: [], cancelled: [] }
    if (!valid[order.status]?.includes(body.status)) return sendError(res, 409, 'INVALID_STATUS_TRANSITION', 'Order status transition is invalid.')
    order.status = body.status; order.updatedAt = now()
    if (body.status === 'activated' && !state.savedMemberships.includes(order.membershipId)) state.savedMemberships.unshift(order.membershipId)
    return send(res, 200, order)
  }
  if (req.method === 'GET' && path === '/settlements/summary') return send(res, 200, settlementSummary())

  if (req.method === 'GET' && path === '/transfers') return send(res, 200, state.transfers)
  if (req.method === 'POST' && path === '/transfers') {
    const template = getVoucherTemplate(body.membershipId, body.templateId)
    if (!template) return sendError(res, 404, 'VOUCHER_NOT_FOUND', 'Voucher was not found.')
    const voucher = voucherView(state, body.membershipId, template)
    if (!voucher.transferable) return sendError(res, 409, 'VOUCHER_NOT_TRANSFERABLE', 'Voucher is not transferable.')
    if (voucher.available <= 0) return sendError(res, 409, 'VOUCHER_NOT_AVAILABLE', 'No available voucher remains.')
    const transfer = { id: makeId('trn'), membershipId: body.membershipId, templateId: body.templateId, title: template.title, recipientName: body.recipientName || '', recipientContact: body.recipientContact || '', message: body.message || '', createdAt: now() }
    state.transfers.unshift(transfer)
    return send(res, 201, transfer)
  }

  if (req.method === 'POST' && path === '/assistance-requests') {
    const entry = { id: makeId('ast'), ...body, status: 'new', adminNote: '', createdAt: now(), updatedAt: now() }
    assistanceRequests.unshift(entry)
    return send(res, 201, entry)
  }
  if (req.method === 'POST' && path === '/recommendations/quiz') {
    const benefits = Array.isArray(body.benefits) ? body.benefits : []
    const ranked = memberships.map((m) => ({ membership: publicMembership(m), score: m.scores.overall + (m.cities.includes(body.city) ? 15 : 0) + benefits.filter((b) => m.bestFor.includes(b)).length * 10, reasons: benefits.filter((b) => m.bestFor.includes(b)).map((b) => `benefit_${b}`) })).sort((a, b) => b.score - a.score).slice(0, 3)
    return send(res, 200, ranked)
  }

  return sendError(res, 404, 'NOT_FOUND', 'Endpoint was not found.')
}

const server = http.createServer((req, res) => route(req, res).catch((err) => { console.error(err); sendError(res, 500, 'INTERNAL_ERROR', 'Unexpected server error.') }))
server.listen(PORT, () => console.log(`StayEasy backend listening on http://localhost:${PORT}`))