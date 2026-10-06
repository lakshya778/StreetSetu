# StreetSetu MongoDB Schema Design

## Production sessions and audit additions

The implemented Mongoose `notifications` record uses `recipient` and `complaint` ObjectId references, `type: in_app|email`, `status`, `title`, `message`, delivery metadata, `sentAt`, `readAt`, and `failureReason`. Email HTML is rendered at send time and is not stored. The broader reference schema later in this document describes the platform’s future extensible notification contract; the current model remains the operational source of truth.

`refreshsessions` stores rotating refresh-session metadata. It stores a SHA-256 token hash, never the raw refresh token, and has a TTL index on `expiresAt`. Revocation is recorded in `revokedAt`; user, request IP, and user-agent metadata support session management and investigations.

`auditlogs` stores actor, action, entity type/id, previous/new values, metadata, request ID, IP address, user agent, and timestamps. Indexes support created-time ordering, actor/action/entity filters, and request correlation. Complaint create, status, assignment, vote, and field-evidence operations write audit events while lifecycle history remains embedded in each complaint for backwards-compatible detail reads.

Duplicate detection extends complaint records with optional `duplicateScore` (0–100), `duplicateOf` (canonical complaint ObjectId), `supporterCount`, `mergedAt`, and `mergedBy`; legacy `isDuplicate` and `masterComplaint` remain populated for older clients. Existing Vote rows are the source of current supporter counts. `duplicatesupports` records a unique `(complaint, user)` duplicate-prevention action and category for analytics.

Geo analytics adds optional `city` and `area` strings to complaints. Existing `location` remains a GeoJSON Point and retains its `2dsphere` index. Compound `{ category, status, createdAt }`, `{ city, area, createdAt }`, and `{ area, category, status, createdAt }` indexes support common date/category/status and place rollups. Heatmap, hotspot, and geographic summary endpoints use MongoDB aggregation pipelines with bounded heatmap output; legacy city/area labels are derived from the address when structured values are absent.

The Production Release v1 transparency, reporting, and PWA changes did not require a collection migration. Citizen feedback and explicit assignment responses add the migration described below. Public transparency and tracking are read-only projections of `complaints`; precise complaint coordinates, reporter identity, and internal update notes are excluded from public responses. Email HTML/text is rendered from reusable templates and is not stored. The PWA stores user-scoped offline API snapshots in browser Cache Storage, not MongoDB.

### Citizen feedback and assignment acceptance schema update

The `feedback` collection stores one rating per resolved complaint. `complaint` has a unique index (the database-level one-feedback constraint), while `volunteer` and `citizen` reference `users`. Rating is an integer from 1 to 5; optional `comment` is trimmed and capped at 1,000 characters. Feedback is only writable by the complaint's reporting citizen after resolution.

Completion verification is stored as an optional embedded `complaints.completionVerification` object to preserve the existing complaint read contract. It contains `similarityScore`, `gpsMatched`, `gpsDistanceMeters`, `timestampValid`, `fraudScore`, `verificationStatus` (`pending|verified|needs_review|failed`), failure details, request/check timestamps, and optional admin decision metadata. A compound index on verification status and request time supports the admin review queue. Work evidence attachment subdocuments optionally store extracted `imageMetadata.latitude`, `imageMetadata.longitude`, and EXIF `imageMetadata.capturedAt`. No backfill is required; old evidence without metadata is sent to admin review when resolution is next attempted.

`assignments` adds `responseStatus` (`pending|accepted|declined`), `acceptedAt`, and `respondedAt`. New assignments begin pending. Volunteer acceptance/decline is stored for the 10% leaderboard component; declining closes the assignment and returns the complaint to `under_review`. The migration backfills legacy assignments as accepted at their original `assignedAt` time to preserve existing workflow behavior.

Run `npm run migrate:feedback-leaderboard` from `backend/` against the target database before deploying the API. It backfills assignment response state and creates feedback and response-status indexes. The migration is idempotent.

## Production deployment notes

MongoDB Atlas is the production operational database; set `MONGO_URI` to a least-privilege application user connection string with TLS and IP/network access restricted to the deployment. No relational schema or migration is added by Production Release v1. Atlas replica-set transactions can be introduced later if multi-document assignment/audit writes need atomicity.

## GEO, media, and assignment additions

The existing `complaints` collection retains its current shape and adds/uses these fields:

```json
{
  "location": { "type": "Point", "coordinates": [77.2, 28.61] },
  "attachments": [{ "url": "https://res.cloudinary.com/...", "mimeType": "image/jpeg", "fileName": "street.jpg", "size": 12345, "storageKey": "streetsetu/complaints/...", "uploadedBy": "ObjectId", "uploadedAt": "Date", "stage": "complaint" }],
  "beforeImages": [{ "url": "https://res.cloudinary.com/...", "mimeType": "image/jpeg", "size": 12345, "storageKey": "...", "uploadedBy": "ObjectId", "uploadedAt": "Date", "stage": "before" }],
  "afterImages": [{ "url": "https://res.cloudinary.com/...", "mimeType": "image/jpeg", "size": 12345, "storageKey": "...", "uploadedBy": "ObjectId", "uploadedAt": "Date", "stage": "after" }],
  "resolvedAt": "Date"
}
```

Images live in Cloudinary; MongoDB stores their URL, storage key, MIME type, size, name, uploader, timestamp, and workflow stage. Uploads accept JPG/JPEG/PNG/WebP up to 5 MiB, with at most 5 per request/stage. The `location` field has a `2dsphere` index.

Volunteer `users` may also hold optional `phone`, `area`, `city`, `availability` (`available|limited|unavailable|full_time|part_time|weekend|flexible`), `expertiseCategories`, and `location: { type: "Point", coordinates: [longitude, latitude] }`. The location has both a standalone `2dsphere` index and a compound `{ role, isActive, location: "2dsphere" }` index for nearby active volunteer queries. Assignment recommendations combine proximity, active workload, resolution history, and availability; no new collection is required. `assignments.distanceKm` records distance at assignment time where coordinates are available.

Nearby citizen discovery uses the existing `complaints.location` `2dsphere` index with `$geoNear`; support totals are aggregated from `votes`. Volunteer route optimization uses `users.location` as the route origin and complaint locations as stops. There is no route persistence: today’s active assignment set is read from `assignments` using `{ volunteer, isActive, assignedAt }`, then ordered in application code. `assignments.distanceKm` remains the assignment-time straight-line distance used for travel analytics; routes are recalculated on request.

Volunteer route lookups use the compound assignment index `{ volunteer: 1, isActive: 1, assignedAt: 1 }`. Public status tracking selects only title/category/status/timestamps, assigned volunteer name, and status history projection; it does not populate reporter or actor documents. Dashboard performance, resolution duration, and report exports are aggregation/query-time results and are not duplicated into user records.

Status changes continue to append to `complaints.statusHistory`, including actor, previous/new status, note, and `changedAt`. Rejection fields (`rejectionReason`, `rejectedAt`, `rejectedBy`) and the `notifications` collection support rejection workflows. No migration is needed because these are optional/defaulted document fields and existing APIs still accept older payloads.

## 1. Database Architecture Decision

StreetSetu should use MongoDB as the primary operational database for highly flexible civic issue, workflow, event, location, media, and AI evidence records. MongoDB is preferred because the platform needs:

- Flexible issue metadata and dynamic category fields
- GeoJSON location structures
- Binary or document-based media metadata
- Event sourcing and workflow milestone records
- High-volume civic reporting and analytics event streams

A relational layer may still be used for reference data such as role and permission control, but the core operational and document model should remain MongoDB-centric.

---

## 2. Collection Map

| Collection | Purpose |
|---|---|
| users | Citizens, officers, volunteers, department owners, admins and system actors |
| roles | Security and organisational role definitions |
| permissions | Fine-grained permissions by role and module |
| wards | Civic ward administrative geography |
| neighbourhoods | Local geography and ward sub-areas |
| streets | Street-level location reference data |
| landmarks | Landmark and civic geography metadata |
| departments | Municipal or civic production departments |
| categories | Issue taxonomy and department/category routing metadata |
| issues | Core issue ticket records |
| issue_events | Lifecycle and workflow events for each issue |
| issue_comments | Citizen and officer comments on issues |
| issue_photos | Photos or media metadata associated with an issue |
| work_orders | Work execution records and action delivery records |
| action_tasks | Operational tasks linked to work orders or issues |
| volunteers | Volunteer profiles and engagement state |
| community_groups | Community action groups and neighborhood coalitions |
| notifications | User-facing notification records and delivery status |
| audit_logs | Security, access, and operational audit logs |
| ai_runs | AI processing runs and metadata |
| ai_dedupe_results | Duplicate detection outputs |
| ai_priority_results | Priority and scoring outputs |
| reports | Generated dashboard and public reports |

---

## 3. Common Field Standards

All collections should follow these shared conventions:

- `_id`: MongoDB ObjectId
- `createdAt`: Date
- `updatedAt`: Date
- `createdBy`: ObjectId reference to users
- `updatedBy`: ObjectId reference to users
- `deletedAt`: nullable Date
- `isDeleted`: boolean default false
- `version`: integer default 1
- `metadata`: object for non-structured fields

---

## 4. Collection Schemas

### 4.1 users

Purpose: Store all platform users and profile identity information.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true, "trim": true, "minLength": 2 },
  "email": { "type": "string", "required": true, "unique": true, "lowercase": true, "regex": "email" },
  "phone": { "type": "string", "unique": true, "sparse": true, "regex": "phone" },
  "passwordHash": { "type": "string", "required": true },
  "avatarUrl": { "type": "string", "default": null },
  "roleIds": [{ "type": "ObjectId", "ref": "roles" }],
  "departmentId": { "type": "ObjectId", "ref": "departments", "default": null },
  "wardId": { "type": "ObjectId", "ref": "wards", "default": null },
  "neighbourhoodId": { "type": "ObjectId", "ref": "neighbourhoods", "default": null },
  "status": { "type": "string", "enum": ["active", "pending", "blocked", "inactive"], "default": "pending" },
  "isVerified": { "type": "boolean", "default": false },
  "lastLoginAt": { "type": "date", "default": null },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" },
  "createdBy": { "type": "ObjectId", "ref": "users", "default": null },
  "updatedBy": { "type": "ObjectId", "ref": "users", "default": null },
  "deletedAt": { "type": "date", "default": null },
  "isDeleted": { "type": "boolean", "default": false }
}
```

References:

- `roleIds` -> roles
- `departmentId` -> departments
- `wardId` -> wards
- `neighbourhoodId` -> neighbourhoods

Indexes:

- unique index on `email`
- unique sparse index on `phone`
- index on `roleIds`
- index on `wardId`
- index on `departmentId`
- index on `status`
- text index on `name`
- `2dsphere` index on `location`; compound `{ role, isActive, location: "2dsphere" }` index for volunteer search

Validation rules:

- `email` must be valid
- `passwordHash` cannot be empty
- `status` must be one of allowed enum values

---

### 4.2 roles

Purpose: Security role catalog shared across all user groups.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true, "unique": true, "enum": ["citizen", "volunteer", "ward_officer", "department_owner", "admin", "system_admin"] },
  "description": { "type": "string", "default": "" },
  "isSystem": { "type": "boolean", "default": false },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

Indexes:

- unique index on `name`

Validation rules:

- role names are fixed and controlled by the platform

---

### 4.3 permissions

Purpose: Fine-grained authorization primitives that may be assigned to roles.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true, "unique": true },
  "module": { "type": "string", "required": true },
  "action": { "type": "string", "required": true },
  "resource": { "type": "string", "required": true },
  "description": { "type": "string", "default": "" },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

Indexes:

- unique index on `module + action + resource`

---

### 4.4 wards

Purpose: Ward geography object.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true },
  "code": { "type": "string", "required": true, "unique": true },
  "city": { "type": "string", "required": true },
  "state": { "type": "string", "required": true },
  "country": { "type": "string", "required": true },
  "boundary": { "type": "GeoJSON", "required": true },
  "center": { "type": "GeoJSON Point", "required": true },
  "adminUserId": { "type": "ObjectId", "ref": "users", "default": null },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

Indexes:

- unique index on `code`
- geospatial index on `boundary`
- geospatial index on `center`
- index on `city`

---

### 4.5 neighbourhoods

Purpose: Neighborhood or locality section inside a ward.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true },
  "wardId": { "type": "ObjectId", "ref": "wards", "required": true },
  "boundary": { "type": "GeoJSON", "required": true },
  "center": { "type": "GeoJSON Point", "required": true },
  "populationEstimate": { "type": "number", "default": 0 },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `wardId` -> wards

Indexes:

- index on `wardId`
- geospatial index on `center`
- text index on `name`

---

### 4.6 streets

Purpose: Street and location reference records.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true },
  "neighbourhoodId": { "type": "ObjectId", "ref": "neighbourhoods", "required": true },
  "wardId": { "type": "ObjectId", "ref": "wards", "required": true },
  "lineString": { "type": "GeoJSON LineString", "default": null },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `neighbourhoodId` -> neighbourhoods
- `wardId` -> wards

Indexes:

- index on `wardId`
- index on `neighbourhoodId`
- geospatial index on `lineString`

---

### 4.7 landmarks

Purpose: Landmarks or civic places used for issue location context.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true },
  "type": { "type": "string", "enum": ["park", "school", "hospital", "market", "junction", "public_place", "other"], "required": true },
  "neighbourhoodId": { "type": "ObjectId", "ref": "neighbourhoods", "default": null },
  "wardId": { "type": "ObjectId", "ref": "wards", "default": null },
  "location": { "type": "GeoJSON Point", "required": true },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

---

### 4.8 departments

Purpose: Municipal or partner departments for issue allocation.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true, "unique": true },
  "code": { "type": "string", "required": true, "unique": true },
  "description": { "type": "string", "default": "" },
  "headUserId": { "type": "ObjectId", "ref": "users", "default": null },
  "email": { "type": "string", "default": null, "regex": "email" },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

Indexes:

- unique index on `code`
- unique index on `name`

---

### 4.9 categories

Purpose: Issue category taxonomy.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true, "unique": true },
  "slug": { "type": "string", "required": true, "unique": true },
  "description": { "type": "string", "default": "" },
  "parentCategoryId": { "type": "ObjectId", "ref": "categories", "default": null },
  "departmentId": { "type": "ObjectId", "ref": "departments", "default": null },
  "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"], "default": "medium" },
  "workflowTemplate": { "type": "string", "default": "standard" },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `parentCategoryId` -> categories
- `departmentId` -> departments

Indexes:

- unique index on `name`
- unique index on `slug`
- index on `parentCategoryId`
- index on `departmentId`

---

### 4.10 issues

Purpose: Primary city issue lifecycle record.

Fields:

```json
{
  "_id": "ObjectId",
  "issueNumber": { "type": "string", "required": true, "unique": true },
  "title": { "type": "string", "required": true, "trim": true, "minLength": 5 },
  "description": { "type": "string", "required": true, "minLength": 20 },
  "categoryId": { "type": "ObjectId", "ref": "categories", "required": true },
  "departmentId": { "type": "ObjectId", "ref": "departments", "default": null },
  "wardId": { "type": "ObjectId", "ref": "wards", "required": true },
  "neighbourhoodId": { "type": "ObjectId", "ref": "neighbourhoods", "default": null },
  "streetId": { "type": "ObjectId", "ref": "streets", "default": null },
  "landmarkId": { "type": "ObjectId", "ref": "landmarks", "default": null },
  "reporterUserId": { "type": "ObjectId", "ref": "users", "required": true },
  "assignedToUserId": { "type": "ObjectId", "ref": "users", "default": null },
  "status": { "type": "string", "enum": ["submitted", "reviewed", "assigned", "in_progress", "resolved", "rejected", "escalated"], "default": "submitted" },
  "priority": { "type": "string", "enum": ["low", "medium", "high", "critical"], "default": "medium" },
  "severity": { "type": "string", "enum": ["low", "medium", "high", "critical"], "default": "medium" },
  "source": { "type": "string", "enum": ["citizen", "volunteer", "officer", "admin", "api"], "default": "citizen" },
  "location": { "type": "GeoJSON Point", "required": true },
  "addressText": { "type": "string", "default": "" },
  "imageUrls": [{ "type": "string" }],
  "videoUrls": [{ "type": "string" }],
  "aiClassification": {
    "categoryId": { "type": "ObjectId", "ref": "categories", "default": null },
    "confidence": { "type": "number", "default": 0 },
    "summary": { "type": "string", "default": "" },
    "duplicateMatchIds": [{ "type": "ObjectId", "ref": "issues" }]
  },
  "slaDeadline": { "type": "date", "default": null },
  "resolvedAt": { "type": "date", "default": null },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" },
  "createdBy": { "type": "ObjectId", "ref": "users" },
  "updatedBy": { "type": "ObjectId", "ref": "users" },
  "deletedAt": { "type": "date", "default": null },
  "isDeleted": { "type": "boolean", "default": false }
}
```

References:

- `categoryId` -> categories
- `departmentId` -> departments
- `wardId` -> wards
- `neighbourhoodId` -> neighbourhoods
- `streetId` -> streets
- `landmarkId` -> landmarks
- `reporterUserId` -> users
- `assignedToUserId` -> users
- `aiClassification.categoryId` -> categories
- `aiClassification.duplicateMatchIds` -> issues

Indexes:

- unique index on `issueNumber`
- index on `status`
- index on `priority`
- index on `categoryId`
- index on `departmentId`
- index on `wardId`
- index on `neighbourhoodId`
- index on `reporterUserId`
- index on `assignedToUserId`
- index on `createdAt`
- geospatial index on `location`
- text index on `title`, `description`, `addressText`

Validation rules:

- `title` must have minimum length 5
- `description` must have minimum length 20
- `location` must be a valid GeoJSON Point
- `status` must be from the enum list
- `priority` and `severity` must be from the enum list
- `reporterUserId` is required
- `categoryId` is required
- `wardId` is required

#### Implemented complaint rejection fields

The running Mongoose model is `Complaint` (MongoDB collection `complaints`). Its rejection lifecycle adds these optional fields so existing documents remain readable without migration:

```json
{
  "rejectedAt": "date",
  "rejectedBy": "ObjectId reference to users",
  "rejectionReason": "string, maximum 1000 characters",
  "statusHistory": [
    {
      "previousStatus": "string from the complaint status enum, omitted for initial creation",
      "status": "string from the complaint status enum",
      "changedBy": "ObjectId reference to users",
      "changedAt": "date",
      "note": "string; required for a rejection event"
    }
  ]
}
```

New rejections populate all three rejection fields and append a history entry. Older rejected documents may not have these values and are not backfilled because their reasons and actors cannot be reliably inferred.

---

### 4.11 issue_events

Purpose: Event-sourced lifecycle timeline for an issue.

Fields:

```json
{
  "_id": "ObjectId",
  "issueId": { "type": "ObjectId", "ref": "issues", "required": true },
  "eventType": { "type": "string", "required": true, "enum": ["created", "assigned", "status_changed", "commented", "photo_uploaded", "resolved", "reopened", "escalated", "rejected"] },
  "fromStatus": { "type": "string", "default": null },
  "toStatus": { "type": "string", "default": null },
  "message": { "type": "string", "required": true },
  "actorUserId": { "type": "ObjectId", "ref": "users", "default": null },
  "metadata": { "type": "object", "default": {} },
  "createdAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `issueId` -> issues
- `actorUserId` -> users

Indexes:

- index on `issueId`
- index on `eventType`
- index on `createdAt`

---

### 4.12 issue_comments

Purpose: Citizen, officer, and admin comments on an issue.

Fields:

```json
{
  "_id": "ObjectId",
  "issueId": { "type": "ObjectId", "ref": "issues", "required": true },
  "userId": { "type": "ObjectId", "ref": "users", "required": true },
  "body": { "type": "string", "required": true, "minLength": 1 },
  "visibility": { "type": "string", "enum": ["public", "internal", "ward_only"], "default": "public" },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `issueId` -> issues
- `userId` -> users

Indexes:

- index on `issueId`
- index on `userId`
- index on `createdAt`

---

### 4.13 issue_photos

Purpose: Photo/document metadata for civic issue evidence.

Fields:

```json
{
  "_id": "ObjectId",
  "issueId": { "type": "ObjectId", "ref": "issues", "required": true },
  "userId": { "type": "ObjectId", "ref": "users", "required": true },
  "fileUrl": { "type": "string", "required": true },
  "storageKey": { "type": "string", "required": true },
  "mimeType": { "type": "string", "required": true },
  "sizeBytes": { "type": "number", "min": 0 },
  "caption": { "type": "string", "default": "" },
  "isPrimary": { "type": "boolean", "default": false },
  "createdAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `issueId` -> issues
- `userId` -> users

Indexes:

- index on `issueId`
- index on `userId`
- index on `storageKey`

Validation rules:

- `fileUrl` must be a valid URL or object-store reference
- `mimeType` must be one of supported photo/document types

---

### 4.14 work_orders

Purpose: Field work execution and operational action record.

Fields:

```json
{
  "_id": "ObjectId",
  "workOrderNumber": { "type": "string", "required": true, "unique": true },
  "issueId": { "type": "ObjectId", "ref": "issues", "required": true },
  "departmentId": { "type": "ObjectId", "ref": "departments", "required": true },
  "assignedToUserId": { "type": "ObjectId", "ref": "users", "default": null },
  "title": { "type": "string", "required": true },
  "description": { "type": "string", "default": "" },
  "status": { "type": "string", "enum": ["open", "assigned", "in_progress", "blocked", "completed", "cancelled"], "default": "open" },
  "priority": { "type": "string", "enum": ["low", "medium", "high", "critical"], "default": "medium" },
  "scheduleStart": { "type": "date", "default": null },
  "scheduleEnd": { "type": "date", "default": null },
  "completionEvidence": { "type": "object", "default": {} },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `issueId` -> issues
- `departmentId` -> departments
- `assignedToUserId` -> users

Indexes:

- unique index on `workOrderNumber`
- index on `issueId`
- index on `departmentId`
- index on `assignedToUserId`
- index on `status`

---

### 4.15 action_tasks

Purpose: Checklist or operational task steps inside a work order.

Fields:

```json
{
  "_id": "ObjectId",
  "workOrderId": { "type": "ObjectId", "ref": "work_orders", "required": true },
  "title": { "type": "string", "required": true },
  "description": { "type": "string", "default": "" },
  "status": { "type": "string", "enum": ["pending", "in_progress", "completed", "blocked"], "default": "pending" },
  "assignedToUserId": { "type": "ObjectId", "ref": "users", "default": null },
  "dueAt": { "type": "date", "default": null },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

Indexes:

- index on `workOrderId`
- index on `status`
- index on `assignedToUserId`

---

### 4.16 volunteers

Purpose: Local volunteers, field participants, and community mobilisers.

Fields:

```json
{
  "_id": "ObjectId",
  "userId": { "type": "ObjectId", "ref": "users", "required": true },
  "skills": [{ "type": "string" }],
  "availability": { "type": "string", "enum": ["available", "limited", "unavailable", "full_time", "part_time", "weekend", "flexible"], "default": "available" },
  "neighbourhoodId": { "type": "ObjectId", "ref": "neighbourhoods", "default": null },
  "wardId": { "type": "ObjectId", "ref": "wards", "default": null },
  "verificationStatus": { "type": "string", "enum": ["pending", "verified", "rejected"], "default": "pending" },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `userId` -> users
- `neighbourhoodId` -> neighbourhoods
- `wardId` -> wards

---

### 4.17 community_groups

Purpose: Local community or street action groups.

Fields:

```json
{
  "_id": "ObjectId",
  "name": { "type": "string", "required": true },
  "description": { "type": "string", "default": "" },
  "wardId": { "type": "ObjectId", "ref": "wards", "required": true },
  "neighbourhoodId": { "type": "ObjectId", "ref": "neighbourhoods", "default": null },
  "leaderUserId": { "type": "ObjectId", "ref": "users", "default": null },
  "memberUserIds": [{ "type": "ObjectId", "ref": "users" }],
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

Indexes:

- index on `wardId`
- index on `neighbourhoodId`
- index on `leaderUserId`

---

### 4.18 notifications

Purpose: System notifications delivered to users.

Fields:

```json
{
  "_id": "ObjectId",
  "userId": { "type": "ObjectId", "ref": "users", "required": true },
  "issueId": { "type": "ObjectId", "ref": "issues", "default": null },
  "type": { "type": "string", "enum": ["email", "sms", "whatsapp", "push", "inapp"], "required": true },
  "templateKey": { "type": "string", "required": true },
  "subject": { "type": "string", "default": "" },
  "body": { "type": "string", "required": true },
  "status": { "type": "string", "enum": ["pending", "sent", "failed", "read"], "default": "pending" },
  "providerMessageId": { "type": "string", "default": null },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `userId` -> users
- `issueId` -> issues

Indexes:

- index on `userId`
- index on `issueId`
- index on `status`
- index on `type`

---

### 4.19 audit_logs

Purpose: Compliance, access, and operational audit record.

Fields:

```json
{
  "_id": "ObjectId",
  "actorUserId": { "type": "ObjectId", "ref": "users", "default": null },
  "action": { "type": "string", "required": true },
  "resourceType": { "type": "string", "required": true },
  "resourceId": { "type": "ObjectId", "default": null },
  "details": { "type": "object", "default": {} },
  "ipAddress": { "type": "string", "default": null },
  "userAgent": { "type": "string", "default": null },
  "createdAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `actorUserId` -> users

Indexes:

- index on `actorUserId`
- index on `resourceType`
- index on `resourceId`
- index on `createdAt`

---

### 4.20 ai_runs

Purpose: Capture AI model execution metadata.

Fields:

```json
{
  "_id": "ObjectId",
  "issueId": { "type": "ObjectId", "ref": "issues", "required": true },
  "pipeline": { "type": "string", "required": true, "enum": ["classification", "duplicate_detection", "priority", "summary", "routing"] },
  "modelName": { "type": "string", "required": true },
  "version": { "type": "string", "required": true },
  "status": { "type": "string", "enum": ["queued", "running", "completed", "failed"], "default": "queued" },
  "inputSnapshot": { "type": "object", "default": {} },
  "result": { "type": "object", "default": {} },
  "confidence": { "type": "number", "default": 0 },
  "createdAt": { "type": "date", "default": "Date.now" },
  "updatedAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `issueId` -> issues

Indexes:

- index on `issueId`
- index on `pipeline`
- index on `status`

---

### 4.21 ai_dedupe_results

Purpose: Output of duplicate issue detection.

Fields:

```json
{
  "_id": "ObjectId",
  "issueId": { "type": "ObjectId", "ref": "issues", "required": true },
  "relatedIssueIds": [{ "type": "ObjectId", "ref": "issues" }],
  "score": { "type": "number", "required": true, "min": 0, "max": 1 },
  "reason": { "type": "string", "default": "" },
  "status": { "type": "string", "enum": ["pending", "accepted", "rejected"], "default": "pending" },
  "createdAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `issueId` -> issues
- `relatedIssueIds` -> issues

---

### 4.22 ai_priority_results

Purpose: Issue scoring and routing reasoning outputs.

Fields:

```json
{
  "_id": "ObjectId",
  "issueId": { "type": "ObjectId", "ref": "issues", "required": true },
  "priorityScore": { "type": "number", "required": true, "min": 0, "max": 100 },
  "severityScore": { "type": "number", "required": true, "min": 0, "max": 100 },
  "departmentSuggestionId": { "type": "ObjectId", "ref": "departments", "default": null },
  "confidence": { "type": "number", "default": 0 },
  "explanation": { "type": "string", "default": "" },
  "createdAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `issueId` -> issues
- `departmentSuggestionId` -> departments

---

### 4.23 reports

Purpose: Dashboard and public reporting records.

Fields:

```json
{
  "_id": "ObjectId",
  "type": { "type": "string", "enum": ["ward", "department", "city", "public"], "required": true },
  "name": { "type": "string", "required": true },
  "filters": { "type": "object", "default": {} },
  "period": { "type": "string", "default": "monthly" },
  "payload": { "type": "object", "default": {} },
  "createdBy": { "type": "ObjectId", "ref": "users", "default": null },
  "createdAt": { "type": "date", "default": "Date.now" }
}
```

References:

- `createdBy` -> users

---

## 5. Relationship Summary

### User and Access Relationships

- A user has many role references.
- A role can be assigned many users.
- A permission belongs to a role through role-permission assignment or role mapping.

### Geographic Relationships

- Many neighbourhoods belong to one ward.
- Many streets belong to a neighbourhood and a ward.
- Many issues belong to a neighbourhood and ward.

### Issue to Workflow Relationships

- One issue belongs to one category.
- One issue belongs to many issue events.
- One issue has many comments and photos.
- One issue can be associated with many work orders and AI runs.

### Department and Action Relationships

- Many categories belong to one department.
- Many work orders belong to one department.
- Many issues are routed to a department.

### Community and Volunteer Relationships

- A volunteer maps to a user profile and a ward or neighbourhood.
- A community group is linked to a ward and optionally a neighbourhood.
- A group may include many users as members.

---

## 6. Index Strategy

Recommended indexes:

- Unique indexes for person identity, issue number, category slug, department code, ward code, role name.
- Text indexes for issue title, description, and address text.
- Compound indexes for search and list queries such as status + wardId + createdAt.
- Geospatial indexes for ward boundary, neighbourhood center, street line, issue location, and landmark location.
- TTL indexes for notifications or expired sessions if necessary.

Example compound indexes:

```json
{ "wardId": 1, "status": 1, "createdAt": -1 }
{ "categoryId": 1, "priority": 1, "createdAt": -1 }
{ "departmentId": 1, "status": 1, "createdAt": -1 }
```

---

## 7. Validation Rules

General validations:

- All required references must be ObjectIds in existing collections.
- String fields must not exceed business-sensible length limits.
- GeoJSON shape must be valid for location and boundary records.
- Category, role, and status fields must use enum validation.
- Unique fields must be enforced in MongoDB unique indexes.
- File metadata must ensure `mimeType`, `storageKey`, and `fileUrl` are present for media records.

---

## 8. Suggested MongoDB Schema Notes

This schema design should be implemented with:

- `validator` rules in MongoDB collection-level schema validation where possible
- Application-level domain validation in the API layer
- Mongoose or TypeScript schema decorators for code generation only where desired
- Migration tooling for collection creation and index creation

The schema is intended to support the PRD’s issue lifecycle, user roles, civic geography, department routing, AI classification, and action resolution workflow.
