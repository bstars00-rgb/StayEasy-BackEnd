import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { URL } from 'node:url'
import { OhmySelectStore } from './db.js'

const PORT = Number(process.env.PORT || 8787)
const API_PREFIX = '/api/v1'
const store = await OhmySelectStore.open()

function now() { return new Date().toISOString() }
function makeId(prefix) { return `${prefix}_${randomUUID().slice(0, 8)}` }
function headers(extra = {}) { return { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Max-Age': '600', ...extra } }
function json(res, status, payload) { res.writeHead(status, headers()); res.end(JSON.stringify(payload)) }
function csv(res, filename, payload) { res.writeHead(200, headers({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` })); res.end(payload) }
function noContent(res) { res.writeHead(204, headers()); res.end() }
function error(res, status, code, message, details = {}) { json(res, status, { code, message, details }) }
function statusFor(code) { return { AUTH_REQUIRED:401, ADMIN_REQUIRED:403, FORBIDDEN:403, NOT_FOUND:404, MEMBERSHIP_NOT_FOUND:404, VOUCHER_NOT_FOUND:404, ORDER_NOT_FOUND:404, RESERVATION_NOT_FOUND:404, ASSISTANCE_REQUEST_NOT_FOUND:404, VOUCHER_NOT_AVAILABLE:409, VOUCHER_NOT_TRANSFERABLE:409, INVALID_STATUS_TRANSITION:409, DATE_NOT_AVAILABLE:409, VALIDATION_ERROR:400 }[code] || 500 }
async function readBody(req) { const chunks=[]; for await (const c of req) chunks.push(c); if(!chunks.length)return {}; try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return {}} }
async function currentUser(req) { const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):''; return token ? store.userByToken(token) : null }
async function requireUser(req,res){const user=await currentUser(req); if(!user){error(res,401,'AUTH_REQUIRED','Sign in is required.'); return null} return user}
function adminEmails(){return new Set(String(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean))}
function operatorEmails(){return new Set(String(process.env.OPERATOR_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean))}
function roleFor(user){const email=String(user?.email||'').toLowerCase(); if(adminEmails().has(email)||user?.role==='admin')return 'admin'; if(operatorEmails().has(email))return 'operator'; return null}
function withEffectiveRole(user){return user ? {...user, role: roleFor(user)} : user}
async function requireBackoffice(req,res,minRole='operator'){const user=await requireUser(req,res); if(!user)return null; const role=roleFor(user); if(!role||(minRole==='admin'&&role!=='admin')){error(res,403,'ADMIN_REQUIRED','Admin access is required.'); return null} return {...user, role}}
async function requireAdmin(req,res){return requireBackoffice(req,res,'admin')}
function normalizePath(pathname){const raw=pathname.replace(/\/+$/,'')||'/'; return raw.startsWith(API_PREFIX)?raw.slice(API_PREFIX.length)||'/':raw}

async function route(req,res){
  if(req.method==='OPTIONS') return noContent(res)
  const url=new URL(req.url,`http://${req.headers.host}`)
  const path=normalizePath(url.pathname)
  const body=['POST','PATCH','PUT'].includes(req.method)?await readBody(req):{}

  if(req.method==='GET'&&path==='/') return json(res,200,{ok:true,service:'ohmyselect-backend',persistence:store.db.mode||'memory',docs:'/api/v1/health'})
  if(req.method==='GET'&&path==='/health') return json(res,200,{ok:true,service:'ohmyselect-backend',persistence:store.db.mode||'memory',time:now()})
  if(req.method==='GET'&&path==='/cities') return json(res,200,await store.db.all('SELECT id, country_id AS country FROM cities WHERE active = 1 ORDER BY sort_order'))
  if(req.method==='POST'&&path==='/auth/google'){const user=await store.upsertDemoUser(body.credential||body.idToken,makeId); const token=`demo_${randomUUID()}`; store.rememberToken(token,user); return json(res,200,{accessToken:token,refreshToken:token,token,user:withEffectiveRole(user)})}
  if(req.method==='GET'&&(path==='/auth/me'||path==='/me')){const user=await requireUser(req,res); if(!user)return; return json(res,200,withEffectiveRole(user))}
  if(req.method==='POST'&&path==='/auth/logout') return noContent(res)
  if(req.method==='GET'&&path==='/memberships') return json(res,200,await store.memberships(url.searchParams))
  if(req.method==='GET'&&path==='/memberships/compare'){const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean); return json(res,200,await store.compare(ids))}
  const membershipVoucherMatch=path.match(/^\/memberships\/([^/]+)\/vouchers$/)
  if(req.method==='GET'&&membershipVoucherMatch) return json(res,200,await store.voucherTemplates(membershipVoucherMatch[1]))
  const membershipMatch=path.match(/^\/memberships\/([^/]+)$/)
  if(req.method==='GET'&&membershipMatch){const membership=await store.membership(membershipMatch[1]); if(!membership)return error(res,404,'MEMBERSHIP_NOT_FOUND','Membership was not found.'); return json(res,200,{...membership,vouchers:await store.voucherTemplates(membership.id)})}
  const publicAvailabilityMatch=path.match(/^\/vouchers\/([^/]+)\/availability$/)
  if(req.method==='GET'&&publicAvailabilityMatch){const rule=await store.voucherAvailability(publicAvailabilityMatch[1]); if(!rule)return error(res,404,'VOUCHER_NOT_FOUND','Voucher was not found.'); return json(res,200,rule)}

  if(path.startsWith('/admin/')){
    const admin=await requireBackoffice(req,res); if(!admin)return
    if(req.method==='GET'&&path==='/admin/me') return json(res,200,await store.adminMe(admin,admin.role))
    if(req.method==='GET'&&path==='/admin/dashboard') return json(res,200,await store.dashboard(url.searchParams))
    if(req.method==='GET'&&path==='/admin/audit-logs') return json(res,200,await store.auditLogs(url.searchParams))
    if(req.method==='GET'&&path==='/admin/users') return json(res,200,await store.adminUsers(url.searchParams))
    const adminUserMatch=path.match(/^\/admin\/users\/([^/]+)$/)
    if(req.method==='GET'&&adminUserMatch){const user=await store.adminUser(adminUserMatch[1]); if(!user)return error(res,404,'NOT_FOUND','User was not found.'); return json(res,200,user)}
    if(req.method==='GET'&&path==='/admin/memberships') return json(res,200,await store.adminMemberships(url.searchParams))
    if(req.method==='POST'&&path==='/admin/memberships'){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); try{return json(res,201,await store.createMembership(body,admin))}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message,err.details)}}
    const adminMembershipVoucherMatch=path.match(/^\/admin\/memberships\/([^/]+)\/vouchers$/)
    if(req.method==='GET'&&adminMembershipVoucherMatch) return json(res,200,await store.adminVouchers(adminMembershipVoucherMatch[1]))
    if(req.method==='POST'&&adminMembershipVoucherMatch){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); try{return json(res,201,await store.createVoucher(adminMembershipVoucherMatch[1],body,admin))}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message,err.details)}}
    const adminMembershipMatch=path.match(/^\/admin\/memberships\/([^/]+)$/)
    if(req.method==='GET'&&adminMembershipMatch){const membership=await store.adminMembership(adminMembershipMatch[1]); if(!membership)return error(res,404,'MEMBERSHIP_NOT_FOUND','Membership was not found.'); return json(res,200,membership)}
    if(req.method==='PATCH'&&adminMembershipMatch){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); try{const membership=await store.updateMembership(adminMembershipMatch[1],body,admin); if(!membership)return error(res,404,'MEMBERSHIP_NOT_FOUND','Membership was not found.'); return json(res,200,membership)}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message,err.details)}}
    if(req.method==='DELETE'&&adminMembershipMatch){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); const membership=await store.deleteMembership(adminMembershipMatch[1],admin); if(!membership)return error(res,404,'MEMBERSHIP_NOT_FOUND','Membership was not found.'); return json(res,200,membership)}
    const adminVoucherAvailabilityMatch=path.match(/^\/admin\/vouchers\/([^/]+)\/availability$/)
    if(req.method==='GET'&&adminVoucherAvailabilityMatch){const rule=await store.voucherAvailability(adminVoucherAvailabilityMatch[1]); if(!rule)return error(res,404,'VOUCHER_NOT_FOUND','Voucher was not found.'); return json(res,200,rule)}
    if(req.method==='PUT'&&adminVoucherAvailabilityMatch){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); const rule=await store.setVoucherAvailability(adminVoucherAvailabilityMatch[1],body,admin); if(!rule)return error(res,404,'VOUCHER_NOT_FOUND','Voucher was not found.'); return json(res,200,rule)}
    const adminVoucherUsageMatch=path.match(/^\/admin\/vouchers\/([^/]+)\/usage$/)
    if(req.method==='GET'&&adminVoucherUsageMatch) return json(res,200,await store.voucherUsage(adminVoucherUsageMatch[1]))
    const adminVoucherMatch=path.match(/^\/admin\/vouchers\/([^/]+)$/)
    if(req.method==='PATCH'&&adminVoucherMatch){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); try{const voucher=await store.updateVoucher(adminVoucherMatch[1],body,admin); if(!voucher)return error(res,404,'VOUCHER_NOT_FOUND','Voucher was not found.'); return json(res,200,voucher)}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message,err.details)}}
    if(req.method==='DELETE'&&adminVoucherMatch){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); const voucher=await store.deleteVoucher(adminVoucherMatch[1],admin); if(!voucher)return error(res,404,'VOUCHER_NOT_FOUND','Voucher was not found.'); return json(res,200,voucher)}
    if(req.method==='GET'&&path==='/admin/holidays') return json(res,200,await store.holidays(url.searchParams))
    if(req.method==='POST'&&path==='/admin/holidays'){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); try{return json(res,201,await store.createHoliday(body,admin))}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message,err.details)}}
    const adminHolidayMatch=path.match(/^\/admin\/holidays\/([^/]+)$/)
    if(req.method==='PATCH'&&adminHolidayMatch){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); const holiday=await store.updateHoliday(adminHolidayMatch[1],body,admin); if(!holiday)return error(res,404,'NOT_FOUND','Holiday was not found.'); return json(res,200,holiday)}
    if(req.method==='DELETE'&&adminHolidayMatch){if(admin.role!=='admin')return error(res,403,'ADMIN_REQUIRED','Admin access is required.'); const holiday=await store.deleteHoliday(adminHolidayMatch[1],admin); if(!holiday)return error(res,404,'NOT_FOUND','Holiday was not found.'); return json(res,200,holiday)}
    if(req.method==='GET'&&path==='/admin/reports/orders.csv') return csv(res,'orders.csv',await store.csvOrders(url.searchParams))
    if(req.method==='GET'&&path==='/admin/reports/settlements.csv') return csv(res,'settlements.csv',await store.csvSettlements(url.searchParams))
    if(req.method==='GET'&&path==='/admin/orders') return json(res,200,await store.adminOrders())
    const adminOrderMatch=path.match(/^\/admin\/orders\/([^/]+)\/status$/)
    if(req.method==='PATCH'&&adminOrderMatch){try{const order=await store.adminUpdateOrderStatus(adminOrderMatch[1],body.status); if(!order)return error(res,404,'ORDER_NOT_FOUND','Order was not found.'); await store.audit(admin,'update','order',order.id,null,order); return json(res,200,order)}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message,err.details)}}
    if(req.method==='GET'&&path==='/admin/reservations') return json(res,200,await store.adminReservations())
    const adminReservationMatch=path.match(/^\/admin\/reservations\/([^/]+)\/status$/)
    if(req.method==='PATCH'&&adminReservationMatch){try{const reservation=await store.adminUpdateReservationStatus(adminReservationMatch[1],body.status); if(!reservation)return error(res,404,'RESERVATION_NOT_FOUND','Reservation was not found.'); await store.audit(admin,'update','reservation',reservation.id,null,reservation); return json(res,200,reservation)}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message,err.details)}}
    if(req.method==='GET'&&path==='/admin/assistance-requests') return json(res,200, url.search ? await store.adminAssistanceRequests(url.searchParams) : await store.adminAssistanceRequests())
    const adminAssistanceMatch=path.match(/^\/admin\/assistance-requests\/([^/]+)$/)
    if(req.method==='PATCH'&&adminAssistanceMatch){const request=await store.adminUpdateAssistanceRequest(adminAssistanceMatch[1],body); if(!request)return error(res,404,'ASSISTANCE_REQUEST_NOT_FOUND','Assistance request was not found.'); await store.audit(admin,'update','assistance',request.id,null,request); return json(res,200,request)}
    if(req.method==='GET'&&path==='/admin/settlements/summary') return json(res,200,await store.settlement())
    return error(res,404,'NOT_FOUND','Endpoint was not found.')
  }

  if(req.method==='GET'&&(path==='/me/wallet'||path==='/wallet')){const user=await requireUser(req,res); if(!user)return; return json(res,200,await store.wallet(user.id))}
  if(req.method==='POST'&&(path==='/me/memberships'||path==='/wallet/memberships')){const user=await requireUser(req,res); if(!user)return; if(!(await store.addMembership(user.id,body.membershipId,body.source||'free_join')))return error(res,404,'MEMBERSHIP_NOT_FOUND','Membership was not found.'); return json(res,201,await store.wallet(user.id))}
  const ownedMembershipMatch=path.match(/^\/me\/memberships\/([^/]+)$/)||path.match(/^\/wallet\/memberships\/([^/]+)$/)
  if(req.method==='DELETE'&&ownedMembershipMatch){const user=await requireUser(req,res); if(!user)return; await store.removeMembership(user.id,ownedMembershipMatch[1]); return noContent(res)}
  if(req.method==='GET'&&path==='/wallet/vouchers'){const user=await requireUser(req,res); if(!user)return; const category=url.searchParams.get('category'), membershipId=url.searchParams.get('membershipId'); let vouchers=(await store.wallet(user.id)).vouchers; if(membershipId)vouchers=vouchers.filter(v=>v.membershipId===membershipId); if(category&&category!=='all')vouchers=vouchers.filter(v=>v.category===category); return json(res,200,vouchers)}

  if(req.method==='GET'&&(path==='/me/reservations'||path==='/reservations')){const user=await requireUser(req,res); if(!user)return; return json(res,200,await store.reservations(user.id))}
  if(req.method==='POST'&&(path==='/me/reservations'||path==='/reservations')){const user=await requireUser(req,res); if(!user)return; try{return json(res,201,await store.createReservation(user.id,body,makeId))}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message)}}
  const reservationMatch=path.match(/^\/me\/reservations\/([^/]+)$/)||path.match(/^\/reservations\/([^/]+)$/)||path.match(/^\/reservations\/([^/]+)\/status$/)
  if(reservationMatch){const user=await requireUser(req,res); if(!user)return; const id=reservationMatch[1]; if(req.method==='PATCH'){try{const reservation=await store.updateReservationStatus(user.id,id,body.status); if(!reservation)return error(res,404,'RESERVATION_NOT_FOUND','Reservation was not found.'); return json(res,200,reservation)}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message)}} if(req.method==='DELETE'){await store.deleteReservation(user.id,id); return noContent(res)}}

  if(req.method==='GET'&&(path==='/me/orders'||path==='/orders')){const user=await requireUser(req,res); if(!user)return; return json(res,200,await store.orders(user.id))}
  if(req.method==='POST'&&(path==='/me/orders'||path==='/orders')){const user=await requireUser(req,res); if(!user)return; const order=await store.createOrder(user.id,body,user,makeId); if(!order)return error(res,404,'MEMBERSHIP_NOT_FOUND','Membership was not found.'); return json(res,201,order)}
  const orderMatch=path.match(/^\/me\/orders\/([^/]+)$/)||path.match(/^\/orders\/([^/]+)$/)||path.match(/^\/orders\/([^/]+)\/status$/)
  if(req.method==='PATCH'&&orderMatch){const user=await requireUser(req,res); if(!user)return; try{const order=await store.updateOrderStatus(user.id,orderMatch[1],body.status); if(!order)return error(res,404,'ORDER_NOT_FOUND','Order was not found.'); return json(res,200,order)}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message)}}

  if(req.method==='GET'&&(path==='/me/transfers'||path==='/transfers')){const user=await requireUser(req,res); if(!user)return; return json(res,200,await store.transfers(user.id))}
  if(req.method==='POST'&&(path==='/me/transfers'||path==='/transfers')){const user=await requireUser(req,res); if(!user)return; try{return json(res,201,await store.createTransfer(user.id,body,makeId))}catch(err){return error(res,statusFor(err.code),err.code||'INTERNAL_ERROR',err.message)}}
  if(req.method==='GET'&&(path==='/partner/settlement'||path==='/settlements/summary')) return json(res,200,await store.settlement())
  if(req.method==='POST'&&(path==='/assistance'||path==='/assistance-requests')){const user=await currentUser(req); return json(res,201,await store.createAssistance(body,makeId,user?.id||null))}
  if(req.method==='POST'&&path==='/recommendations/quiz'){const city=body.city, benefits=Array.isArray(body.benefits)?body.benefits:[]; const ranked=(await store.memberships(new URLSearchParams())).map(m=>{let score=m.scores.overall||0; if(city&&m.cities.includes(city))score+=15; for(const b of benefits)if(m.bestFor.includes(b))score+=10; if(body.budget==='free_only'&&m.annualFee>0)score-=25; return {membership:m,score,reasons:[...(city&&m.cities.includes(city)?['city_match']:[]),...benefits.filter(b=>m.bestFor.includes(b)).map(b=>`benefit_${b}`)]}}).sort((a,b)=>b.score-a.score).slice(0,3); return json(res,200,ranked)}
  return error(res,404,'NOT_FOUND','Endpoint was not found.')
}

const server=http.createServer((req,res)=>{route(req,res).catch(err=>{console.error(err); error(res,500,'INTERNAL_ERROR','Unexpected server error.')})})
server.listen(PORT,'0.0.0.0',()=>{console.log(`OhmySelect backend listening on http://0.0.0.0:${PORT}`)})
