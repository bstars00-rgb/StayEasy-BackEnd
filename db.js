import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import dns from 'node:dns'
import { resolve4 } from 'node:dns/promises'
import pg from 'pg'
import { memberships, getPricing } from './src/data/memberships.js'
import { cities } from './src/data/cities.js'
import { getVoucherPack, voucherPacks } from './src/data/voucherPacks.js'
import { voucherStats, OPEN_RESERVATION_STATUSES } from './src/utils/vouchers.js'

// better-sqlite3 (native) is loaded lazily only when running without a Postgres
// DATABASE_URL, so the Render/Postgres deploy never requires the native module.

const { Pool } = pg
dns.setDefaultResultOrder('ipv4first')
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]
const CATEGORY_DEFAULTS = {
  dining: { daysOfWeek: ALL_DAYS, minLeadDays: 0, maxAdvanceDays: 120 },
  discount: { daysOfWeek: ALL_DAYS, minLeadDays: 0, maxAdvanceDays: 120 },
  room: { daysOfWeek: ALL_DAYS, minLeadDays: 2, maxAdvanceDays: 180 },
  spa: { daysOfWeek: ALL_DAYS, minLeadDays: 2, maxAdvanceDays: 120 },
  gift: { daysOfWeek: ALL_DAYS, minLeadDays: 2, maxAdvanceDays: 120 },
  other: { daysOfWeek: ALL_DAYS, minLeadDays: 1, maxAdvanceDays: 120 },
}
const TEMPLATE_OVERRIDES = {
  'cm-stay2': { minLeadDays: 3 },
  'cm-fnb50': { daysOfWeek: WEEKDAYS },
  'ap-dining50': { daysOfWeek: WEEKDAYS },
  'ihg-dining20': { daysOfWeek: WEEKDAYS },
  'cm-cake': { minLeadDays: 2 },
  'nk-cake': { minLeadDays: 2 },
}
const HOLIDAY_SEEDS = [
  { id: 'hol_vn_tet_2026', country: 'vietnam', from: '2026-02-14', to: '2026-02-22', key: 'tet', label: 'Tet 2026' },
  { id: 'hol_vn_tet_2027', country: 'vietnam', from: '2027-02-05', to: '2027-02-13', key: 'tet', label: 'Tet 2027' },
  { id: 'hol_kr_seollal_2026', country: 'korea', from: '2026-02-16', to: '2026-02-18', key: 'seollal', label: 'Seollal 2026' },
  { id: 'hol_kr_chuseok_2026', country: 'korea', from: '2026-09-24', to: '2026-09-27', key: 'chuseok', label: 'Chuseok 2026' },
  { id: 'hol_th_songkran_2026', country: 'thailand', from: '2026-04-13', to: '2026-04-15', key: 'songkran', label: 'Songkran 2026' },
]

function now() { return new Date().toISOString() }
function stringify(value) { return JSON.stringify(value ?? null) }
function parse(value, fallback = null) { try { return value == null ? fallback : JSON.parse(value) } catch { return fallback } }
function toPg(sql) { let i = 0; return sql.replace(/\?/g, () => `$${++i}`) }
function cryptoId() { return Math.random().toString(36).slice(2, 10) }
function pageParams(params = new URLSearchParams()) {
  const page = Math.max(1, Number(params.get('page') || 1))
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') || params.get('limit') || 20)))
  return { page, pageSize, offset: (page - 1) * pageSize }
}
function paginate(list, params) {
  const { page, pageSize, offset } = pageParams(params)
  return { items: list.slice(offset, offset + pageSize), meta: { page, pageSize, total: list.length } }
}
function dateOnly(value) { return value ? String(value).slice(0, 10) : '' }
function inRange(value, from, to) {
  const d = dateOnly(value)
  return (!from || d >= from) && (!to || d <= to)
}
function parseLocalDate(iso) {
  if (!iso || typeof iso !== 'string') return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function dayDiff(a, b) { return Math.round((startOfDay(a) - startOfDay(b)) / 86400000) }

class SqliteAdapter {
  constructor(file) {
    this.mode = 'sqlite'
    this.file = file
  }
  async open() {
    const { default: Database } = await import('better-sqlite3')
    mkdirSync(dirname(this.file), { recursive: true })
    this.db = new Database(this.file)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
  }
  async exec(sql) { this.db.exec(sql) }
  async run(sql, params = []) { return this.db.prepare(sql).run(params) }
  async get(sql, params = []) { return this.db.prepare(sql).get(params) }
  async all(sql, params = []) { return this.db.prepare(sql).all(params) }
  async tx(fn) {
    this.db.exec('BEGIN IMMEDIATE')
    try { const out = await fn(this); this.db.exec('COMMIT'); return out } catch (err) { this.db.exec('ROLLBACK'); throw err }
  }
}

class PostgresAdapter {
  constructor(connectionString) { this.connectionString = connectionString; this.mode = 'postgres'; this.pool = null }
  async open() {
    const dbUrl = new URL(this.connectionString)
    const originalHost = dbUrl.hostname
    let host = originalHost
    try {
      const [ipv4] = await resolve4(originalHost)
      if (ipv4) host = ipv4
    } catch {}
    this.pool = new Pool({
      user: decodeURIComponent(dbUrl.username),
      password: decodeURIComponent(dbUrl.password),
      host,
      port: Number(dbUrl.port || 5432),
      database: dbUrl.pathname.replace(/^\//, '') || 'postgres',
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false, servername: originalHost },
    })
  }
  async exec(sql) { await this.pool.query(sql) }
  async run(sql, params = []) { return this.pool.query(toPg(sql), params) }
  async get(sql, params = []) { const r = await this.pool.query(toPg(sql), params); return r.rows[0] }
  async all(sql, params = []) { const r = await this.pool.query(toPg(sql), params); return r.rows }
  async tx(fn) {
    const client = await this.pool.connect()
    const scoped = {
      run: (sql, params = []) => client.query(toPg(sql), params),
      get: async (sql, params = []) => (await client.query(toPg(sql), params)).rows[0],
      all: async (sql, params = []) => (await client.query(toPg(sql), params)).rows,
    }
    try { await client.query('BEGIN'); const out = await fn(scoped); await client.query('COMMIT'); return out }
    catch (err) { await client.query('ROLLBACK'); throw err }
    finally { client.release() }
  }
}

function membershipFrom(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    country: row.country_id,
    cities: parse(row.cities, []),
    hotels: parse(row.hotels, []),
    annualFee: Number(row.annual_fee) || 0,
    currency: row.currency,
    salePrice: row.sale_price == null ? null : Number(row.sale_price),
    paidAmount: Number(row.paid_amount) || 0,
    commissionRate: Number(row.commission_rate) || 0,
    commissionAmount: Number(row.commission_amount) || 0,
    diningDiscount: row.dining_discount == null ? null : Number(row.dining_discount),
    roomDiscount: row.room_discount == null ? null : Number(row.room_discount),
    freeNight: !!Number(row.free_night),
    spaBenefit: !!Number(row.spa_benefit),
    benefits: parse(row.benefits, []),
    bestFor: parse(row.best_for, []),
    estimatedSavings: Number(row.estimated_savings) || 0,
    scores: parse(row.scores, {}),
    notes: row.notes || '',
    officialUrl: row.official_url || '',
  }
}
function voucherFrom(row, stats = {}) {
  return { membershipId: row.membership_id, templateId: row.template_id, category: row.category, title: row.title, description: row.description || '', quantity: Number(row.quantity) || 0, validUntil: row.valid_until, hotels: parse(row.hotels, []), city: row.city_id || undefined, transferable: !!Number(row.transferable), note: row.note || '', i18n: parse(row.i18n, {}), ...stats }
}
function reservationFrom(row) { return { id: row.id, membershipId: row.membership_id, templateId: row.template_id, title: row.title, date: row.date, adults: Number(row.adults) || 0, children: Number(row.children) || 0, childAges: parse(row.child_ages, []), hotel: row.hotel || '', note: row.note || '', status: row.status, createdAt: row.created_at, updatedAt: row.updated_at } }
function orderFrom(row) { return { id: row.id, membershipId: row.membership_id, buyerName: row.buyer_name, buyerEmail: row.buyer_email, buyerPhone: row.buyer_phone || '', city: row.city_id, listPrice: Number(row.list_price) || 0, salePrice: row.sale_price == null ? null : Number(row.sale_price), paidAmount: Number(row.paid_amount) || 0, currency: row.currency, commissionRate: Number(row.commission_rate) || 0, commissionAmount: Number(row.commission_amount) || 0, status: row.status, invoiceUrl: row.invoice_url || null, createdAt: row.created_at, updatedAt: row.updated_at } }
function transferFrom(row) { return { id: row.id, membershipId: row.membership_id, templateId: row.template_id, title: row.title, recipientName: row.recipient_name || '', recipientContact: row.recipient_contact || '', message: row.message || '', createdAt: row.created_at } }
function userFrom(row) { return row && { id: row.id, provider: row.provider, name: row.name, email: row.email, picture: row.picture_url || '', role: row.role || null, createdAt: row.created_at, updatedAt: row.updated_at } }

function assistanceFrom(row) { return row && { id: row.id, userId: row.user_id || null, name: row.name || '', contact: row.contact || '', city: row.city_id || '', membershipId: row.membership_id || null, preferredDate: row.preferred_date || null, adults: Number(row.adults) || 0, children: Number(row.children) || 0, requestType: row.request_type || '', message: row.message || '', status: row.status, adminNote: row.admin_note || '', createdAt: row.created_at, updatedAt: row.updated_at || row.created_at } }
function auditFrom(row) { return row && { id: row.id, actorEmail: row.actor_email, action: row.action, targetType: row.target_type, targetId: row.target_id, before: parse(row.before_json, null), after: parse(row.after_json, null), createdAt: row.created_at } }
function availabilityFrom(row) { return row && { daysOfWeek: parse(row.days_of_week, ALL_DAYS), minLeadDays: Number(row.min_lead_days) || 0, maxAdvanceDays: Number(row.max_advance_days) || 120, blackouts: parse(row.blackouts, []) } }
function holidayFrom(row) { return row && { id: row.id, country: row.country_id, from: row.from_date, to: row.to_date, key: row.key, label: row.label || row.key } }

export class OhmySelectStore {
  constructor(db) { this.db = db; this.tokens = new Map() }
  static async open() {
    const db = (process.env.DATABASE_URL || '').startsWith('postgres') ? new PostgresAdapter(process.env.DATABASE_URL) : new SqliteAdapter(resolve(process.env.SQLITE_PATH || '.data/stayeasy.sqlite'))
    if (db.open) await db.open()
    const store = new OhmySelectStore(db)
    await store.migrate(); await store.seed(); return store
  }
  async migrate() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_subject TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, picture_url TEXT, role TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cities (id TEXT PRIMARY KEY, country_id TEXT NOT NULL, name_en TEXT, sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL, country_id TEXT NOT NULL, cities TEXT NOT NULL, hotels TEXT NOT NULL, annual_fee REAL NOT NULL, currency TEXT NOT NULL, sale_price REAL, paid_amount REAL NOT NULL, commission_rate REAL DEFAULT 0, commission_amount REAL DEFAULT 0, dining_discount INTEGER, room_discount INTEGER, free_night INTEGER DEFAULT 0, spa_benefit INTEGER DEFAULT 0, benefits TEXT NOT NULL, best_for TEXT NOT NULL, estimated_savings REAL DEFAULT 0, scores TEXT NOT NULL, notes TEXT, official_url TEXT, active INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS membership_cities (membership_id TEXT NOT NULL, city_id TEXT NOT NULL, PRIMARY KEY (membership_id, city_id));
      CREATE TABLE IF NOT EXISTS membership_hotels (id TEXT PRIMARY KEY, membership_id TEXT NOT NULL, city_id TEXT, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS membership_tags (membership_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (membership_id, tag));
      CREATE TABLE IF NOT EXISTS membership_scores (membership_id TEXT PRIMARY KEY, family_dining INTEGER, staycation INTEGER, business_travel INTEGER, ease_of_use INTEGER, overall INTEGER);
      CREATE TABLE IF NOT EXISTS voucher_templates (id TEXT PRIMARY KEY, membership_id TEXT NOT NULL, template_id TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, description TEXT, quantity INTEGER NOT NULL, valid_until TEXT NOT NULL, city_id TEXT, hotels TEXT NOT NULL, transferable INTEGER DEFAULT 0, note TEXT, i18n TEXT, UNIQUE (membership_id, template_id));
      CREATE TABLE IF NOT EXISTS voucher_template_hotels (voucher_template_id TEXT NOT NULL, hotel_name TEXT NOT NULL, PRIMARY KEY (voucher_template_id, hotel_name));
      CREATE TABLE IF NOT EXISTS voucher_availability (template_id TEXT PRIMARY KEY, days_of_week TEXT NOT NULL, min_lead_days INTEGER NOT NULL, max_advance_days INTEGER NOT NULL, blackouts TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS holidays (id TEXT PRIMARY KEY, country_id TEXT NOT NULL, from_date TEXT NOT NULL, to_date TEXT NOT NULL, key TEXT NOT NULL, label TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS user_memberships (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, membership_id TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL, activated_at TEXT NOT NULL, removed_at TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS user_memberships_active_idx ON user_memberships(user_id, membership_id) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS voucher_usage (user_id TEXT NOT NULL, membership_id TEXT NOT NULL, template_id TEXT NOT NULL, used_count INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, membership_id, template_id));
      CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, membership_id TEXT NOT NULL, template_id TEXT NOT NULL, title TEXT NOT NULL, date TEXT, adults INTEGER NOT NULL, children INTEGER NOT NULL, child_ages TEXT NOT NULL, hotel TEXT, note TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, membership_id TEXT NOT NULL, buyer_name TEXT NOT NULL, buyer_email TEXT NOT NULL, buyer_phone TEXT, city_id TEXT, list_price REAL NOT NULL, sale_price REAL, paid_amount REAL NOT NULL, currency TEXT NOT NULL, commission_rate REAL NOT NULL, commission_amount REAL NOT NULL, status TEXT NOT NULL, invoice_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, membership_id TEXT NOT NULL, template_id TEXT NOT NULL, title TEXT NOT NULL, recipient_name TEXT, recipient_contact TEXT, message TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assistance_requests (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, contact TEXT, city_id TEXT, membership_id TEXT, preferred_date TEXT, adults INTEGER, children INTEGER, request_type TEXT, message TEXT, status TEXT NOT NULL, admin_note TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT);
      CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor_email TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL);
    `)
    await this.db.run('ALTER TABLE users ADD COLUMN role TEXT').catch(() => {})
    await this.db.run('ALTER TABLE voucher_templates ADD COLUMN i18n TEXT').catch(() => {})
    await this.db.run("ALTER TABLE assistance_requests ADD COLUMN admin_note TEXT DEFAULT ''").catch(() => {})
    await this.db.run('ALTER TABLE assistance_requests ADD COLUMN updated_at TEXT').catch(() => {})
  }
  async seed() {
    let i = 0
    for (const c of cities) await this.db.run(`INSERT INTO cities (id,country_id,name_en,sort_order,active) VALUES (?,?,?,?,1) ON CONFLICT (id) DO UPDATE SET country_id=excluded.country_id, sort_order=excluded.sort_order, active=1`, [c.id, c.country, c.id, i++])
    for (const m of memberships) {
      const p = getPricing(m)
      await this.db.run(`INSERT INTO memberships (id,name,brand,country_id,cities,hotels,annual_fee,currency,sale_price,paid_amount,commission_rate,commission_amount,dining_discount,room_discount,free_night,spa_benefit,benefits,best_for,estimated_savings,scores,notes,official_url,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT (id) DO NOTHING`, [m.id,m.name,m.brand,m.country,stringify(m.cities),stringify(m.hotels),m.annualFee,m.currency,p.salePrice,p.paidAmount,p.commissionRate,p.commissionAmount,m.diningDiscount,m.roomDiscount,m.freeNight?1:0,m.spaBenefit?1:0,stringify(m.benefits),stringify(m.bestFor),m.estimatedSavings,stringify(m.scores),m.notes,m.officialUrl])
      if (!(await this.db.get('SELECT membership_id FROM membership_cities WHERE membership_id=? LIMIT 1',[m.id]))) {
      await this.db.run('DELETE FROM membership_cities WHERE membership_id=?',[m.id]); await this.db.run('DELETE FROM membership_hotels WHERE membership_id=?',[m.id]); await this.db.run('DELETE FROM membership_tags WHERE membership_id=?',[m.id])
      for (const city of m.cities) await this.db.run('INSERT INTO membership_cities (membership_id,city_id) VALUES (?,?)',[m.id,city])
      for (const [idx, hotel] of m.hotels.entries()) await this.db.run('INSERT INTO membership_hotels (id,membership_id,city_id,name) VALUES (?,?,?,?)',[`${m.id}:hotel:${idx}`,m.id,null,hotel])
      for (const tag of m.bestFor) await this.db.run('INSERT INTO membership_tags (membership_id,tag) VALUES (?,?)',[m.id,tag])
      await this.db.run(`INSERT INTO membership_scores (membership_id,family_dining,staycation,business_travel,ease_of_use,overall) VALUES (?,?,?,?,?,?) ON CONFLICT (membership_id) DO UPDATE SET family_dining=excluded.family_dining, staycation=excluded.staycation, business_travel=excluded.business_travel, ease_of_use=excluded.ease_of_use, overall=excluded.overall`, [m.id,m.scores.familyDining,m.scores.staycation,m.scores.businessTravel,m.scores.easeOfUse,m.scores.overall])
      }
    }
    for (const [membershipId, pack] of Object.entries(voucherPacks)) for (const v of pack) {
      const id = `${membershipId}:${v.templateId}`
      await this.db.run(`INSERT INTO voucher_templates (id,membership_id,template_id,category,title,description,quantity,valid_until,city_id,hotels,transferable,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (membership_id,template_id) DO NOTHING`, [id,membershipId,v.templateId,v.category,v.title,v.description||'',v.quantity,v.validUntil,v.city||null,stringify(v.hotels||[]),v.transferable?1:0,v.note||''])
      if (!(await this.db.get('SELECT voucher_template_id FROM voucher_template_hotels WHERE voucher_template_id=? LIMIT 1',[id]))) for (const h of v.hotels||[]) await this.db.run('INSERT INTO voucher_template_hotels (voucher_template_id,hotel_name) VALUES (?,?)',[id,h])
      const base = { ...(CATEGORY_DEFAULTS[v.category] || CATEGORY_DEFAULTS.other), ...(TEMPLATE_OVERRIDES[v.templateId] || {}) }
      await this.db.run(`INSERT INTO voucher_availability (template_id,days_of_week,min_lead_days,max_advance_days,blackouts,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT (template_id) DO NOTHING`, [v.templateId,stringify(base.daysOfWeek),base.minLeadDays,base.maxAdvanceDays,stringify([]),now()])
    }
    for (const h of HOLIDAY_SEEDS) await this.db.run(`INSERT INTO holidays (id,country_id,from_date,to_date,key,label,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING`, [h.id,h.country,h.from,h.to,h.key,h.label,now(),now()])
  }
  rememberToken(token, user) { this.tokens.set(token, user.id) }
  async userByToken(token) { const id = this.tokens.get(token); return id ? this.getUserById(id) : null }
  async getUserById(id) { return userFrom(await this.db.get('SELECT * FROM users WHERE id=?',[id])) }
  async upsertDemoUser(credential, makeId) {
    const subject = ['demo-google-user','demo.user@gmail.com'].includes(String(credential)) ? 'demo-google-user' : String(credential || 'demo-google-user')
    const existing = await this.db.get('SELECT * FROM users WHERE provider=? AND provider_subject=?',['google',subject]); if (existing) return userFrom(existing)
    const ts = now(), email = subject === 'demo-google-user' ? 'demo.user@gmail.com' : (subject.includes('@') ? subject : `demo-${subject.slice(-8)}@ohmyselect.local`), id = makeId('usr')
    await this.db.run('INSERT INTO users (id,provider,provider_subject,name,email,picture_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[id,'google',subject,subject==='demo-google-user'?'Demo User':'OhmySelect Demo User',email,'',ts,ts])
    return this.getUserById(id)
  }
  async memberships(params = new URLSearchParams()) {
    let list = (await this.db.all('SELECT * FROM memberships WHERE active=1')).map(membershipFrom)
    const city=params.get('city'), benefit=params.get('benefit')
    if (city) list = list.filter(m=>m.cities.includes(city))
    if (benefit) list = list.filter(m=>m.bestFor.includes(benefit)||(benefit==='dining'&&m.diningDiscount!=null)||(benefit==='room'&&(m.roomDiscount!=null||m.freeNight))||(benefit==='spa'&&m.spaBenefit)||(benefit==='freeNight'&&m.freeNight)||getVoucherPack(m.id).some(v=>v.category===benefit))
    return list.sort((a,b)=>(b.scores.overall||0)-(a.scores.overall||0))
  }
  async membership(id) { return membershipFrom(await this.db.get('SELECT * FROM memberships WHERE id=? AND active=1',[id])) }
  async compare(ids) { const out=[]; for (const id of ids.slice(0,3)) { const m=await this.membership(id); if (m) out.push(m) } return out }
  async voucherTemplates(membershipId) { return (await this.db.all('SELECT * FROM voucher_templates WHERE membership_id=? ORDER BY id',[membershipId])).map(r=>voucherFrom(r)) }
  async rawVoucher(membershipId, templateId, db=this.db) { return db.get('SELECT * FROM voucher_templates WHERE membership_id=? AND template_id=?',[membershipId,templateId]) }
  async voucherView(userId, row, db=this.db) {
    const u=await db.get('SELECT used_count FROM voucher_usage WHERE user_id=? AND membership_id=? AND template_id=?',[userId,row.membership_id,row.template_id])
    const h=await db.get("SELECT COUNT(*) AS count FROM reservations WHERE user_id=? AND membership_id=? AND template_id=? AND status IN ('requested','confirmed')",[userId,row.membership_id,row.template_id])
    const t=await db.get('SELECT COUNT(*) AS count FROM transfers WHERE user_id=? AND membership_id=? AND template_id=?',[userId,row.membership_id,row.template_id])
    return voucherFrom(row, voucherStats(row.quantity, u?.used_count||0, h?.count||0, t?.count||0))
  }
  async wallet(userId) {
    const memberships=(await this.db.all("SELECT m.* FROM user_memberships um JOIN memberships m ON m.id=um.membership_id WHERE um.user_id=? AND um.status='active' ORDER BY um.activated_at DESC",[userId])).map(membershipFrom)
    const vouchers=[]; for (const m of memberships) for (const row of await this.db.all('SELECT * FROM voucher_templates WHERE membership_id=? ORDER BY id',[m.id])) vouchers.push(await this.voucherView(userId,row))
    const reservations=(await this.db.all('SELECT * FROM reservations WHERE user_id=? ORDER BY created_at DESC',[userId])).map(reservationFrom)
    const orders=(await this.db.all('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC',[userId])).map(orderFrom)
    const transfers=(await this.db.all('SELECT * FROM transfers WHERE user_id=? ORDER BY created_at DESC',[userId])).map(transferFrom)
    return { summary:{ membershipCount:memberships.length, availableVoucherCount:vouchers.reduce((s,v)=>s+v.available,0), expiringSoonCount:vouchers.filter(v=>v.available>0&&Math.ceil((new Date(`${v.validUntil}T00:00:00Z`).getTime()-Date.now())/86400000)<=30).length, openReservationCount:reservations.filter(r=>OPEN_RESERVATION_STATUSES.includes(r.status)).length }, memberships, vouchers, reservations, orders, transfers }
  }
  async addMembership(userId, membershipId, source='free_join', db=this.db) {
    if (!(await db.get('SELECT id FROM memberships WHERE id=? AND active=1',[membershipId]))) return false
    if (await db.get("SELECT id FROM user_memberships WHERE user_id=? AND membership_id=? AND status='active'",[userId,membershipId])) return true
    await db.run("INSERT INTO user_memberships (id,user_id,membership_id,source,status,activated_at,removed_at) VALUES (?,?,?,?, 'active', ?, NULL)",[`um_${cryptoId()}`,userId,membershipId,source,now()]); return true
  }
  async removeMembership(userId,membershipId){await this.db.tx(async tx=>{await tx.run("UPDATE user_memberships SET status='removed', removed_at=? WHERE user_id=? AND membership_id=? AND status='active'",[now(),userId,membershipId]); await tx.run('DELETE FROM voucher_usage WHERE user_id=? AND membership_id=?',[userId,membershipId]); await tx.run('DELETE FROM reservations WHERE user_id=? AND membership_id=?',[userId,membershipId]); await tx.run('DELETE FROM transfers WHERE user_id=? AND membership_id=?',[userId,membershipId])})}
  async ownsMembership(userId,membershipId,db=this.db){return !!(await db.get("SELECT id FROM user_memberships WHERE user_id=? AND membership_id=? AND status='active'",[userId,membershipId]))}
  async availableVoucher(userId,membershipId,templateId,db=this.db){const row=await this.rawVoucher(membershipId,templateId,db); return row?this.voucherView(userId,row,db):null}
  async createReservation(userId,input,makeId){return this.db.tx(async tx=>{if(!(await this.ownsMembership(userId,input.membershipId,tx))){const e=new Error('Membership is not in wallet.'); e.code='FORBIDDEN'; throw e} const v=await this.availableVoucher(userId,input.membershipId,input.templateId,tx); if(!v){const e=new Error('Voucher was not found.'); e.code='VOUCHER_NOT_FOUND'; throw e} if(v.available<=0){const e=new Error('No available voucher remains.'); e.code='VOUCHER_NOT_AVAILABLE'; throw e} const check=await this.evaluateAvailability(input.membershipId,input.templateId,input.date,tx); if(!check.ok){const e=new Error('Date is not available.'); e.code='DATE_NOT_AVAILABLE'; e.details=check; throw e} const id=makeId('res'), ts=now(); await tx.run('INSERT INTO reservations (id,user_id,membership_id,template_id,title,date,adults,children,child_ages,hotel,note,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,userId,input.membershipId,input.templateId,v.title,input.date,Number(input.adults||1),Number(input.children||0),stringify(Array.isArray(input.childAges)?input.childAges:[]),input.hotel||'',input.note||'','requested',ts,ts]); return reservationFrom(await tx.get('SELECT * FROM reservations WHERE id=?',[id]))})}
  async updateReservationStatus(userId,id,status){return this.db.tx(async tx=>{const r=await tx.get('SELECT * FROM reservations WHERE id=? AND user_id=?',[id,userId]); if(!r)return null; const valid={requested:['confirmed','cancelled','completed'],confirmed:['completed','cancelled'],completed:[],cancelled:[]}; if(!valid[r.status]?.includes(status)){const e=new Error('Reservation status transition is invalid.'); e.code='INVALID_STATUS_TRANSITION'; throw e} await tx.run('UPDATE reservations SET status=?, updated_at=? WHERE id=? AND user_id=?',[status,now(),id,userId]); if(status==='completed') await this.incrementUsage(userId,r.membership_id,r.template_id,tx); return reservationFrom(await tx.get('SELECT * FROM reservations WHERE id=? AND user_id=?',[id,userId]))})}
  async incrementUsage(userId,membershipId,templateId,db){const row=await db.get('SELECT used_count FROM voucher_usage WHERE user_id=? AND membership_id=? AND template_id=?',[userId,membershipId,templateId]); if(row) await db.run('UPDATE voucher_usage SET used_count=used_count+1, updated_at=? WHERE user_id=? AND membership_id=? AND template_id=?',[now(),userId,membershipId,templateId]); else await db.run('INSERT INTO voucher_usage (user_id,membership_id,template_id,used_count,updated_at) VALUES (?,?,?,1,?)',[userId,membershipId,templateId,now()])}
  async deleteReservation(userId,id){await this.db.run('DELETE FROM reservations WHERE id=? AND user_id=?',[id,userId])}
  async reservations(userId){return (await this.db.all('SELECT * FROM reservations WHERE user_id=? ORDER BY created_at DESC',[userId])).map(reservationFrom)}
  async createOrder(userId,input,user,makeId){const m=await this.membership(input.membershipId); if(!m)return null; const id=makeId('ord'), ts=now(); await this.db.run('INSERT INTO orders (id,user_id,membership_id,buyer_name,buyer_email,buyer_phone,city_id,list_price,sale_price,paid_amount,currency,commission_rate,commission_amount,status,invoice_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?)',[id,userId,m.id,input.buyerName||user.name,input.buyerEmail||user.email,input.buyerPhone||'',input.city||m.cities[0],m.annualFee,m.salePrice,m.paidAmount,m.currency,m.commissionRate,m.commissionAmount,'requested',ts,ts]); return orderFrom(await this.db.get('SELECT * FROM orders WHERE id=? AND user_id=?',[id,userId]))}
  async orders(userId){return (await this.db.all('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC',[userId])).map(orderFrom)}
  async updateOrderStatus(userId,id,status){return this.db.tx(async tx=>{const o=await tx.get('SELECT * FROM orders WHERE id=? AND user_id=?',[id,userId]); if(!o)return null; const valid={requested:['invoiced','cancelled'],invoiced:['paid','cancelled'],paid:['activated','cancelled'],activated:[],cancelled:[]}; if(!valid[o.status]?.includes(status)){const e=new Error('Order status transition is invalid.'); e.code='INVALID_STATUS_TRANSITION'; throw e} await tx.run('UPDATE orders SET status=?, updated_at=? WHERE id=? AND user_id=?',[status,now(),id,userId]); if(status==='activated') await this.addMembership(userId,o.membership_id,'order_activation',tx); return orderFrom(await tx.get('SELECT * FROM orders WHERE id=? AND user_id=?',[id,userId]))})}
  async createTransfer(userId,input,makeId){return this.db.tx(async tx=>{const v=await this.availableVoucher(userId,input.membershipId,input.templateId,tx); if(!v){const e=new Error('Voucher was not found.'); e.code='VOUCHER_NOT_FOUND'; throw e} if(!v.transferable){const e=new Error('Voucher is not transferable.'); e.code='VOUCHER_NOT_TRANSFERABLE'; throw e} if(v.available<=0){const e=new Error('No available voucher remains.'); e.code='VOUCHER_NOT_AVAILABLE'; throw e} const id=makeId('trn'); await tx.run('INSERT INTO transfers (id,user_id,membership_id,template_id,title,recipient_name,recipient_contact,message,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[id,userId,input.membershipId,input.templateId,v.title,input.recipientName||'',input.recipientContact||'',input.message||'',now()]); return transferFrom(await tx.get('SELECT * FROM transfers WHERE id=? AND user_id=?',[id,userId]))})}
  async transfers(userId){return (await this.db.all('SELECT * FROM transfers WHERE user_id=? ORDER BY created_at DESC',[userId])).map(transferFrom)}
  async settlement(){const orders=(await this.db.all("SELECT * FROM orders WHERE status='activated'")).map(orderFrom); return {gmv:orders.reduce((s,o)=>s+o.paidAmount,0),commission:orders.reduce((s,o)=>s+o.commissionAmount,0),activatedOrderCount:orders.length,currency:'VND'}}
  async createAssistance(input,makeId,userId=null){const entry={id:makeId('ast'),...input,status:'new',createdAt:now(),updatedAt:now()}; await this.db.run('INSERT INTO assistance_requests (id,user_id,name,contact,city_id,membership_id,preferred_date,adults,children,request_type,message,status,admin_note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[entry.id,userId,input.name||'',input.contact||'',input.city||input.cityId||'',input.membershipId||null,input.preferredDate||null,input.adults||0,input.children||0,input.requestType||'',input.message||'',entry.status,'',entry.createdAt,entry.updatedAt]); return entry}
  async adminOrders(){return (await this.db.all('SELECT * FROM orders ORDER BY created_at DESC')).map(orderFrom)}
  async adminReservations(){return (await this.db.all('SELECT * FROM reservations ORDER BY created_at DESC')).map(reservationFrom)}
  async adminAssistanceRequests(){return (await this.db.all('SELECT * FROM assistance_requests ORDER BY created_at DESC')).map(assistanceFrom)}
  async adminUpdateOrderStatus(id,status){return this.db.tx(async tx=>{const o=await tx.get('SELECT * FROM orders WHERE id=?',[id]); if(!o)return null; const valid={requested:['invoiced','cancelled'],invoiced:['paid','cancelled'],paid:['activated','cancelled'],activated:[],cancelled:[]}; if(!valid[o.status]?.includes(status)){const e=new Error('Order status transition is invalid.'); e.code='INVALID_STATUS_TRANSITION'; throw e} await tx.run('UPDATE orders SET status=?, updated_at=? WHERE id=?',[status,now(),id]); if(status==='activated') await this.addMembership(o.user_id,o.membership_id,'order_activation',tx); return orderFrom(await tx.get('SELECT * FROM orders WHERE id=?',[id]))})}
  async adminUpdateReservationStatus(id,status){return this.db.tx(async tx=>{const r=await tx.get('SELECT * FROM reservations WHERE id=?',[id]); if(!r)return null; const valid={requested:['confirmed','cancelled','completed'],confirmed:['completed','cancelled'],completed:[],cancelled:[]}; if(!valid[r.status]?.includes(status)){const e=new Error('Reservation status transition is invalid.'); e.code='INVALID_STATUS_TRANSITION'; throw e} await tx.run('UPDATE reservations SET status=?, updated_at=? WHERE id=?',[status,now(),id]); if(status==='completed') await this.incrementUsage(r.user_id,r.membership_id,r.template_id,tx); return reservationFrom(await tx.get('SELECT * FROM reservations WHERE id=?',[id]))})}
  async adminUpdateAssistanceRequest(id,input={}){const row=await this.db.get('SELECT * FROM assistance_requests WHERE id=?',[id]); if(!row)return null; const status=input.status||row.status, adminNote=input.adminNote??row.admin_note??''; await this.db.run('UPDATE assistance_requests SET status=?, admin_note=?, updated_at=? WHERE id=?',[status,adminNote,now(),id]); return assistanceFrom(await this.db.get('SELECT * FROM assistance_requests WHERE id=?',[id]))}
  async audit(actor, action, targetType, targetId, beforeValue, afterValue, db=this.db) {
    await db.run('INSERT INTO audit_logs (id,actor_email,action,target_type,target_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)', [`aud_${cryptoId()}`, actor?.email || 'system', action, targetType, targetId, stringify(beforeValue), stringify(afterValue), now()])
  }
  async adminMe(user, role) {
    const permissions = role === 'admin' ? ['read','catalog:write','settlement:write','reservation:write','assistance:write'] : ['read','reservation:write','assistance:write']
    return { user, role, permissions }
  }
  async auditLogs(params = new URLSearchParams()) {
    let rows = (await this.db.all('SELECT * FROM audit_logs ORDER BY created_at DESC')).map(auditFrom)
    const from=params.get('from'), to=params.get('to'), actor=(params.get('actor')||'').toLowerCase()
    rows = rows.filter(r=>inRange(r.createdAt,from,to)&&(!actor||r.actorEmail.toLowerCase().includes(actor)))
    return paginate(rows, params)
  }
  async dashboard(params = new URLSearchParams()) {
    const from=params.get('from'), to=params.get('to')
    const orders=(await this.db.all('SELECT * FROM orders')).map(orderFrom).filter(o=>inRange(o.createdAt,from,to))
    const reservations=(await this.db.all('SELECT * FROM reservations')).map(reservationFrom).filter(r=>inRange(r.createdAt,from,to))
    const assistance=(await this.db.all('SELECT * FROM assistance_requests')).map(assistanceFrom).filter(a=>inRange(a.createdAt,from,to))
    const byStatus=(items,statuses)=>Object.fromEntries(statuses.map(s=>[s,items.filter(i=>i.status===s).length]))
    const activeMemberships=(await this.db.get("SELECT COUNT(*) AS count FROM user_memberships WHERE status='active'"))?.count||0
    const wallets=await this.db.all("SELECT DISTINCT user_id FROM user_memberships WHERE status='active'")
    let expiringVouchers=0
    for (const u of wallets) expiringVouchers+=(await this.wallet(u.user_id)).summary.expiringSoonCount
    const activated=orders.filter(o=>o.status==='activated')
    return { currency:'VND', gmv:activated.reduce((s,o)=>s+o.paidAmount,0), commission:activated.reduce((s,o)=>s+o.commissionAmount,0), orders:{total:orders.length,byStatus:byStatus(orders,['requested','invoiced','paid','activated','cancelled'])}, reservations:{total:reservations.length,byStatus:byStatus(reservations,['requested','confirmed','completed','cancelled'])}, assistance:{open:assistance.filter(a=>a.status!=='handled').length,handled:assistance.filter(a=>a.status==='handled').length}, activeMemberships, expiringVouchers }
  }
  async adminMemberships(params = new URLSearchParams()) {
    let rows=(await this.db.all('SELECT * FROM memberships ORDER BY brand,name')).map(membershipFrom)
    const q=(params.get('q')||'').toLowerCase(), brand=params.get('brand')
    if(q) rows=rows.filter(m=>[m.id,m.name,m.brand].join(' ').toLowerCase().includes(q))
    if(brand) rows=rows.filter(m=>m.brand===brand)
    return paginate(rows, params)
  }
  async adminMembership(id) {
    const m=membershipFrom(await this.db.get('SELECT * FROM memberships WHERE id=?',[id]))
    if(!m)return null
    return { ...m, vouchers: await this.adminVouchers(id) }
  }
  membershipColumns(input) {
    const annualFee = Number(input.annualFee || 0)
    const salePrice = input.salePrice == null ? null : Number(input.salePrice)
    const commissionRate = Number(input.commissionRate || 0)
    const paidAmount = salePrice != null ? salePrice : annualFee
    return [input.id,input.name,input.brand,input.country||input.countryId,stringify(input.cities||[]),stringify(input.hotels||[]),annualFee,input.currency||'VND',salePrice,paidAmount,commissionRate,Math.round(paidAmount*commissionRate),input.diningDiscount??null,input.roomDiscount??null,input.freeNight?1:0,input.spaBenefit?1:0,stringify(input.benefits||[]),stringify(input.bestFor||[]),Number(input.estimatedSavings||0),stringify(input.scores||{}),input.notes||'',input.officialUrl||'',input.active===false?0:1]
  }
  async createMembership(input, actor) {
    if(!input.id||!input.name||!input.brand){const e=new Error('id, name and brand are required.'); e.code='VALIDATION_ERROR'; throw e}
    await this.db.run(`INSERT INTO memberships (id,name,brand,country_id,cities,hotels,annual_fee,currency,sale_price,paid_amount,commission_rate,commission_amount,dining_discount,room_discount,free_night,spa_benefit,benefits,best_for,estimated_savings,scores,notes,official_url,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, this.membershipColumns(input))
    const after=await this.adminMembership(input.id); await this.audit(actor,'create','membership',input.id,null,after); return after
  }
  async updateMembership(id, input, actor) {
    const before=await this.adminMembership(id); if(!before)return null
    const next={...before,...input,id}
    await this.db.run(`UPDATE memberships SET name=?,brand=?,country_id=?,cities=?,hotels=?,annual_fee=?,currency=?,sale_price=?,paid_amount=?,commission_rate=?,commission_amount=?,dining_discount=?,room_discount=?,free_night=?,spa_benefit=?,benefits=?,best_for=?,estimated_savings=?,scores=?,notes=?,official_url=?,active=? WHERE id=?`, this.membershipColumns(next).slice(1).concat(id))
    const after=await this.adminMembership(id); await this.audit(actor,'update','membership',id,before,after); return after
  }
  async deleteMembership(id, actor) {
    const before=await this.adminMembership(id); if(!before)return null
    await this.db.run('UPDATE memberships SET active=0 WHERE id=?',[id]); const after=await this.adminMembership(id); await this.audit(actor,'delete','membership',id,before,after); return after
  }
  async adminVouchers(membershipId) {
    const rows=(await this.db.all('SELECT * FROM voucher_templates WHERE membership_id=? ORDER BY id',[membershipId])).map(r=>voucherFrom(r))
    const out=[]
    for(const v of rows) out.push({ ...v, ...(await this.voucherUsage(v.templateId)) })
    return out
  }
  async voucherUsage(templateId) {
    const row=await this.db.get('SELECT quantity FROM voucher_templates WHERE template_id=?',[templateId])
    const used=(await this.db.get('SELECT COALESCE(SUM(used_count),0) AS count FROM voucher_usage WHERE template_id=?',[templateId]))?.count||0
    const held=(await this.db.get("SELECT COUNT(*) AS count FROM reservations WHERE template_id=? AND status IN ('requested','confirmed')",[templateId]))?.count||0
    const transferred=(await this.db.get('SELECT COUNT(*) AS count FROM transfers WHERE template_id=?',[templateId]))?.count||0
    return { issued:Number(row?.quantity)||0, used:Number(used), held:Number(held), transferred:Number(transferred), available:Math.max(0,(Number(row?.quantity)||0)-Number(used)-Number(held)-Number(transferred)) }
  }
  async createVoucher(membershipId, input, actor) {
    if(!input.templateId||!input.title){const e=new Error('templateId and title are required.'); e.code='VALIDATION_ERROR'; throw e}
    const id=`${membershipId}:${input.templateId}`
    await this.db.run('INSERT INTO voucher_templates (id,membership_id,template_id,category,title,description,quantity,valid_until,city_id,hotels,transferable,note,i18n) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,membershipId,input.templateId,input.category||'other',input.title,input.description||'',Number(input.quantity||1),input.validUntil||'2026-12-31',input.city||null,stringify(input.hotels||[]),input.transferable?1:0,input.note||'',stringify(input.i18n || {})])
    const base=CATEGORY_DEFAULTS[input.category]||CATEGORY_DEFAULTS.other
    await this.db.run('INSERT INTO voucher_availability (template_id,days_of_week,min_lead_days,max_advance_days,blackouts,updated_at) VALUES (?,?,?,?,?,?)',[input.templateId,stringify(base.daysOfWeek),base.minLeadDays,base.maxAdvanceDays,stringify([]),now()])
    const after=await this.voucherByTemplate(input.templateId); await this.audit(actor,'create','voucher',input.templateId,null,after); return after
  }
  async voucherByTemplate(templateId) { const row=await this.db.get('SELECT * FROM voucher_templates WHERE template_id=?',[templateId]); return row?{...voucherFrom(row),...(await this.voucherUsage(templateId))}:null }
  async updateVoucher(templateId, input, actor) {
    const before=await this.voucherByTemplate(templateId); if(!before)return null
    const next={...before,...input}
    await this.db.run('UPDATE voucher_templates SET category=?,title=?,description=?,quantity=?,valid_until=?,city_id=?,hotels=?,transferable=?,note=?,i18n=? WHERE template_id=?',[next.category,next.title,next.description||'',Number(next.quantity||0),next.validUntil,next.city||null,stringify(next.hotels||[]),next.transferable?1:0,next.note||'',stringify(next.i18n || {}),templateId])
    const after=await this.voucherByTemplate(templateId); await this.audit(actor,'update','voucher',templateId,before,after); return after
  }
  async deleteVoucher(templateId, actor) {
    const before=await this.voucherByTemplate(templateId); if(!before)return null
    await this.db.run('DELETE FROM voucher_templates WHERE template_id=?',[templateId]); await this.audit(actor,'delete','voucher',templateId,before,null); return before
  }
  async voucherAvailability(templateId) {
    const v=await this.voucherByTemplate(templateId); if(!v)return null
    const rule=availabilityFrom(await this.db.get('SELECT * FROM voucher_availability WHERE template_id=?',[templateId])) || { ...(CATEGORY_DEFAULTS[v.category] || CATEGORY_DEFAULTS.other), blackouts: [] }
    const m=membershipFrom(await this.db.get('SELECT * FROM memberships WHERE id=?',[v.membershipId]))
    const holidays=(await this.db.all('SELECT * FROM holidays WHERE country_id=? ORDER BY from_date',[m?.country||''])).map(holidayFrom).map(h=>({from:h.from,to:h.to,key:h.key,label:h.label}))
    return { ...rule, blackouts:[...(rule.blackouts||[]),...holidays], validUntil:v.validUntil }
  }
  async setVoucherAvailability(templateId, input, actor) {
    const before=await this.voucherAvailability(templateId); if(!before)return null
    const next={ daysOfWeek:input.daysOfWeek||ALL_DAYS, minLeadDays:Number(input.minLeadDays||0), maxAdvanceDays:Number(input.maxAdvanceDays||120), blackouts:input.blackouts||[] }
    await this.db.run(`INSERT INTO voucher_availability (template_id,days_of_week,min_lead_days,max_advance_days,blackouts,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT (template_id) DO UPDATE SET days_of_week=excluded.days_of_week,min_lead_days=excluded.min_lead_days,max_advance_days=excluded.max_advance_days,blackouts=excluded.blackouts,updated_at=excluded.updated_at`, [templateId,stringify(next.daysOfWeek),next.minLeadDays,next.maxAdvanceDays,stringify(next.blackouts),now()])
    const after=await this.voucherAvailability(templateId); await this.audit(actor,'update','availability',templateId,before,after); return after
  }
  async evaluateAvailability(membershipId, templateId, iso, db=this.db) {
    const date=parseLocalDate(iso); if(!date)return { ok:false, reason:'invalid' }
    const row=await db.get('SELECT vt.*, m.country_id FROM voucher_templates vt JOIN memberships m ON m.id=vt.membership_id WHERE vt.membership_id=? AND vt.template_id=?',[membershipId,templateId])
    if(!row)return { ok:false, reason:'closed' }
    const rule=availabilityFrom(await db.get('SELECT * FROM voucher_availability WHERE template_id=?',[templateId])) || { ...(CATEGORY_DEFAULTS[row.category] || CATEGORY_DEFAULTS.other), blackouts: [] }
    const holidays=(await db.all('SELECT * FROM holidays WHERE country_id=?',[row.country_id])).map(holidayFrom)
    const d=startOfDay(date), lead=dayDiff(d,startOfDay(new Date()))
    const exp=parseLocalDate(row.valid_until)
    if(exp&&d>startOfDay(exp))return { ok:false, reason:'expired' }
    if(lead<(rule.minLeadDays||0))return { ok:false, reason:'leadTime' }
    if(rule.maxAdvanceDays!=null&&lead>rule.maxAdvanceDays)return { ok:false, reason:'tooFar' }
    for(const b of [...(rule.blackouts||[]),...holidays]){const from=parseLocalDate(b.from), to=parseLocalDate(b.to); if(from&&to&&d>=startOfDay(from)&&d<=startOfDay(to))return { ok:false, reason:'blackout', holidayKey:b.key }}
    const allowed=rule.daysOfWeek||ALL_DAYS, dow=d.getDay()
    if(!allowed.includes(dow))return { ok:false, reason:dow===0||dow===6?'weekend':'closed' }
    return { ok:true }
  }
  async holidays(params = new URLSearchParams()) {
    let rows=(await this.db.all('SELECT * FROM holidays ORDER BY from_date')).map(holidayFrom)
    const country=params.get('country'); if(country)rows=rows.filter(h=>h.country===country)
    return paginate(rows, params)
  }
  async createHoliday(input, actor) { const id=input.id||`hol_${cryptoId()}`, ts=now(); await this.db.run('INSERT INTO holidays (id,country_id,from_date,to_date,key,label,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',[id,input.country,input.from,input.to,input.key,input.label||input.key,ts,ts]); const after=holidayFrom(await this.db.get('SELECT * FROM holidays WHERE id=?',[id])); await this.audit(actor,'create','holiday',id,null,after); return after }
  async updateHoliday(id,input,actor){const before=holidayFrom(await this.db.get('SELECT * FROM holidays WHERE id=?',[id])); if(!before)return null; const next={...before,...input}; await this.db.run('UPDATE holidays SET country_id=?,from_date=?,to_date=?,key=?,label=?,updated_at=? WHERE id=?',[next.country,next.from,next.to,next.key,next.label||next.key,now(),id]); const after=holidayFrom(await this.db.get('SELECT * FROM holidays WHERE id=?',[id])); await this.audit(actor,'update','holiday',id,before,after); return after}
  async deleteHoliday(id,actor){const before=holidayFrom(await this.db.get('SELECT * FROM holidays WHERE id=?',[id])); if(!before)return null; await this.db.run('DELETE FROM holidays WHERE id=?',[id]); await this.audit(actor,'delete','holiday',id,before,null); return before}
  async adminUsers(params = new URLSearchParams()) {
    let rows=await this.db.all('SELECT u.*, COUNT(um.id) AS memberships_count FROM users u LEFT JOIN user_memberships um ON um.user_id=u.id AND um.status=\'active\' GROUP BY u.id ORDER BY u.created_at DESC')
    const q=(params.get('q')||'').toLowerCase(); if(q)rows=rows.filter(u=>[u.email,u.name].join(' ').toLowerCase().includes(q))
    return paginate(rows.map(u=>({...userFrom(u),membershipsCount:Number(u.memberships_count)||0})), params)
  }
  async adminUser(id) { const user=await this.getUserById(id); if(!user)return null; return { user, wallet: await this.wallet(id) } }
  async settlement(params = new URLSearchParams()) {
    const from=params.get('from'), to=params.get('to'), brand=params.get('brand')
    let orders=(await this.db.all("SELECT o.*, m.brand FROM orders o JOIN memberships m ON m.id=o.membership_id WHERE o.status='activated'")).map(r=>({...orderFrom(r),brand:r.brand})).filter(o=>inRange(o.createdAt,from,to))
    if(brand)orders=orders.filter(o=>o.brand===brand)
    const byBrand=Object.values(orders.reduce((acc,o)=>{const k=o.membershipId; acc[k]??={membershipId:k,gmv:0,commission:0,orders:0}; acc[k].gmv+=o.paidAmount; acc[k].commission+=o.commissionAmount; acc[k].orders+=1; return acc},{}))
    const byPeriod=Object.values(orders.reduce((acc,o)=>{const k=dateOnly(o.createdAt); acc[k]??={date:k,gmv:0,commission:0}; acc[k].gmv+=o.paidAmount; acc[k].commission+=o.commissionAmount; return acc},{})).sort((a,b)=>a.date.localeCompare(b.date))
    return {gmv:orders.reduce((s,o)=>s+o.paidAmount,0),commission:orders.reduce((s,o)=>s+o.commissionAmount,0),activatedOrderCount:orders.length,currency:'VND',byBrand,byPeriod}
  }
  async adminAssistanceRequests(params = null){let rows=(await this.db.all('SELECT * FROM assistance_requests ORDER BY created_at DESC')).map(assistanceFrom); if(!params)return rows; const status=params.get('status'), q=(params.get('q')||'').toLowerCase(); if(status)rows=rows.filter(a=>a.status===status); if(q)rows=rows.filter(a=>[a.name,a.contact,a.message].join(' ').toLowerCase().includes(q)); return paginate(rows,params)}
  async csvOrders(params = new URLSearchParams()){let rows=(await this.db.all('SELECT * FROM orders ORDER BY created_at DESC')).map(orderFrom); const status=params.get('status'), from=params.get('from'), to=params.get('to'); rows=rows.filter(o=>(!status||o.status===status)&&inRange(o.createdAt,from,to)); return this.toCsv(['id','membershipId','buyerEmail','status','paidAmount','commissionAmount','currency','createdAt'],rows)}
  async csvSettlements(params = new URLSearchParams()){const s=await this.settlement(params); return this.toCsv(['membershipId','gmv','commission','orders'],s.byBrand)}
  toCsv(headers, rows){const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`; return [headers.join(','),...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n')}
}
