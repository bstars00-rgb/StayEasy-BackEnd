// Voucher packs that come with each membership.
//
// When a user adds a membership to "My Benefits", these templates are
// instantiated into their e-voucher wallet. Per-voucher usage (how many of
// the `quantity` have been consumed) is tracked separately in storage, so
// these definitions stay read-only — like a product catalog.
//
// Template fields:
//  templateId   stable id (unique within a pack)
//  category     dining | room | spa | discount | gift | other  (i18n: voucherCat.<id>)
//  title        short English label (mock data; OK to stay English)
//  quantity     how many are granted
//  validUntil   ISO date the voucher expires
//  hotels       eligible properties ([] = any participating hotel)
//  city         optional city id the voucher is tied to
//  transferable whether it can be gifted/transferred to someone else
//  note         on-site conditions / extra-charge warning (English mock)
//
// Reference: modeled on the real Club Marriott Vietnam e-voucher wallet
// (categories, per-voucher quantity / available / used, expiry dates).

export const voucherCategories = ['dining', 'room', 'spa', 'discount', 'gift', 'other']

export const voucherPacks = {
  'club-marriott-vietnam': [
    {
      templateId: 'cm-stay2',
      category: 'room',
      title: 'Free 2-Night Stay',
      description:
        'Two complimentary nights at a Ho Chi Minh Marriott-brand hotel — ideal for a weekend staycation. Room type and dates are subject to availability and advance reservation.',
      quantity: 1,
      validUntil: '2026-11-30',
      hotels: ['Sheraton Saigon Grand Opera Hotel', 'Le Méridien Saigon'],
      city: 'ho-chi-minh',
      transferable: false,
      note: 'Ho Chi Minh Marriott-brand hotels. Subject to availability; reservation required.',
    },
    {
      templateId: 'cm-upgrade',
      category: 'room',
      title: 'Free Room Upgrade',
      description:
        'A complimentary one-category room upgrade at check-in, from your booked room to the next higher type, based on availability on arrival.',
      quantity: 1,
      validUntil: '2026-11-30',
      hotels: [],
      transferable: false,
      note: 'One category upgrade, subject to availability at check-in.',
    },
    {
      templateId: 'cm-breakfast',
      category: 'dining',
      title: 'Free Breakfast Coupon',
      description:
        'A complimentary breakfast for one person at the hotel’s all-day dining restaurant. Use one coupon per guest, per visit.',
      quantity: 3,
      validUntil: '2026-11-30',
      hotels: [],
      transferable: true,
      note: 'One person per coupon.',
    },
    {
      templateId: 'cm-dinner',
      category: 'dining',
      title: 'Free Dinner Coupon',
      description:
        'A complimentary set dinner for one at participating restaurants. À la carte upgrades, wine and premium beverages are charged separately on site.',
      quantity: 2,
      validUntil: '2026-11-30',
      hotels: [],
      transferable: true,
      note: 'Set menu only. Wine and extra à la carte orders are charged on site.',
    },
    {
      templateId: 'cm-fnb50',
      category: 'discount',
      title: '50% Off Food & Beverage',
      description:
        'Half off the total food & beverage bill for up to four diners — a great everyday perk for lunches and dinners. Some premium beverages may be excluded.',
      quantity: 3,
      validUntil: '2026-06-20',
      hotels: [],
      transferable: true,
      note: 'Up to 4 diners. Beverages may be excluded.',
    },
    {
      templateId: 'cm-spa',
      category: 'spa',
      title: 'Free Spa Treatment',
      description:
        'One complimentary 60-minute signature spa treatment. Advance reservation is required; weekend slots fill up quickly.',
      quantity: 1,
      validUntil: '2026-11-30',
      hotels: [],
      transferable: true,
      note: '60-minute signature treatment. Reservation required.',
    },
    {
      templateId: 'cm-nhatrang40',
      category: 'discount',
      title: '40% Off — Sheraton Nha Trang',
      description:
        '40% off the best available room rate at Sheraton Nha Trang Resort, valid for up to three consecutive nights — ideal for a beach getaway.',
      quantity: 3,
      validUntil: '2026-11-30',
      hotels: ['Sheraton Nha Trang Resort'],
      transferable: true,
      note: 'Usable for up to 3 consecutive nights.',
    },
    {
      templateId: 'cm-cake',
      category: 'gift',
      title: 'Birthday Cake Gift',
      description:
        'A complimentary birthday cake to celebrate your special day. Please pre-order at least 48 hours in advance.',
      quantity: 1,
      validUntil: '2026-11-30',
      hotels: [],
      transferable: false,
      note: 'Pre-order 48 hours in advance.',
    },
  ],

  'accor-plus-vietnam': [
    {
      templateId: 'ap-stay1',
      category: 'room',
      title: 'Complimentary Stay Night',
      description:
        'One complimentary night per membership year at a participating Accor hotel in Vietnam. Reservation required and subject to availability; blackout dates may apply.',
      quantity: 1,
      validUntil: '2026-12-31',
      hotels: ['Sofitel Saigon Plaza', 'Pullman Saigon Centre'],
      transferable: false,
      note: 'One free night per year. Reservation required, subject to availability.',
    },
    {
      templateId: 'ap-dining50',
      category: 'discount',
      title: '50% Off Dining',
      description:
        'Half off dining for the member plus up to three guests at participating Accor restaurants. Beverages and set promotions may be excluded.',
      quantity: 4,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: true,
      note: 'Member + up to 3 guests. Beverages may be excluded.',
    },
    {
      templateId: 'ap-breakfast',
      category: 'dining',
      title: 'Free Breakfast for Two',
      description:
        'Complimentary breakfast for two, valid when added to a paid stay at a participating hotel.',
      quantity: 2,
      validUntil: '2026-07-15',
      hotels: [],
      transferable: true,
      note: 'Valid with a paid stay.',
    },
    {
      templateId: 'ap-upgrade',
      category: 'room',
      title: 'Room Upgrade',
      description:
        'A complimentary one-category room upgrade at check-in, subject to availability.',
      quantity: 1,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: false,
      note: 'Subject to availability at check-in.',
    },
  ],

  'hilton-honors-vietnam': [
    {
      templateId: 'hh-lateco',
      category: 'room',
      title: 'Late Check-out (4pm)',
      description:
        'Check out as late as 4pm on departure day, subject to availability — no need to rush your morning.',
      quantity: 3,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: false,
      note: 'Subject to availability.',
    },
    {
      templateId: 'hh-fnb15',
      category: 'discount',
      title: '15% Off Food & Beverage',
      description:
        '15% off your food & beverage bill at participating Hilton outlets across Vietnam.',
      quantity: 5,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: true,
      note: 'At participating Hilton outlets.',
    },
    {
      templateId: 'hh-welcome',
      category: 'gift',
      title: 'Welcome Amenity',
      description:
        'A welcome amenity delivered to your room on a qualifying stay — a small touch to start your trip.',
      quantity: 2,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: false,
      note: 'Delivered to room on a qualifying stay.',
    },
  ],

  'ihg-one-rewards-vietnam': [
    {
      templateId: 'ihg-4thnight',
      category: 'room',
      title: 'Fourth Night Free',
      description:
        'On a four-night reward stay, the fourth night is free — great value for longer trips.',
      quantity: 1,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: false,
      note: 'On a 4-night reward stay.',
    },
    {
      templateId: 'ihg-dining20',
      category: 'discount',
      title: '20% Off Dining',
      description:
        '20% off dining at select IHG hotel restaurants. Some outlets and promotions may be excluded.',
      quantity: 3,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: true,
      note: 'At select hotels.',
    },
    {
      templateId: 'ihg-welcomedrink',
      category: 'dining',
      title: 'Welcome Drink',
      description:
        'One complimentary welcome drink per coupon at the lobby bar on arrival.',
      quantity: 2,
      validUntil: '2026-08-31',
      hotels: [],
      transferable: true,
      note: 'One drink per coupon at the lobby bar.',
    },
  ],

  'shangri-la-circle': [
    {
      templateId: 'slc-dining30',
      category: 'discount',
      title: '30% Off Dining',
      description:
        '30% off the dining bill at participating Shangri-La restaurants. Beverages may be excluded.',
      quantity: 3,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: true,
      note: 'Beverages may be excluded.',
    },
    {
      templateId: 'slc-spa',
      category: 'spa',
      title: 'Spa Treatment Discount',
      description:
        'A members-only discount on treatments at CHI, The Spa. Advance reservation required.',
      quantity: 2,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: true,
      note: 'Reservation required.',
    },
    {
      templateId: 'slc-upgrade',
      category: 'room',
      title: 'Room Upgrade',
      description:
        'A complimentary room upgrade at check-in for eligible tiers, based on availability.',
      quantity: 1,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: false,
      note: 'Subject to availability.',
    },
  ],

  'hotel-nikko-saigon-dining-club': [
    {
      templateId: 'nk-buffet25',
      category: 'discount',
      title: '25% Off Buffet',
      description:
        '25% off the lunch or dinner buffet at Hotel Nikko Saigon — a favourite for families and groups.',
      quantity: 4,
      validUntil: '2026-09-30',
      hotels: ['Hotel Nikko Saigon'],
      city: 'ho-chi-minh',
      transferable: true,
      note: 'Lunch or dinner buffet.',
    },
    {
      templateId: 'nk-cake',
      category: 'gift',
      title: 'Birthday Cake',
      description:
        'A complimentary birthday cake at Hotel Nikko Saigon. Please pre-order at least 48 hours ahead.',
      quantity: 1,
      validUntil: '2026-11-30',
      hotels: ['Hotel Nikko Saigon'],
      transferable: false,
      note: 'Pre-order 48 hours in advance.',
    },
    {
      templateId: 'nk-welcome',
      category: 'dining',
      title: 'Welcome Drink',
      description:
        'A complimentary welcome drink at the lobby lounge — perfect to unwind after arrival.',
      quantity: 2,
      validUntil: '2026-11-30',
      hotels: ['Hotel Nikko Saigon'],
      transferable: true,
      note: 'At the lobby lounge.',
    },
  ],

  'world-of-hyatt': [
    {
      templateId: 'woh-upgrade',
      category: 'room',
      title: 'Room Upgrade',
      description:
        'A complimentary upgrade at check-in, including standard suites where available, for eligible members.',
      quantity: 2,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: false,
      note: 'Including standard suites, subject to availability.',
    },
    {
      templateId: 'woh-lateco',
      category: 'room',
      title: 'Late Check-out',
      description:
        'Late check-out on departure day, subject to availability — ideal for late flights.',
      quantity: 2,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: false,
      note: 'Subject to availability.',
    },
    {
      templateId: 'woh-spa',
      category: 'spa',
      title: 'Spa Credit',
      description:
        'A spa credit toward treatments at participating Hyatt spas. Reservation required.',
      quantity: 1,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: true,
      note: 'Reservation required.',
    },
  ],

  'lotte-hotel-rewards': [
    {
      templateId: 'lh-dining15',
      category: 'discount',
      title: '15% Off Dining',
      description:
        '15% off dining at participating Lotte Hotel restaurants in Korea and Vietnam.',
      quantity: 4,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: true,
      note: 'At participating Lotte Hotel outlets.',
    },
    {
      templateId: 'lh-earlyci',
      category: 'room',
      title: 'Early Check-in',
      description:
        'Check in early on arrival day, subject to availability — settle in before your plans begin.',
      quantity: 2,
      validUntil: '2026-12-31',
      hotels: [],
      transferable: false,
      note: 'Subject to availability.',
    },
    {
      templateId: 'lh-spa',
      category: 'spa',
      title: 'Spa Discount',
      description:
        'A members-only discount on spa services. Advance reservation recommended.',
      quantity: 1,
      validUntil: '2026-10-31',
      hotels: [],
      transferable: true,
      note: 'Reservation required.',
    },
  ],
}

export function getVoucherPack(membershipId) {
  return voucherPacks[membershipId] || []
}

export function getVoucherTemplate(membershipId, templateId) {
  return getVoucherPack(membershipId).find((v) => v.templateId === templateId)
}
