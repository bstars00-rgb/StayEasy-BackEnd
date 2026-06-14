// Centralized membership mock data for OhmySelect.
//
// FIELD REFERENCE
//  id              stable id (URLs, localStorage)
//  name            program name (kept in English)
//  brand           parent brand (English)
//  country         country id (translated via countries.<id>)
//  cities          city ids where the program is relevant
//  hotels          representative properties (English, sample data)
//  annualFee       number; 0 means free to join
//  currency        ISO code used for annualFee + estimatedSavings (VND/USD/KRW)
//  benefits        short English descriptions (mock; OK to stay English)
//  diningDiscount  percentage number, or null = "member rate / varies"
//  roomDiscount    percentage number, or null = "member rate / varies"
//  freeNight       boolean — offers a free-night benefit
//  spaBenefit      boolean — offers a spa benefit
//  bestFor         tag ids (translated via tags.<id>)
//  notes           program-specific note (English, mock)
//  officialUrl     official brand site (opens in a new tab)
//  estimatedSavings approx. annual savings in `currency` (mock)
//  scores          0–100 ratings used by Compare bars and the quiz
//                  { familyDining, staycation, businessTravel, easeOfUse, overall }
//
// TAXONOMIES
//  Benefit tags (bestFor / filters / quiz): see TAGS below.
//
// To add a membership later, copy one object and edit the fields. To wire a
// backend, replace this export with a fetch that returns the same shape.

export const TAGS = [
  'hotelBuffet',
  'familyDining',
  'staycation',
  'businessTravel',
  'spa',
  'barLounge',
  'freeNight',
  'roomDiscount',
]

export const memberships = [
  {
    id: 'club-marriott-vietnam',
    name: 'Club Marriott Vietnam',
    brand: 'Marriott',
    country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang', 'hanoi'],
    hotels: [
      'Sheraton Saigon Grand Opera Hotel',
      'Le Méridien Saigon',
      'Sheraton Grand Danang Resort',
      'JW Marriott Hotel Hanoi',
    ],
    annualFee: 4500000,
    currency: 'VND',
    benefits: [
      'Up to 50% off food for up to 4 diners',
      'Up to 20% off best available room rates',
      '20% off spa treatments',
      'Birthday dining reward',
    ],
    diningDiscount: 50,
    roomDiscount: 20,
    freeNight: false,
    spaBenefit: true,
    bestFor: ['familyDining', 'hotelBuffet', 'staycation'],
    notes: 'Strongest pick for frequent hotel dining in Vietnam; dining discount scales with group size.',
    officialUrl: 'https://www.clubmarriott.asia/',
    estimatedSavings: 12000000,
    scores: { familyDining: 95, staycation: 80, businessTravel: 60, easeOfUse: 85, overall: 90 },
  },
  {
    id: 'accor-plus-vietnam',
    name: 'Accor Plus Vietnam',
    brand: 'Accor',
    country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang', 'hanoi', 'bangkok'],
    hotels: [
      'Sofitel Saigon Plaza',
      'Pullman Saigon Centre',
      'Pullman Danang Beach Resort',
      'Novotel Hanoi Thai Ha',
    ],
    annualFee: 4900000,
    currency: 'VND',
    benefits: [
      'One complimentary stay night every year',
      'Up to 50% off dining for member + guests',
      'Member-only room rates',
      'Earn elite status faster',
    ],
    diningDiscount: 50,
    roomDiscount: 10,
    freeNight: true,
    spaBenefit: false,
    bestFor: ['familyDining', 'staycation', 'freeNight'],
    notes: 'Includes a free stay night that can offset most of the annual fee on its own.',
    officialUrl: 'https://www.accorplus.com/',
    estimatedSavings: 13000000,
    scores: { familyDining: 88, staycation: 90, businessTravel: 70, easeOfUse: 80, overall: 89 },
  },
  {
    id: 'hilton-honors-vietnam',
    name: 'Hilton Honors Vietnam',
    brand: 'Hilton',
    country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang'],
    hotels: ['Hilton Saigon', 'Hilton Da Nang', 'DoubleTree by Hilton Saigon'],
    annualFee: 0,
    currency: 'VND',
    benefits: [
      'Free to join',
      'Earn points on stays and dining',
      'Exclusive member room rates',
      'Free Wi-Fi and digital check-in',
    ],
    diningDiscount: null,
    roomDiscount: null,
    freeNight: true,
    spaBenefit: false,
    bestFor: ['businessTravel', 'staycation', 'freeNight'],
    notes: 'Free loyalty program; value comes from points redemptions rather than fixed discounts.',
    officialUrl: 'https://www.hilton.com/en/hilton-honors/',
    estimatedSavings: 6000000,
    scores: { familyDining: 55, staycation: 78, businessTravel: 90, easeOfUse: 92, overall: 84 },
  },
  {
    id: 'ihg-one-rewards-vietnam',
    name: 'IHG One Rewards Vietnam',
    brand: 'IHG',
    country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang'],
    hotels: [
      'InterContinental Danang Sun Peninsula Resort',
      'Holiday Inn & Suites Saigon Airport',
      'InterContinental Saigon',
    ],
    annualFee: 0,
    currency: 'VND',
    benefits: [
      'Free to join',
      'Fourth reward night free',
      'Up to 20% off dining at select hotels',
      'Milestone rewards',
    ],
    diningDiscount: 20,
    roomDiscount: null,
    freeNight: true,
    spaBenefit: true,
    bestFor: ['businessTravel', 'familyDining', 'freeNight'],
    notes: 'Good all-rounder; fourth-night-free adds up on longer reward stays.',
    officialUrl: 'https://www.ihg.com/onerewards/',
    estimatedSavings: 7000000,
    scores: { familyDining: 70, staycation: 75, businessTravel: 88, easeOfUse: 85, overall: 82 },
  },
  {
    id: 'shangri-la-circle',
    name: 'Shangri-La Circle',
    brand: 'Shangri-La',
    country: 'thailand',
    cities: ['bangkok', 'tokyo'],
    hotels: ['Shangri-La Bangkok', 'Shangri-La Tokyo'],
    annualFee: 0,
    currency: 'USD',
    benefits: [
      'Free to join',
      'Flexible points usable for rooms or dining',
      'Room upgrades for higher tiers',
      'Spa and dining privileges',
    ],
    diningDiscount: 30,
    roomDiscount: null,
    freeNight: true,
    spaBenefit: true,
    bestFor: ['staycation', 'spa', 'businessTravel', 'barLounge'],
    notes: 'Points are flexible across rooms and dining, which suits varied trip types.',
    officialUrl: 'https://www.shangri-la.com/circle/',
    estimatedSavings: 350,
    scores: { familyDining: 68, staycation: 86, businessTravel: 84, easeOfUse: 80, overall: 83 },
  },
  {
    id: 'hotel-nikko-saigon-dining-club',
    name: 'Hotel Nikko Saigon Dining Club',
    brand: 'Nikko',
    country: 'vietnam',
    cities: ['ho-chi-minh'],
    hotels: ['Hotel Nikko Saigon'],
    annualFee: 2900000,
    currency: 'VND',
    benefits: [
      'Up to 25% off restaurants and buffet',
      'Birthday cake and treats',
      'Welcome drink on arrival',
      'Member-only dining events',
    ],
    diningDiscount: 25,
    roomDiscount: 10,
    freeNight: false,
    spaBenefit: false,
    bestFor: ['familyDining', 'hotelBuffet', 'barLounge'],
    notes: 'Single-property dining club; best if you regularly dine at Hotel Nikko Saigon.',
    officialUrl: 'https://www.hotelnikkosaigon.com.vn/',
    estimatedSavings: 6000000,
    scores: { familyDining: 90, staycation: 60, businessTravel: 50, easeOfUse: 88, overall: 80 },
  },
  {
    id: 'world-of-hyatt',
    name: 'World of Hyatt',
    brand: 'Hyatt',
    country: 'vietnam',
    cities: ['ho-chi-minh', 'da-nang', 'tokyo', 'bangkok', 'seoul'],
    hotels: [
      'Park Hyatt Saigon',
      'Hyatt Regency Danang Resort and Spa',
      'Park Hyatt Tokyo',
      'Grand Hyatt Erawan Bangkok',
      'Grand Hyatt Seoul',
    ],
    annualFee: 0,
    currency: 'USD',
    benefits: [
      'Free to join',
      'High-value point redemptions',
      'Room upgrades and late checkout',
      'Free nights via points',
    ],
    diningDiscount: null,
    roomDiscount: null,
    freeNight: true,
    spaBenefit: true,
    bestFor: ['businessTravel', 'staycation', 'spa', 'freeNight'],
    notes: 'Smaller footprint but consistently high redemption value, especially at Park Hyatt.',
    officialUrl: 'https://world.hyatt.com/',
    estimatedSavings: 400,
    scores: { familyDining: 65, staycation: 85, businessTravel: 90, easeOfUse: 86, overall: 85 },
  },
  {
    id: 'lotte-hotel-rewards',
    name: 'Lotte Hotel Rewards',
    brand: 'Lotte',
    country: 'korea',
    cities: ['seoul', 'ho-chi-minh', 'hanoi'],
    hotels: ['Lotte Hotel Seoul', 'Lotte Hotel Saigon', 'Lotte Hotel Hanoi'],
    annualFee: 0,
    currency: 'KRW',
    benefits: [
      'Free to join',
      'Earn points on stays and dining',
      'Dining discounts for members',
      'Early check-in when available',
    ],
    diningDiscount: 15,
    roomDiscount: null,
    freeNight: false,
    spaBenefit: true,
    bestFor: ['familyDining', 'businessTravel', 'staycation'],
    notes: 'Refined Korean hospitality with a useful presence in both Korea and Vietnam.',
    officialUrl: 'https://www.lottehotel.com/club/en/',
    estimatedSavings: 200000,
    scores: { familyDining: 80, staycation: 78, businessTravel: 82, easeOfUse: 84, overall: 81 },
  },
]

// Sales configuration for PAID memberships.
//  salePrice      discounted price OhmySelect offers (in the membership currency)
//  commissionRate fraction of the paid amount OhmySelect earns (BM revenue)
// Free programs (annualFee 0) are not listed — they are joined for free.
export const sales = {
  'club-marriott-vietnam': { salePrice: 4200000, commissionRate: 0.12 },
  'accor-plus-vietnam': { salePrice: 4500000, commissionRate: 0.12 },
  'hotel-nikko-saigon-dining-club': { salePrice: 2600000, commissionRate: 0.15 },
}

export function getMembership(id) {
  return memberships.find((m) => m.id === id)
}

// Whether a membership must be purchased (vs. joined for free).
export function isPaid(membership) {
  return !!membership && membership.annualFee > 0
}

// Resolve pricing for a membership: list price, optional sale price,
// the amount the buyer actually pays, and the commission OhmySelect earns.
export function getPricing(membership) {
  if (!membership) return null
  const cfg = sales[membership.id] || {}
  const listPrice = membership.annualFee
  const salePrice = cfg.salePrice != null && cfg.salePrice < listPrice ? cfg.salePrice : null
  const paidAmount = salePrice != null ? salePrice : listPrice
  const commissionRate = cfg.commissionRate || 0
  return {
    currency: membership.currency,
    listPrice,
    salePrice,
    paidAmount,
    commissionRate,
    commissionAmount: Math.round(paidAmount * commissionRate),
  }
}

export const allBrands = [...new Set(memberships.map((m) => m.brand))]
