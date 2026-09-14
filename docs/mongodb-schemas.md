# StreetSetu MongoDB Schema Design

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
  "availability": { "type": "string", "enum": ["full_time", "part_time", "weekend", "flexible"], "default": "flexible" },
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
