# StreetSetu Rejection Workflow and Dashboard Change Plan

## Purpose

This plan maps the requested volunteer performance, rejection lifecycle, notifications, audit history, and admin analytics work to the existing StreetSetu structure. This document is the only file created in this planning step; application code remains unchanged.

## Repository structure used

- `backend/src/models/`, `backend/src/validators/`, `backend/src/services/`, `backend/src/controllers/`, and `backend/src/routes/` contain the Express/Mongoose data model and API layers.
- `frontend/src/pages/` contains the volunteer, complaint detail, and admin dashboard screens.
- `frontend/src/components/` contains reusable UI components; `frontend/src/styles.css` contains the existing design system styles.
- `docs/` contains the API and database design documentation.

## Existing behavior found during inspection

- Rejected status is already part of the complaint model's status enum.
- The volunteer dashboard already shows rejected complaints separately, has a rejected metric, and calculates the rate as resolved divided by assignments excluding rejected complaints. Its red metric and badge styles are present.
- `GET /dashboard/summary` already returns `rejectedComplaints`. Volunteer performance already includes a rejected count and excludes those records from the resolution-rate denominator.
- Assignment, resolution, and general status-change notifications already exist. Rejections currently use the generic status-change notification.
- The admin complaint list already supports filtering by rejected status. The admin dashboard does not yet have rejection metrics, a rejection category breakdown, or a rejected complaints table.
- Status updates currently accept rejected status with an optional note. They do not enforce an admin-only rejection reason, persist `rejectedAt` / `rejectedBy`, or record the previous status in the history item.

## Planned file changes

| File | Planned work | Reason |
|---|---|---|
| `backend/src/models/Complaint.js` | Add optional `rejectedAt` and `rejectedBy` complaint fields; add `previousStatus` (from-status) to status history. | Persist rejection facts and an auditable from/to status record. |
| `backend/src/validators/complaintValidator.js` | Require a non-empty reason when the requested status is `rejected`; retain the existing note limit. | Reject invalid rejection requests at the API boundary. |
| `backend/src/services/complaintService.js` | Restrict rejection to admins; enforce valid lifecycle transitions; set rejection metadata; append history with actor, previous status, new status, timestamp, and reason; invoke rejection notification. | Make lifecycle rules authoritative in the backend and preserve the audit trail. |
| `backend/src/services/notificationService.js` | Add an explicit rejection notification to the reporter and relevant assignee, including reason and status metadata. | Give rejection a clear notification while preserving current assignment, resolution, and other status notifications. |
| `backend/src/services/dashboardService.js` | Keep current summary fields and calculations; add `rejectionRate` and `topRejectionCategories` to the response. | Supply admin analytics as additive fields for backward compatibility. Rejection rate will be rejected complaints divided by total complaints, with a zero-total fallback. |
| `frontend/src/pages/ComplaintDetailsPage.jsx` | Require and label a rejection reason when an admin selects rejected; keep other status notes optional; display previous/new status and rejection reason in history. | Match the API's rejection contract and show an understandable audit trail. |
| `frontend/src/pages/DashboardPage.jsx` | Add rejected count and rejection rate cards; render top rejection categories; load summary data for existing dashboard content. | Surface rejection analytics in the current admin dashboard. |
| `frontend/src/components/complaints/RejectedComplaintsTable.jsx` *(new)* | Build a reusable rejected complaints table using the existing complaints API with `status=rejected`; include complaint, category, reason, actor, and rejection date where returned. | Provide the requested rejected complaints table without adding a new list endpoint. |
| `frontend/src/pages/DashboardPage.jsx` | Include the reusable rejected complaints table on the admin dashboard. | Keep table rendering isolated in a reusable component. |
| `frontend/src/styles.css` | Add styles for dashboard rejection cards, category summary, and rejected table using existing colors, badges, and responsive breakpoints. | Keep the new UI consistent with existing pages. |
| `docs/api-design.md` | Document the existing complaint status endpoint's rejection reason requirement, admin authorization, history fields, notification behavior, and additive summary fields. | Keep API documentation aligned with implementation. |
| `docs/mongodb-schemas.md` | Document the rejection metadata and status-history from/to fields. | Keep the persisted data contract documented. |

## Files expected to remain unchanged

- `frontend/src/pages/VolunteerDashboardPage.jsx` and existing volunteer rejected styles: the requested rejected card, rejected workflow section, and rejected-excluded rate are already implemented.
- `backend/src/controllers/complaintController.js` and `backend/src/routes/complaintRoutes.js`: the existing authenticated `PATCH /complaints/:id/status` endpoint can carry the rejection request; no new endpoint is needed.
- `frontend/src/api/complaints.js`: it already sends status update payloads and can carry the reason in the existing note field.
- `backend/src/controllers/dashboardController.js` and `backend/src/routes/dashboardRoutes.js`: the existing summary route can return additive analytics fields.

## Data migration

No database migration is planned. MongoDB documents can acquire the new optional fields on update. Existing rejected complaints will not have reliable `rejectedAt`, `rejectedBy`, or reason data to backfill, so those values will remain absent for historical records unless a trustworthy source is identified.

## Compatibility and behavior notes

- Existing dashboard summary keys and volunteer performance fields will remain in place; new rejection analytics will be additive.
- Only admins may reject complaints, and each new rejection must include a reason.
- The rejected status will be terminal under the requested lifecycle unless the product later defines a reopen flow.
- Assignment and resolution notifications will continue to use their existing paths; rejection receives a specific notification.
- The rejection rate definition for the admin dashboard is rejected complaints / total complaints. The volunteer resolution rate remains resolved / (assignments - rejected), as requested.
- No tests are added or run as part of this plan-writing step.

## Implementation order

1. Update complaint schema and request validation.
2. Implement transition checks, rejection metadata, history, and notification behavior in backend services.
3. Extend the dashboard summary with additive rejection analytics.
4. Update the complaint detail rejection form and history display.
5. Add the reusable rejected complaints table and admin dashboard analytics presentation.
6. Update API and MongoDB schema documentation.
7. Review changed files and verify the implementation in a separate coding step.
