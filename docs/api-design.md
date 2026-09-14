# StreetSetu API Design Document

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
