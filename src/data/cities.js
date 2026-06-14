// Centralized city data. Display names are translated via i18n (cities.<id>).
// `emoji` is a lightweight stand-in for a city image in this frontend-only MVP.
//
// To add a city later: add an entry here and a label in every src/i18n file
// under the `cities` group.
// `lat`/`lng` power the location-based "find hotels near me" recommendation.
export const cities = [
  { id: 'ho-chi-minh', country: 'vietnam', emoji: '🏙️', lat: 10.7769, lng: 106.7009 },
  { id: 'da-nang', country: 'vietnam', emoji: '🏖️', lat: 16.0544, lng: 108.2022 },
  { id: 'hanoi', country: 'vietnam', emoji: '🏯', lat: 21.0285, lng: 105.8542 },
  { id: 'seoul', country: 'korea', emoji: '🌆', lat: 37.5665, lng: 126.978 },
  { id: 'bangkok', country: 'thailand', emoji: '🛕', lat: 13.7563, lng: 100.5018 },
  { id: 'tokyo', country: 'japan', emoji: '🗼', lat: 35.6762, lng: 139.6503 },
]

export const CITY_IDS = cities.map((c) => c.id)

export const DEFAULT_CITY = 'ho-chi-minh'

export function getCity(id) {
  return cities.find((c) => c.id === id)
}
