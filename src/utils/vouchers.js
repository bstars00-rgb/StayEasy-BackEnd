// Pure voucher inventory math (no storage/React) so it can be unit-tested.
//
// available = quantity − used − held − transferred
//   used        : vouchers already consumed (completed reservations)
//   held        : vouchers tied up by in-progress reservations (requested/confirmed)
//   transferred : vouchers gifted to someone else
// This prevents double-booking / over-gifting the last voucher.
export function voucherStats(quantity, used = 0, held = 0, transferred = 0) {
  const q = Number(quantity) || 0
  const u = Math.max(0, Number(used) || 0)
  const h = Math.max(0, Number(held) || 0)
  const x = Math.max(0, Number(transferred) || 0)
  return { quantity: q, used: u, held: h, transferred: x, available: Math.max(0, q - u - h - x) }
}

// Reservation statuses that hold inventory (not yet consumed, not cancelled).
export const OPEN_RESERVATION_STATUSES = ['requested', 'confirmed']

export function countOpenReservations(reservations, membershipId, templateId) {
  return reservations.filter(
    (r) =>
      r.membershipId === membershipId &&
      r.templateId === templateId &&
      OPEN_RESERVATION_STATUSES.includes(r.status)
  ).length
}

export function countTransfers(transfers, membershipId, templateId) {
  return transfers.filter((x) => x.membershipId === membershipId && x.templateId === templateId).length
}
