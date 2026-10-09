# StreetSetu API Design Document

## Production Release v1: sessions, live events, search, and reports

All new routes use the existing `/api/v1` prefix and `{ success, data, message }` response envelope. Existing login/register `data.token` remains the access token; `data.accessToken` is an alias for newer clients. The refresh token is issued only as an HttpOnly cookie.

### Public transparency and complaint tracking

- `GET /api/v1/public/transparency` (public): returns city-level totals for complaints, resolved/active/rejected counts, resolution rate, average resolution duration in days, top categories, most active areas, and a rounded geographic hotspot summary. No reporter identity, contact details, descriptions, or exact coordinates are returned.
- `GET /api/v1/public/complaints/:complaintId` (public): validates the complaint id and returns title, category, current status, created/updated/resolved timestamps, assigned volunteer name, and status-only history. Actor IDs, contact details, and free-text internal notes are excluded.
- The React pages are `/transparency` and `/track/:complaintId`; both work without a session.

### Progressive web app and offline behavior

The frontend serves `/manifest.json` and `/service-worker.js` over HTTPS (or localhost). The worker caches the app shell and static assets; the API client keeps network-first snapshots of dashboard summary, complaint lists, and notifications in user-specific Cache Storage entries. Logout clears private caches. Offline submissions and mutations are not queued; reconnect before reporting or updating a complaint. Increment the cache version when changing the shell/service-worker strategy.

### Email delivery

Nodemailer sends reusable HTML and text templates when SMTP is configured. Submission, assignment/reassignment, resolution, rejection, and volunteer assignment notifications use the existing notification service; failed deliveries are recorded in `notifications` without changing complaint transaction outcomes. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `PUBLIC_APP_URL`. Tracking email links use the public `/track/:complaintId` page.

### Refresh sessions

- `POST /api/v1/auth/refresh`: reads the `streetsetu_refresh` HttpOnly cookie, revokes that refresh session, and rotates a new cookie and access token. Refresh sessions are hashed in `refreshsessions` and expire automatically.
- `POST /api/v1/auth/logout`: revokes the current refresh session and clears the cookie. The access token remains valid until its normal expiration.
- The cookie uses `Secure; SameSite=None` in production and is scoped to `/api/v1/auth`; configure the Vercel and Render services on a shared custom registrable domain for browser cookie compatibility.

### Socket.IO events

Socket.IO shares the Render API origin. Connect with `io(API_ORIGIN, { auth: { token: accessToken } })`; JWT authentication is required. Each connection joins its private `user:<id>` and `role:<role>` room. Authorized complaint parties may request a complaint room with `complaint:join` and a complaint ObjectId. Server events include `notification:new`, `dashboard:updated`, `complaint:created`, `complaint:assigned`, `complaint:reassigned`, `complaint:status`, and `complaint:rejected`. Complaint payloads contain identifiers and status metadata; clients should refetch protected details for current full records.

### Search, pagination, and activity

- `GET /api/v1/complaints`: supports existing `status`, `category`, `priority`, `assignedTo`, `page`, and `limit` filters, plus `search` (title/description/address) and ISO `from`/`to` dates. Limit is capped at 100.
- `GET /api/v1/complaints/map`: supports the same filters and optional pagination. Calls without page/limit keep returning the legacy array response; paged calls return `{ items, page, limit, total, pages }`. Non-admin map results are owner/assignee scoped.
- `GET /api/v1/complaints/nearby?latitude=28.61&longitude=77.20&radius=1000`: authenticated citizen, volunteer, or admin public discovery within a radius in meters (the citizen UI offers 500, 1,000, and 5,000). Uses MongoDB `$geoNear` on complaint GeoJSON points and returns nearest-first `{ items, count, center, radiusMeters }`; each item includes `title`, `category`, `status`, `distanceMeters`, and `supportCount`. The older `/api/v1/geo/complaints/nearby` remains unchanged and scoped to a user’s own/assigned reports.
- `GET /api/v1/notifications`: supports `page`, `limit`, `complaintId`, `unread`, `search`, and `eventType`.
- `GET /api/v1/assignments/my-assignments`: retains page/limit pagination.
- `GET /api/v1/assignments/my-route` (volunteer): returns active assignments created today (UTC), arranged by greedy nearest-neighbour order from the volunteer’s saved profile location. Includes `routeOrder`, per-leg Haversine `legDistanceKm`, `totalDistanceKm`, and `estimatedTravelMinutes` using a 4.5 km/h walking estimate. If the volunteer has no saved coordinates, the route starts with the first assigned complaint; legs with missing coordinates are omitted from distance totals.
- `GET /api/v1/dashboard/activity` (admin): paginated searchable audit records; optional filters are `actorId`, `action`, and `entityType`.

### Reports

- `GET /api/v1/dashboard/export.csv` (admin): downloads CSV complaint rows using status/category/priority/search/date filters. Spreadsheet formula-leading values are escaped.
- `GET /api/v1/dashboard/export.pdf` (admin): downloads a PDF report with matching complaint status, category, priority, address, and rejection reason. PDF output is capped at 500 records per request; CSV output is capped at 5,000.
- `GET /api/v1/dashboard/export/volunteers.csv` (admin): profile and assignment performance rows, capped at 5,000 volunteers.
- `GET /api/v1/dashboard/export/analytics.csv` (admin): overview metrics, monthly trends, categories, and statuses; accepts dashboard date/ward filters.
- `GET /api/v1/dashboard/export/monthly.pdf?month=YYYY-MM` (admin): selected-month totals, categories, and complaint activity.
- `GET /api/v1/dashboard/export/admin.pdf` (admin): executive metrics, duplicate prevention, volunteer ranking, hotspot zones, and active areas.
- `GET /api/v1/dashboard/export/volunteer.pdf?volunteerId=<ObjectId>` (admin): selected volunteer’s assignment history and completion summary.

### Operational security

The API applies Helmet headers, strict production CORS allowlists with credentials, 1 MiB JSON/urlencoded body limits, request IDs, Morgan request logs, general and authentication rate limits, JWT algorithm pinning, and optional Sentry capture. Access tokens are held in frontend memory; refresh tokens are HttpOnly cookies and hashed refresh sessions are single-use rotated. Socket.IO verifies JWTs against active user records, limits connections and room joins in-process, and authorizes complaint subscriptions. Configure the trusted proxy hop count when deployed behind a proxy. Rate and socket limits use process memory; use shared stores before running multiple API instances.

## GEO, Media, and Smart Assignment (implemented API additions)

Existing complaint endpoints and response envelopes remain unchanged. Complaint coordinates continue to be returned as `latitude` and `longitude`; the stored GeoJSON `location` remains available. Complaint documents now include `attachments`, `beforeImages`, `afterImages`, and `resolvedAt` where available.

### Media upload

- `POST /api/v1/uploads/images` (authenticated): multipart form field `images`, 1–5 JPG/JPEG/PNG/WebP files, at most 5 MiB each. Returns metadata records with `url`, `mimeType`, `fileName`, `size`, `storageKey`, and `uploadedAt`; pass these records in the existing complaint `attachments` field when creating a complaint.
- `POST /api/v1/uploads/complaints/:complaintId/before-images` (assigned volunteer): multipart `images`; appends work-start evidence.
- `POST /api/v1/uploads/complaints/:complaintId/after-images` (assigned volunteer): multipart `images`, `captureSource=live_camera`, `latitude`, `longitude`, `accuracy`, and ISO `capturedAt`. Browser clients must capture with the live camera and attach a geotag/time watermark. Captures more than two minutes from server time, over 100 m from the reported point, or with GPS accuracy over 100 m are marked `needs_review`. The response rejects missing/unsupported sources. `dev_gallery` is accepted only when `ALLOW_DEV_GALLERY_PROOF=true` and `NODE_ENV` is not `production`; development gallery evidence is always review-only.

Cloudinary configuration uses `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and optional `CLOUDINARY_UPLOAD_FOLDER`. Volunteer status changes to `in_progress` and `resolved` require the corresponding evidence.

### AI completion verification

- Work-start images retain optional EXIF GPS and capture-time metadata. Live completion captures use device geolocation and client capture time as the primary proof metadata; EXIF metadata is not required for a capture to pass those checks.
- When a live after capture passes the device time, distance, and accuracy checks and work-start evidence exists, the API persists `completionVerification.verificationStatus: pending` and starts AI verification asynchronously. Failed live checks are stored directly as `needs_review` with the matching failure reason. The worker compares before/after image embeddings with OpenAI CLIP; the server-side 100 m device GPS check remains authoritative for completion proof.
- `GET /api/v1/assignments/completion-verifications/:complaintId` (assigned volunteer or admin): returns verification fields; checking a pending record also resumes processing after an API restart.
- `GET /api/v1/assignments/completion-verifications` (admin): returns the latest 100 verified, pending, and review-required complaints.
- `PATCH /api/v1/assignments/completion-verifications/:complaintId` (admin): accepts `{ "decision": "approve" | "reject" }`. Approval marks the evidence verified; rejection keeps it in review. Both decisions are audited.
- Volunteers cannot move a complaint to `resolved` until verification is `verified`. Pending checks return `409 VERIFICATION_PENDING`; flagged or unavailable checks return `409 VERIFICATION_NEEDS_REVIEW`. Admin review approval allows the volunteer to retry the existing resolve action. Development gallery evidence cannot be approved as verified.
- Verification data is additive and optional, so legacy complaint reads remain backward compatible. The internal AI API exposes `POST /v1/image-metadata` (multipart `image`) and `POST /v1/verify-completion` (internal JSON payload); both honor `AI_SERVICE_TOKEN`.

### Volunteer profile and recommendations

- `PATCH /api/v1/users/me/volunteer-profile` (volunteer): accepts the existing `expertiseCategories` and `location` fields plus optional `phone`, `area`, `city`, and `availability` (`available|limited|unavailable|full_time|part_time|weekend|flexible`). Both coordinates must be provided together; the API stores a GeoJSON Point. Existing payloads remain valid.
- `GET /api/v1/leaderboard?scope=month|all&ward=<ObjectId>` (authenticated): returns at most 20 `{ rank, displayName, points, badgesCount, isMe }` rows. `scope` defaults to `all`; an optional ward scopes complaint and support points to `Complaint.wardId`. No user ids, email addresses, or phone numbers are returned.
- `GET /api/v1/users/me/stats` (authenticated): returns the current user’s total/monthly points, monthly and all-time rank, report/resolution/drive counts, badges, estimated people impacted, and before/after URLs for only that user’s resolved complaints. `peopleImpactedEstimate` is `{ value, label: "estimate" }`; the photo comparison data is private to the authenticated owner.
- Point awards are recorded in the idempotent `PointEvent` ledger: report created (+5), admin-approved resolution (+10), joining another organizer’s drive (+15, once per user/drive), organizing a drive (+25), and each active support vote received from another user (+2). Removing a vote removes its associated support event and points. Anonymous reports still earn points for their owner; public leaderboard rows never include complaint references or reporter identifiers.
- User badges are awarded once: First Report, Community Hero (3 approved resolutions), Drive Volunteer (1 join), Drive Organizer (1 organized drive), Points 100, and Points 500. Drive membership changes are retained privately for future rebuilds.
- `npm run gamification:backfill` rebuilds point events, point totals, and badges from stored complaints, drives, and current votes. Legacy drive memberships without recorded join timestamps use the drive creation timestamp.
- `GET /api/v1/assignments/recommend/:complaintId` (admin): returns the top five eligible volunteers, each with a nested `volunteer` object, `distanceKm`, `activeAssignments`, `resolutionRate`, `score` (0–100), and `scoreBreakdown`. The score weights proximity 50%, active workload 25%, resolution rate 15%, and availability 10%. Distance score falls to zero at 50 km; unavailable volunteers score zero on availability and should not be auto-assigned.
- `GET /api/v1/assignments/:complaintId/recommendations` (admin): backward-compatible full recommendation list with the same scoring fields and legacy aliases.
- `POST /api/v1/assignments/:complaintId/assign` remains compatible with `{ "volunteerId": "ObjectId" }`; optional `{ "recommendationAccepted": true }` additionally records recommendation acceptance notification.
- Admins may manually assign any eligible volunteer through the existing assignment endpoint or auto-assign the highest ranked available volunteer in the admin complaint workflow. Assignment records retain `distanceKm` when both complaint and volunteer coordinates are known.
- `PATCH /api/v1/assignments/:complaintId/response` (assigned volunteer): accepts `{ "response": "accepted" | "declined" }`. A declined assignment is closed and the complaint returns to `under_review`. For backward compatibility, the existing status-update endpoint implicitly records acceptance if an older client advances a pending assignment.

### Citizen feedback and volunteer leaderboard

- `POST /api/v1/complaints/:id/feedback` (reporting citizen, resolved/closed complaints only): accepts `{ "rating": 1..5, "comment"?: "..." }`. The comment is optional and limited to 1,000 characters. A unique index allows one feedback record per complaint; repeat submissions return `409 FEEDBACK_ALREADY_EXISTS`.
- The authenticated complaint detail response adds `myFeedback` for the reporting citizen so the UI can show their saved rating. Existing detail fields are retained.
- `GET /api/v1/analytics/leaderboard?limit=10` (admin): returns ranked active volunteers with weighted score and score breakdown. Score components are normalized to 0–100 and weighted as resolved complaint volume 40%, average citizen rating 30%, resolution speed 20%, and accepted/responded assignments 10%. Volunteers without observations for a component receive zero for that component.
- Volunteer `/api/v1/dashboard/summary` adds `averageRating` and `ratingCount`; existing fields are unchanged.

### Dashboard analytics additions

`GET /api/v1/dashboard/summary` retains existing fields and adds `statusCounts`, `monthlyTrends`, `resolutionTrends`, `topRejectionCategories`, and `volunteerPerformance`. The summary also includes rejected complaint counts and rejection rate, plus `averageResponseDistanceKm`, `averageTravelDistanceKm`, `volunteerWorkload`, `totalVolunteerWorkload`, `assignmentEfficiency`, `complaintsCompletedPerKm`, and `routeEfficiencyScore`. Average distance uses recorded volunteer-to-complaint assignment distances. Completed-per-kilometre uses resolved assignments divided by their recorded distance; route efficiency is capped at 100 and is ten times that rate. Legacy assignments without distance remain excluded from distance-based rates.

### Geographic analytics

The admin-only `/api/v1/analytics` routes accept ISO `from`/`to` date filters. The heatmap and geo-summary also accept `category` and `status`; heatmap accepts `kind=all|resolved|rejected`. Existing complaint responses and dashboard routes are unchanged.

- `GET /api/v1/analytics/heatmap`: aggregation-backed zone points `{ latitude, longitude, count, intensity }`, total matching complaint `count`, and the 5,000-zone response cap. Every matching complaint contributes to its rounded coordinate zone; category/status/date filters narrow the heat layer.
- `GET /api/v1/analytics/hotspots`: returns top ten coordinate zones, category hotspots, most reported/resolved/rejected areas, monthly hotspot trends, and `metrics`. A zone groups points rounded to three decimal places; an active hotspot has at least three open complaints. `heatmapScore` is capped at 100 and equals ten times the busiest active zone count (before cap).
- `GET /api/v1/analytics/geo-summary`: returns aggregation counts by city, area, category, and status plus up to 500 active volunteers with saved coordinates in `volunteerCoverage`, for the admin coverage map. New complaint submissions may store optional `city` and `area`; older records derive labels from the comma-separated address when possible.

### Duplicate complaint detection

- `POST /api/v1/complaints/duplicates/check` (authenticated citizen, volunteer, or admin): accepts the normal complaint title, description, category, and location payload. Returns `{ threshold, candidates }`; candidates include title, status, distance in meters, confidence as `similarityScore` (0–100), and supporter count. Detection compares category, normalized token overlap and title edit similarity, plus proximity within 300 meters. The default warning threshold is 62.
- `POST /api/v1/complaints` remains backward compatible. On a detected duplicate, it returns `409 DUPLICATE_DETECTED` with the best candidate unless the caller explicitly sends `allowDuplicate: true` after user confirmation. Confirmed duplicates retain `duplicateScore`, `duplicateOf`, and the legacy `isDuplicate`/`masterComplaint` fields.
- `POST /api/v1/complaints/:id/support-duplicate` (authenticated): idempotently adds the caller as a supporter and records a duplicate-prevention event. Returns `supporterCount`.
- `GET /api/v1/complaints/duplicates` (admin): lists flagged and linked complaints with their canonical complaint, merge state, duplicate score, and current supporter count.
- `POST /api/v1/complaints/:id/merge` (admin): accepts `{ "masterComplaintId": "ObjectId" }`, links the duplicate to the canonical complaint, and records merge actor/time.
- The existing `POST`/`DELETE /api/v1/complaints/:id/vote` routes keep their contract and update the compatible `supporterCount` field. Complaint detail responses include both legacy `voteCount` and `supporterCount`.
- Admin `GET /api/v1/dashboard/summary` retains all existing fields and adds `duplicateComplaints`, `mergedComplaints`, `duplicatesPrevented` (distinct reports citizens chose to support), `topDuplicateCategories`, and `duplicateSupportCount` (support actions).

## 1. API Architecture

The StreetSetu API is the primary backend integration surface for civic issue reporting, user identity, workflows, department operations, work order management, GIS location services, AI classification, visibility dashboards, and notification workflows.

The API is designed around a versioned REST shape:

- Base URL: `/api/v1`
- Content-Type: `application/json`
- Authentication: JWT access token in Authorization header for protected endpoints
- Supported API style: REST with JSON response payloads

---

## 2. Authentication Model

### Authentication Strategy

- Public endpoints are intentionally limited to issue creation and optional metadata discovery.
- Protected endpoints require a valid JWT.
- Refresh token flow is supported for session extension.
- Role-based access control is checked at the route and service level.

### Header

```http
Authorization: Bearer <jwt_access_token>
```

### Roles and Access Expectations

| Role | Access Style |
|---|---|
| citizen | Submit issues, view own issues, comment on assigned issues |
| volunteer | View local issues, support issue verification, local community actions |
| ward_officer | Maintain ward-level issue lifecycle, assign tasks, coordinate work orders |
| department_owner | Review work orders, manage operations, update resolution records |
| admin | Configuration, role management, moderation and reporting |
| system_admin | Platform administration and infrastructure-level access |

---

## 3. Common API Response Format

### Success Response

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "meta": {
    "requestId": "req_123456",
    "timestamp": "2026-09-15T10:00:00Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload is invalid",
    "details": [
      {
        "field": "title",
        "message": "Title must be at least 5 characters"
      }
    ]
  },
  "meta": {
    "requestId": "req_123456",
    "timestamp": "2026-09-15T10:00:00Z"
  }
}
```

---

## 4. Error Catalog

| HTTP Status | Error Code | Meaning |
|---|---|---|
| 400 | VALIDATION_ERROR | Payload or field validation failed |
| 401 | UNAUTHORIZED | Missing or invalid JWT |
| 403 | FORBIDDEN | User lacks permission |
| 404 | NOT_FOUND | Requested resource does not exist |
| 409 | CONFLICT | Duplicate issue or conflicting state |
| 422 | UNPROCESSABLE_ENTITY | Business validation failed |
| 429 | RATE_LIMITED | Request limit exceeded |
| 500 | INTERNAL_SERVER_ERROR | Unexpected server error |

---

## 5. Authentication Endpoints

### 5.1 Register User

**Endpoint**: `POST /api/v1/auth/register`

**Authentication**: None

**Request Body**:

```json
{
  "name": "Lakshya",
  "email": "lakshya@example.com",
  "phone": "+910000000000",
  "password": "SecurePassword123",
  "role": "citizen",
  "wardId": "ObjectId",
  "neighbourhoodId": "ObjectId"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "ObjectId",
      "name": "Lakshya",
      "email": "lakshya@example.com",
      "role": "citizen",
      "status": "pending",
      "createdAt": "2026-09-15T10:00:00Z"
    },
    "token": {
      "accessToken": "jwt",
      "refreshToken": "jwt",
      "expiresIn": 3600
    }
  }
}
```

**Error Responses**:

- `400 VALIDATION_ERROR` for invalid email, missing password, or duplicate phone/email
- `409 CONFLICT` for duplicate identity data

### 5.2 Login

**Endpoint**: `POST /api/v1/auth/login`

**Authentication**: None

**Request Body**:

```json
{
  "email": "lakshya@example.com",
  "password": "SecurePassword123"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "token": {
      "accessToken": "jwt",
      "refreshToken": "jwt",
      "expiresIn": 3600
    },
    "user": {
      "id": "ObjectId",
      "name": "Lakshya",
      "role": "citizen",
      "permissions": ["issue:create", "issue:read:own"]
    }
  }
}
```

**Error Responses**:

- `400 VALIDATION_ERROR` for missing email or password
- `401 UNAUTHORIZED` for invalid credentials

### 5.3 Refresh Token

**Endpoint**: `POST /api/v1/auth/refresh`

**Authentication**: Refresh token in body or secure cookie

**Request Body**:

```json
{
  "refreshToken": "jwt"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "expiresIn": 3600
  }
}
```

### 5.4 Logout

**Endpoint**: `POST /api/v1/auth/logout`

**Authentication**: Required

**Request Body**:

```json
{}
```

**Response Body**:

```json
{
  "success": true,
  "data": {},
  "message": "Logged out successfully"
}
```

---

## 6. User and Role APIs

### 6.1 Get Current User

**Endpoint**: `GET /api/v1/users/me`

**Authentication**: Required

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "name": "Lakshya",
    "email": "lakshya@example.com",
    "phone": "+910000000000",
    "role": "citizen",
    "departmentId": "ObjectId",
    "wardId": "ObjectId",
    "neighbourhoodId": "ObjectId",
    "permissions": ["issue:create", "issue:read:own"]
  }
}
```

### 6.2 List Users

**Endpoint**: `GET /api/v1/users`

**Authentication**: Required, admin or system_admin

**Query Params**:

- `role`
- `wardId`
- `departmentId`
- `status`
- `page`
- `limit`

**Response Body**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ObjectId",
        "name": "Lakshya",
        "email": "lakshya@example.com",
        "role": "citizen",
        "wardId": "ObjectId",
        "departmentId": "ObjectId",
        "status": "active"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 120
  }
}
```

### 6.3 Create User

**Endpoint**: `POST /api/v1/users`

**Authentication**: Required, admin or system_admin

**Request Body**:

```json
{
  "name": "New Officer",
  "email": "officer@example.com",
  "phone": "+919999999999",
  "password": "SecurePassword123",
  "role": "ward_officer",
  "wardId": "ObjectId",
  "departmentId": "ObjectId"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "name": "New Officer",
    "email": "officer@example.com",
    "role": "ward_officer",
    "status": "pending"
  }
}
```

---

## 7. Issue APIs

### 7.1 Create Issue

**Endpoint**: `POST /api/v1/issues`

**Authentication**: Required

**Request Body**:

```json
{
  "title": "Open drainage near road",
  "description": "Water remains blocked near the market road causing traffic and stagnant water.",
  "categoryId": "ObjectId",
  "wardId": "ObjectId",
  "neighbourhoodId": "ObjectId",
  "streetId": "ObjectId",
  "landmarkId": "ObjectId",
  "location": {
    "type": "Point",
    "coordinates": [77.123, 28.456]
  },
  "addressText": "Main Road, Market Street",
  "photos": [
    {
      "fileUrl": "https://storage.example.com/photos/a.png",
      "mimeType": "image/png",
      "caption": "Blocked drainage"
    }
  ],
  "priority": "medium",
  "source": "citizen"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "issueNumber": "SNAP-2026-0001",
    "title": "Open drainage near road",
    "status": "submitted",
    "priority": "medium",
    "categoryId": "ObjectId",
    "wardId": "ObjectId",
    "neighbourhoodId": "ObjectId",
    "createdAt": "2026-09-15T10:00:00Z",
    "aiSuggestion": {
      "categoryId": "ObjectId",
      "confidence": 0.92,
      "summary": "Blocked drainage and waterlogging issue",
      "duplicateMatches": []
    }
  }
}
```

**Error Responses**:

- `400 VALIDATION_ERROR` if required fields missing
- `401 UNAUTHORIZED` if token missing
- `422 UNPROCESSABLE_ENTITY` if issue is outside valid ward or category

### 7.2 List Issues

**Endpoint**: `GET /api/v1/issues`

**Authentication**: Required

**Query Params**:

- `status`
- `wardId`
- `neighbourhoodId`
- `departmentId`
- `categoryId`
- `priority`
- `assigneeId`
- `page`
- `limit`

**Response Body**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ObjectId",
        "issueNumber": "SNAP-2026-0001",
        "title": "Open drainage near road",
        "status": "submitted",
        "wardId": "ObjectId",
        "categoryId": "ObjectId",
        "priority": "medium",
        "createdAt": "2026-09-15T10:00:00Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### 7.3 Get Issue Detail

**Endpoint**: `GET /api/v1/issues/:id`

**Authentication**: Required

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "issueNumber": "SNAP-2026-0001",
    "title": "Open drainage near road",
    "description": "Water remains blocked near the market road causing traffic and stagnant water.",
    "status": "submitted",
    "priority": "medium",
    "category": {
      "id": "ObjectId",
      "name": "Drainage"
    },
    "ward": {
      "id": "ObjectId",
      "name": "Ward A"
    },
    "location": {
      "type": "Point",
      "coordinates": [77.123, 28.456]
    },
    "reporter": {
      "id": "ObjectId",
      "name": "Lakshya"
    },
    "history": [
      {
        "eventType": "created",
        "message": "Issue created by citizen",
        "createdAt": "2026-09-15T10:00:00Z"
      }
    ]
  }
}
```

### 7.4 Update Issue

**Endpoint**: `PUT /api/v1/issues/:id`

**Authentication**: Required, ward_officer or admin or owner role

**Request Body**:

```json
{
  "title": "Updated drainage issue title",
  "description": "Updated description",
  "priority": "high",
  "status": "reviewed",
  "categoryId": "ObjectId",
  "assignedToUserId": "ObjectId"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "status": "reviewed",
    "updatedAt": "2026-09-15T10:00:00Z"
  }
}
```

### 7.5 Delete Issue

**Endpoint**: `DELETE /api/v1/issues/:id`

**Authentication**: Required, admin or system_admin

**Response Body**:

```json
{
  "success": true,
  "data": {},
  "message": "Issue deleted successfully"
}
```

---

## 8. Workflow and Action APIs

### 8.1 Assign Issue

**Endpoint**: `POST /api/v1/issues/:id/assign`

**Authentication**: Required, ward_officer or admin

**Request Body**:

```json
{
  "assigneeId": "ObjectId",
  "departmentId": "ObjectId",
  "reason": "Assigned to drainage maintenance team"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "assignedToUserId": "ObjectId",
    "departmentId": "ObjectId",
    "status": "assigned"
  }
}
```

### 8.2 Change Issue Status

**Endpoint**: `PATCH /api/v1/issues/:id/status`

**Authentication**: Required, privileged issue owner or workflow role

**Request Body**:

```json
{
  "status": "in_progress",
  "message": "Field inspection assigned"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "status": "in_progress",
    "event": {
      "eventType": "status_changed",
      "fromStatus": "assigned",
      "toStatus": "in_progress"
    }
  }
}
```

### 8.3 Create Work Order

**Endpoint**: `POST /api/v1/work-orders`

**Authentication**: Required, department_owner or ward_officer or admin

**Request Body**:

```json
{
  "issueId": "ObjectId",
  "departmentId": "ObjectId",
  "assignedToUserId": "ObjectId",
  "title": "Drainage repair",
  "description": "Clean drainage and remove blockage",
  "priority": "high",
  "scheduleStart": "2026-09-16T10:00:00Z",
  "scheduleEnd": "2026-09-17T10:00:00Z"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "workOrderNumber": "WO-2026-0001",
    "issueId": "ObjectId",
    "status": "open",
    "departmentId": "ObjectId"
  }
}
```

### 8.4 List Work Orders

**Endpoint**: `GET /api/v1/work-orders`

**Authentication**: Required, department_owner or ward_officer or admin

**Response Body**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ObjectId",
        "workOrderNumber": "WO-2026-0001",
        "issueId": "ObjectId",
        "status": "open",
        "departmentId": "ObjectId",
        "priority": "high"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 10
  }
}
```

---

## 9. GIS and Location APIs

### 9.1 Search Neighbourhoods and Wards

**Endpoint**: `GET /api/v1/geo/search`

**Authentication**: Required or partially public depending on product policy

**Query Params**:

- `q`
- `lat`
- `lng`

**Response Body**:

```json
{
  "success": true,
  "data": {
    "ward": {
      "id": "ObjectId",
      "name": "Ward A",
      "code": "WARD_A"
    },
    "neighbourhood": {
      "id": "ObjectId",
      "name": "Market Area"
    },
    "street": {
      "id": "ObjectId",
      "name": "Main Road"
    }
  }
}
```

### 9.2 Get Ward Boundaries

**Endpoint**: `GET /api/v1/wards/:id/boundary`

**Authentication**: Required

**Response Body**:

```json
{
  "success": true,
  "data": {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": []
    },
    "properties": {
      "wardId": "ObjectId",
      "name": "Ward A"
    }
  }
}
```

---

## 10. Notification APIs

### 10.1 Send Notification

**Endpoint**: `POST /api/v1/notifications`

**Authentication**: Required, system or issue owner privileges

**Request Body**:

```json
{
  "userId": "ObjectId",
  "issueId": "ObjectId",
  "type": "email",
  "templateKey": "issue_status_update",
  "subject": "Issue status updated",
  "body": "Your issue is now in progress"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "status": "pending",
    "type": "email",
    "templateKey": "issue_status_update"
  }
}
```

### 10.2 Get Notifications

**Endpoint**: `GET /api/v1/notifications`

**Authentication**: Required

**Response Body**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ObjectId",
        "type": "email",
        "status": "sent",
        "subject": "Issue status updated",
        "createdAt": "2026-09-15T10:00:00Z"
      }
    ]
  }
}
```

---

## 11. AI APIs

### 11.1 Classify Issue

**Endpoint**: `POST /api/v1/ai/classify`

**Authentication**: Required, internal service or admin

**Request Body**:

```json
{
  "issueId": "ObjectId",
  "text": "Open drainage near market road",
  "location": {
    "type": "Point",
    "coordinates": [77.123, 28.456]
  }
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "categoryId": "ObjectId",
    "confidence": 0.91,
    "severity": "high",
    "priority": "medium",
    "summary": "Blocked drainage waterlogging issue near market road",
    "duplicateCandidateIssueIds": ["ObjectId"]
  }
}
```

### 11.2 Duplicate Detection

**Endpoint**: `POST /api/v1/ai/detect-duplicates`

**Authentication**: Required, internal service or admin

**Request Body**:

```json
{
  "issueId": "ObjectId",
  "text": "Drainage blocked near market",
  "location": {
    "type": "Point",
    "coordinates": [77.123, 28.456]
  }
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "issueId": "ObjectId",
    "duplicateIssueIds": ["ObjectId"],
    "similarityScore": 0.89,
    "reason": "Same drainage corridor and nearby location"
  }
}
```

---

## 12. Dashboard and Analytics APIs

### 12.0 Admin Analytics Dashboard

The following admin-only endpoints power the dashboard's complaint category and area charts, daily resolution trend, and volunteer performance ranking. Each endpoint returns the standard `{ success, data, message }` envelope. Overview, categories, and areas accept the supported category, status, and date filters where applicable; `resolution-trend` always returns the last 30 UTC calendar days, including zero-count days. Area and category responses are count-descending arrays. Leaderboard accepts `limit` (1–50, default 10) and returns the existing weighted volunteer score contract.

| Method and path | Data |
| --- | --- |
| `GET /api/v1/analytics/overview` | `totalComplaints`, `openComplaints`, `resolvedComplaints`, `resolutionRate` |
| `GET /api/v1/analytics/categories` | Array of `{ category, count }` |
| `GET /api/v1/analytics/areas` | Top 20 array of `{ area, count }` |
| `GET /api/v1/analytics/resolution-trend` | `{ days: [{ date, label, resolved }], totalResolved }` for the last 30 days |
| `GET /api/v1/analytics/leaderboard?limit=10` | Ranked volunteer performance with weighted score and component metrics |

The endpoints are additive and admin protected; existing dashboard and geographic analytics routes retain their contracts.

### 12.1 Dashboard Summary

**Endpoint**: `GET /api/v1/dashboard/summary`

**Authentication**: Required, ward_officer, department_owner, admin

**Response Body**:

```json
{
  "success": true,
  "data": {
    "totalIssues": 120,
    "openIssues": 40,
    "resolvedIssues": 60,
    "slaBreachedIssues": 8,
    "departmentCounts": {
      "drainage": 12,
      "street_light": 5
    },
    "wardPerformance": [
      {
        "wardId": "ObjectId",
        "wardName": "Ward A",
        "issueCount": 20,
        "resolutionRate": 75
      }
    ]
  }
}
```

### 12.2 Dashboard Trends

**Endpoint**: `GET /api/v1/dashboard/trends`

**Authentication**: Required

**Query Params**:

- `period` = `day|week|month|year`
- `wardId`
- `departmentId`

**Response Body**:

```json
{
  "success": true,
  "data": {
    "trendPoints": [
      {
        "date": "2026-09-01",
        "submitted": 20,
        "resolved": 12
      }
    ]
  }
}
```

### 12.3 Implemented Complaint Rejection Analytics

The implemented Express service mounts the versioned routes under `/api/v1` and exposes complaint status updates at `PATCH /api/v1/complaints/:id/status`. The following rejection contract applies to that endpoint:

- Only an admin may set `status` to `rejected`.
- The existing `note` field is the rejection reason for this status and must contain 1-1000 non-whitespace characters.
- A complaint can move to rejected from `submitted` or `under_review`; rejected complaints are terminal.
- A successful rejection stores `rejectedAt`, `rejectedBy`, and `rejectionReason` on the complaint.
- Each status-history item records `previousStatus`, `status`, `changedBy`, and `changedAt`; the rejection reason is also recorded as the item's `note`.
- The reporter and assigned volunteer receive in-app notifications; email notifications follow the existing notification configuration.

Example request:

```http
PATCH /api/v1/complaints/65f123456789012345678901/status
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "status": "rejected",
  "note": "The report does not describe a civic service issue."
}
```

The existing `GET /api/v1/dashboard/summary` response remains backward compatible. It retains the existing keys and adds:

- `rejectionRate`: rejected complaints divided by all complaints in the requester's scope, as a percentage (0-100).
- `topRejectionCategories`: up to five `{ "category": "...", "count": 0 }` entries, ordered by rejection count descending.

Existing `rejectedComplaints` and volunteer `rejectedComplaints` / `resolutionRate` fields are retained. Volunteer resolution rate excludes rejected assignments from its denominator.

---

## 13. Admin and Governance APIs

### 13.1 Master Category Create

**Endpoint**: `POST /api/v1/admin/categories`

**Authentication**: Required, admin or system_admin

**Request Body**:

```json
{
  "name": "Drainage",
  "slug": "drainage",
  "departmentId": "ObjectId",
  "severity": "high",
  "workflowTemplate": "standard"
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "name": "Drainage",
    "departmentId": "ObjectId"
  }
}
```

### 13.2 Ward Configuration

**Endpoint**: `POST /api/v1/admin/wards`

**Authentication**: Required, admin or system_admin

**Request Body**:

```json
{
  "name": "Ward A",
  "code": "WARD_A",
  "city": "Example City",
  "state": "Example State",
  "country": "India",
  "boundary": {
    "type": "Polygon",
    "coordinates": []
  }
}
```

**Response Body**:

```json
{
  "success": true,
  "data": {
    "id": "ObjectId",
    "name": "Ward A",
    "code": "WARD_A"
  }
}
```

---

## 14. Security Controls

- All protected endpoints must validate JWT and map token claims to role and permissions.
- Users should not access records outside their ward or department unless authorised.
- Input sanitization and schema validation must be enforced.
- Rate limiting should be applied to issue creation and AI endpoints.
- File uploads must be validated for type, size, and object storage access.
- Audit logs must record who created, changed, assigned, resolved, escalated, or closed issues.

---

## 15. Recommended API Governance

- Use versioned URLs under `/api/v1`.
- Enforce consistent `success`, `data`, and `error` response shapes.
- Treat AI endpoints as recommended classification systems requiring human review.
- Log all API events to the audit log collection.
- Scope public exposure carefully for GIS data and citizen issue details.

---

## 16. Approved Request and Response Standards

### Standard HTTP Codes

- `200 OK` for successful retrieval and update operations
- `201 Created` for new resource creation
- `204 No Content` for deletion or silent completion
- `400 Bad Request` for invalid payload format
- `401 Unauthorized` for unauthenticated user
- `403 Forbidden` for missing permission
- `404 Not Found` for missing resource
- `409 Conflict` for duplicate or conflicting record
- `422 Unprocessable Entity` for business-level validation failure
- `500 Internal Server Error` for unexpected errors

---

## 17. API Contract Summary

The API design should keep the following principle central:

Every issue should have one lifecycle record, one ownership map, one spatial context, one department routing record, and one audit trail.

This allows citizens, officers, departments, and administrators to interact through a consistent and transparent civic operations API.
