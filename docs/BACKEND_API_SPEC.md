# OhmySelect Backend API Spec

작성일: 2026-06-07

이 문서는 Claude가 만드는 프론트엔드와 Codex가 만드는 백엔드가 공유할 API 계약 초안이다. 현재 MVP의 `localStorage` 기반 상태를 서버 API로 이전하는 것을 기준으로 한다.

## 1. 기본 원칙

- API prefix: `/api/v1`
- 응답 포맷: JSON
- 인증: `Authorization: Bearer <accessToken>`
- 게스트 사용자는 탐색, 상세, 비교, 추천 퀴즈 조회만 가능하다.
- 저장, 구매, 예약, 선물, 계정 데이터 조회는 로그인 필요.
- 날짜/시간은 ISO 8601 문자열을 사용한다.
- 통화는 ISO currency code(`VND`, `USD`, `KRW`)를 사용한다.

## 2. 공통 응답

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

오류 응답:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "VOUCHER_NOT_AVAILABLE",
    "message": "No available voucher remains.",
    "details": {}
  }
}
```

## 3. Auth

### POST `/auth/google`

Google ID token을 검증하고 OhmySelect 세션을 발급한다.

Request:

```json
{
  "idToken": "google-id-token"
}
```

Response:

```json
{
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "user": {
      "id": "usr_123",
      "provider": "google",
      "name": "Jane Kim",
      "email": "jane@example.com",
      "picture": "https://example.com/avatar.jpg"
    }
  },
  "meta": {},
  "error": null
}
```

### GET `/me`

현재 로그인 사용자의 프로필을 반환한다.

### POST `/auth/logout`

서버 세션 또는 refresh token을 무효화한다.

## 4. Catalog

### GET `/cities`

서비스 도시 목록.

### GET `/memberships`

도시, 혜택, 브랜드 필터와 추천 점수 정렬을 지원한다.

Query:

- `city`: `ho-chi-minh`, `da-nang`, `hanoi`, `seoul`, `bangkok`, `tokyo`
- `benefit`: `dining`, `room`, `spa`, `discount`, `gift`, `freeNight`
- `sort`: `recommended`, `priceAsc`, `savingsDesc`

Response item:

```json
{
  "id": "club-marriott-vietnam",
  "name": "Club Marriott Vietnam",
  "brand": "Marriott",
  "country": "vietnam",
  "cities": ["ho-chi-minh", "da-nang", "hanoi"],
  "hotels": ["Sheraton Saigon Grand Opera Hotel"],
  "annualFee": 4500000,
  "currency": "VND",
  "salePrice": 4200000,
  "commissionRate": 0.12,
  "benefits": ["Up to 50% off food"],
  "diningDiscount": 50,
  "roomDiscount": 20,
  "freeNight": false,
  "spaBenefit": true,
  "bestFor": ["familyDining", "hotelBuffet"],
  "estimatedSavings": 12000000,
  "scores": {
    "familyDining": 95,
    "staycation": 80,
    "businessTravel": 60,
    "easeOfUse": 85,
    "overall": 90
  }
}
```

### GET `/memberships/:membershipId`

멤버십 상세와 포함 바우처 템플릿을 함께 반환한다.

### GET `/memberships/compare?ids=a,b,c`

최대 3개 멤버십 비교 데이터를 반환한다.

## 5. Wallet

### GET `/wallet`

사용자가 보유한 멤버십, 바우처 상태, 예약/주문 요약을 반환한다.

Response:

```json
{
  "data": {
    "summary": {
      "membershipCount": 2,
      "availableVoucherCount": 8,
      "expiringSoonCount": 1,
      "openReservationCount": 2
    },
    "memberships": [],
    "vouchers": [],
    "reservations": [],
    "orders": [],
    "transfers": []
  },
  "meta": {},
  "error": null
}
```

### POST `/wallet/memberships`

무료 멤버십 가입 또는 운영자가 활성화한 유료 멤버십을 지갑에 추가한다.

Request:

```json
{
  "membershipId": "hilton-honors-vietnam",
  "source": "free_join"
}
```

### DELETE `/wallet/memberships/:membershipId`

지갑에서 멤버십을 제거한다. 바우처 사용 기록, 예약, 선물 기록은 함께 정리하고 주문 이력은 보존한다.

### GET `/wallet/vouchers`

카테고리별 바우처 목록을 반환한다.

Query:

- `category`: `all`, `dining`, `room`, `spa`, `discount`, `gift`, `other`
- `membershipId`

Voucher item:

```json
{
  "membershipId": "club-marriott-vietnam",
  "templateId": "cm-dinner",
  "title": "Free Dinner Coupon",
  "category": "dining",
  "quantity": 2,
  "used": 0,
  "held": 1,
  "transferred": 0,
  "available": 1,
  "validUntil": "2026-11-30",
  "hotels": [],
  "transferable": true,
  "note": "Set menu only. Wine and extra orders are charged on site."
}
```

## 6. Reservations

### POST `/reservations`

바우처 예약 요청을 생성한다. 서버는 바우처 재고를 원자적으로 확인하고 `requested` 상태로 hold를 잡는다.

Request:

```json
{
  "membershipId": "club-marriott-vietnam",
  "templateId": "cm-dinner",
  "date": "2026-07-03",
  "adults": 2,
  "children": 1,
  "childAges": ["6"],
  "hotel": "Sheraton Saigon Grand Opera Hotel",
  "note": "Window seat if possible"
}
```

Status flow:

`requested -> confirmed -> completed`

Cancel path:

`requested|confirmed -> cancelled`

### GET `/reservations`

사용자의 예약 목록을 반환한다.

### PATCH `/reservations/:reservationId/status`

예약 상태를 변경한다. `completed`가 되면 바우처 사용 수량을 1 증가시키고 hold를 해제한다.

Request:

```json
{
  "status": "confirmed"
}
```

### DELETE `/reservations/:reservationId`

예약 기록을 삭제한다. 운영 정책상 MVP에서는 `cancelled` 변경을 우선 사용한다.

## 7. Orders

### POST `/orders`

유료 멤버십 구매 신청을 만든다. 실제 결제는 호텔 브랜드 인보이스로 진행한다.

Request:

```json
{
  "membershipId": "club-marriott-vietnam",
  "buyerName": "Jane Kim",
  "buyerEmail": "jane@example.com",
  "buyerPhone": "+84901234567",
  "city": "ho-chi-minh"
}
```

Response에는 `paidAmount`, `commissionRate`, `commissionAmount`가 포함된다.

Status flow:

`requested -> invoiced -> paid -> activated`

Cancel path:

`requested|invoiced|paid -> cancelled`

### GET `/orders`

사용자 주문 목록.

### PATCH `/orders/:orderId/status`

주문 상태를 변경한다. `activated`가 되면 해당 멤버십을 지갑에 지급한다.

운영자/파트너 권한에서만 사용 가능하게 설계한다.

### GET `/settlements/summary`

데모 및 운영 정산용 집계.

Response:

```json
{
  "data": {
    "gmv": 8700000,
    "commission": 1044000,
    "currency": "VND",
    "activatedOrderCount": 2
  },
  "meta": {},
  "error": null
}
```

## 8. Transfers

### POST `/transfers`

양도 가능한 바우처를 다른 사람에게 선물한다. 서버는 재고를 원자적으로 확인하고 `transferred` 수량을 증가시킨다.

Request:

```json
{
  "membershipId": "club-marriott-vietnam",
  "templateId": "cm-breakfast",
  "recipientName": "Min Lee",
  "recipientContact": "min@example.com",
  "message": "Enjoy breakfast"
}
```

### GET `/transfers`

사용자 선물 기록.

## 9. Assistance

### POST `/assistance-requests`

도움 요청을 저장하고 운영 채널로 전달한다.

Request:

```json
{
  "name": "Jane Kim",
  "contact": "jane@example.com",
  "city": "da-nang",
  "membershipId": "accor-plus-vietnam",
  "preferredDate": "2026-08-10",
  "adults": 2,
  "children": 0,
  "requestType": "booking",
  "message": "Need help booking a free night."
}
```

## 10. Quiz

### POST `/recommendations/quiz`

5문항 답변을 받아 상위 3개 멤버십 추천을 반환한다.

Request:

```json
{
  "city": "ho-chi-minh",
  "benefits": ["familyDining", "freeNight"],
  "frequency": "monthly",
  "companions": "family",
  "budget": "paid_ok"
}
```

## 11. 주요 오류 코드

- `AUTH_REQUIRED`
- `ADMIN_REQUIRED`
- `FORBIDDEN`
- `MEMBERSHIP_NOT_FOUND`
- `VOUCHER_NOT_FOUND`
- `VOUCHER_NOT_AVAILABLE`
- `VOUCHER_NOT_TRANSFERABLE`
- `INVALID_STATUS_TRANSITION`
- `ORDER_NOT_ACTIVATABLE`
- `DATE_NOT_AVAILABLE`
- `VALIDATION_ERROR`

## 12. Admin / Back-office

모든 경로는 `/api/v1` prefix 아래에 있으며 `Authorization: Bearer <accessToken>`이 필요하다.
백오피스 권한은 `ADMIN_EMAILS`(admin)와 `OPERATOR_EMAILS`(operator) 환경변수로 부여한다.
두 환경변수에 같은 이메일이 있으면 `ADMIN_EMAILS`가 우선한다. `POST /auth/google`과
`GET /me`의 `user.role`은 유효 역할(`admin`, `operator`, 또는 `null`)을 반환한다.
일반 사용자는 403 `ADMIN_REQUIRED`를 받는다. 기존 `/admin/orders`, `/admin/reservations`,
`/admin/assistance-requests`, `/admin/settlements/summary` 응답은 기존 UI 호환을 위해 bare JSON을 유지한다.

### GET `/admin/me`

현재 백오피스 사용자와 역할/권한을 반환한다.

```json
{
  "user": { "id": "usr_123", "email": "ops@example.com", "name": "Ops" },
  "role": "admin",
  "permissions": ["read", "catalog:write", "settlement:write", "reservation:write", "assistance:write"]
}
```

### GET `/admin/dashboard?from=&to=`

GMV, 수수료, 주문/예약 상태별 카운트, 문의 처리 현황, 활성 멤버십, 만료 임박 바우처를 반환한다.

### GET `/admin/audit-logs?from=&to=&actor=&page=&pageSize=`

변경 감사로그 목록을 페이지네이션으로 반환한다.

Response:

```json
{
  "items": [
    {
      "id": "aud_123",
      "actorEmail": "admin@example.com",
      "action": "update",
      "targetType": "membership",
      "targetId": "club-marriott-vietnam",
      "before": {},
      "after": {},
      "createdAt": "2026-06-09T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1 }
}
```

### Membership Catalog

- `GET /admin/memberships?q=&brand=&page=&pageSize=`: 비활성 포함 멤버십 목록.
- `POST /admin/memberships`: 멤버십 생성(admin only).
- `GET /admin/memberships/:id`: 멤버십 상세 + 바우처.
- `PATCH /admin/memberships/:id`: 멤버십 수정(admin only).
- `DELETE /admin/memberships/:id`: `active=false` 소프트 삭제(admin only).

멤버십 필드는 공개 `GET /memberships` shape를 유지하며 `salePrice`, `commissionRate`,
`paidAmount`, `commissionAmount`, `active`를 포함한다.

### Voucher Templates

- `GET /admin/memberships/:id/vouchers`: 멤버십 바우처 템플릿 목록.
- `POST /admin/memberships/:id/vouchers`: 바우처 템플릿 생성(admin only).
- `PATCH /admin/vouchers/:templateId`: 바우처 템플릿 수정(admin only).
- `DELETE /admin/vouchers/:templateId`: 바우처 템플릿 삭제(admin only).
- `GET /admin/vouchers/:templateId/usage`: `{ issued, used, held, transferred, available }`.

`POST`와 `PATCH`는 선택 필드 `i18n`을 받을 수 있다. 영어는 기본 `title`,
`description`, `note` 필드이며 `i18n`에는 `ko`, `vi`, `zh`, `ja` 번역만 저장한다.
값은 전체 교체 방식으로 저장하며, 어드민 바우처 목록과 소비자
`GET /memberships/:id`의 `vouchers[]`에 그대로 반환한다.

```json
{
  "templateId": "qa-voucher",
  "title": "QA Voucher",
  "description": "English description",
  "note": "English note",
  "i18n": {
    "ko": { "title": "한국어 제목", "description": "한국어 설명", "note": "한국어 노트" },
    "vi": { "title": "Tiêu đề", "description": "Mô tả", "note": "Ghi chú" }
  }
}
```

### Availability / Holidays

- `GET /admin/vouchers/:templateId/availability`
- `PUT /admin/vouchers/:templateId/availability` admin only, 전체 교체:

```json
{
  "daysOfWeek": [0, 1, 2, 3, 4, 5, 6],
  "minLeadDays": 2,
  "maxAdvanceDays": 120,
  "blackouts": [{ "from": "2026-02-14", "to": "2026-02-22", "key": "tet", "label": "Tet" }]
}
```

- `GET /vouchers/:templateId/availability`: 소비자 달력용 공개 read.
- `GET /admin/holidays?country=&page=&pageSize=`
- `POST /admin/holidays` admin only.
- `PATCH /admin/holidays/:id` admin only.
- `DELETE /admin/holidays/:id` admin only.

`POST /reservations`는 서버에서 가용일을 검증한다. 불가일이면 409:

```json
{
  "code": "DATE_NOT_AVAILABLE",
  "message": "Date is not available.",
  "details": { "ok": false, "reason": "blackout", "holidayKey": "tet" }
}
```

`reason`: `invalid`, `leadTime`, `tooFar`, `expired`, `blackout`, `weekend`, `closed`.

### Users / Wallet Lookup

- `GET /admin/users?q=&page=&pageSize=`: 회원 목록과 `membershipsCount`.
- `GET /admin/users/:id`: 프로필 + 지갑(`memberships`, `vouchers`, `reservations`, `orders`, `transfers`).

### Settlements / Reports

- `GET /admin/settlements/summary?from=&to=&brand=`:
  기존 `{ gmv, commission, activatedOrderCount, currency }`에
  `byBrand`, `byPeriod`를 추가한다.
- `GET /admin/reports/orders.csv?from=&to=&status=`: 주문 CSV.
- `GET /admin/reports/settlements.csv?from=&to=`: 정산 CSV.

### CS Inbox

`GET /admin/assistance-requests`는 기존 배열 응답을 유지한다. `status`, `q`, `page`,
`pageSize` 쿼리가 있을 때는 `{ items, meta }` 페이지네이션 응답을 반환한다.

### Operator Permissions

`OPERATOR_EMAILS` 사용자는 백오피스 read API 전체를 조회할 수 있고, 운영 처리용
`PATCH /admin/orders/:id/status`, `PATCH /admin/reservations/:id/status`,
`PATCH /admin/assistance-requests/:id`를 사용할 수 있다. 멤버십/바우처/가용일/공휴일
생성·수정·삭제는 403 `ADMIN_REQUIRED`를 반환한다.
