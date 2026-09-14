# StreetSetu Gap Analysis Report

## 1. Objective

This gap analysis reviews the generated monorepo architecture, folder structure, MongoDB schema design, and API design document against the StreetSetu PRD context and the expected civic issue reporting, neighbourhood action, geospatial intelligence, workflow management, and AI-assisted operations model.

The goal is to identify missing architectural modules, APIs, database collections, AI workflows, and user roles before implementation begins.

---

## 2. Executive Summary

The generated artifacts already introduce the main product areas correctly:

- Core civic issue intake
- Geographic and ward structure
- Issue lifecycle and work-order model
- Public-facing API and admin-facing API
- AI service and dashboard intent
- Shared packages and a monorepo structure

However, the generated artifacts are still incomplete for a production-ready StreetSetu PRD implementation because they do not fully cover:

1. Community impact and public participation workflows
2. Public transparency and grievance escalation
3. Utility and asset management for neighbourhood services
4. Field inspection and contract execution workflows
5. A complete AI-driven automation pipeline for classification, routing, duplicate resolution, and triage
6. Governance and privacy layers for citizen visibility and data retention

---

## 3. Modules Missing from the Proposed Architecture

The following modules are either not represented clearly in the monorepo structure or need explicit service ownership.

| Missing Module | Why It Is Required by PRD | Current Coverage Gap |
|---|---|---|
| Community Engagement & Campaign Module | The PRD implies local neighbourhood action, volunteers, campaigns, and public events. | No explicit `apps/web` or `services/api` module dedicated to campaign lifecycle, local mobilization events, or volunteer outreach. |
| Public Transparency & Grievance Publishing Module | Civic platforms require a public-facing issue transparency channel, action publication, and resolution visibility. | No shared public portal or transparent report archive layer beyond generic dashboard APIs. |
| Field Inspection & Verification Module | The PRD needs proof collection, inspection records, closure evidence, and citizen verification of work completion. | `issue_photos` exists, but there is no separate inspection collection, evidence workflow, or inspection template service. |
| Asset Registry & Service Infrastructure Module | StreetSetu should support street assets such as streetlights, drains, bins, parks, water assets, and public infrastructures. | No asset registry package, service, or model exists in the current architecture. |
| Ward Action Planning Module | The PRD suggests local area action planning and ward-level civic operations. | No explicit ward action plan or neighbourhood action plan module exists. |
| Department Capacity & SLA Performance Module | Departments need capacity, staff workload, and SLA accountability. | No explicit capacity model, department staffing model, or SLA governance service. |
| Data Quality & Governance Module | City systems need validation, master data health, taxonomic quality, audit compliance, and field completeness. | No standalone data-quality service, cleansing workflow, or validation dashboard module. |
| Integration & Notification Gateway Module | Multi-channel messaging across SMS, email, WhatsApp, and in-app systems is expected. | Notification APIs exist, but not a gateway abstraction or multi-channel provider registry. |
| Reporting & Export Module | Public, officer, and executive reports need scheduled and downloadable formats. | Report APIs exist in the schema, but there is no report generation and export service structure in the monorepo. |
| AI Governance & Human Review Module | AI outputs require human-in-the-loop controls and explanation logs. | AI service exists, but no explicit governance, human review queue, model feedback, or explainability service area is shown. |

---

## 4. Missing APIs

The current API design document covers many APIs, but the StreetSetu PRD needs a larger operational API boundary.

| Missing API | Why It Is Required | Suggested Dimension |
|---|---|---|
| `GET /api/v1/categories/tree` | Category classification and parent-child taxonomy traversal are essential for issue routing. | Category tree and taxonomy discovery |
| `GET /api/v1/departments` | Department lookup and departmental responsibility mapping are required. | Department discovery |
| `POST /api/v1/issues/:id/comments` | The issue lifecycle requires structured citizen and officer comments. | Issue comments |
| `GET /api/v1/issues/:id/comments` | Reading issue comments and transparency history is necessary. | Comment retrieval |
| `POST /api/v1/issues/:id/photos` | Photo upload should be an explicit endpoint, not just a request body example. | Media upload |
| `POST /api/v1/issues/:id/verify` | Citizen or officer verification of issue validity and inspection evidence. | Verification workflow |
| `POST /api/v1/issues/:id/reopen` | Reopening an issue after closure or escalation should be formalized. | Issue status lifecycle |
| `POST /api/v1/issues/:id/close` | Final closure and resolution evidence should be a formal API. | Closure workflow |
| `GET /api/v1/inspections` | Inspection records and evidence are essential for operational accountability. | Inspection workflow |
| `POST /api/v1/inspections` | Inspection creation and completion evidence must be formal. | Inspection workflow |
| `GET /api/v1/assets` | Asset registry discovery and visual oversight need an API. | Asset registry |
| `POST /api/v1/assets` | Asset creation for public assets such as drains, lights, parks, and water systems. | Asset registry |
| `GET /api/v1/volunteers` | A volunteer directory and verification dashboard is needed. | Volunteer management |
| `POST /api/v1/volunteers` | Onboarding and role assignment for volunteers. | Volunteer management |
| `GET /api/v1/community-groups` | Local mobilisation and campaign grouping needs a list endpoint. | Community groups |
| `POST /api/v1/community-groups` | Community group creation and update. | Community groups |
| `GET /api/v1/reports/export` | Public and administrative reporting needs an export workflow. | Reporting service |
| `POST /api/v1/reports/schedule` | Scheduled or recurring report generation. | Reporting service |
| `GET /api/v1/audit-logs` | Audit and compliance records are required for system governance. | Governance |
| `GET /api/v1/ai/review-queue` | Human-in-the-loop review queue for AI classifications. | AI governance |
| `POST /api/v1/ai/review/:id/override` | Manual correction of AI classification, route, or severity. | AI governance |
| `GET /api/v1/health` | A public liveness/health endpoint is required as an architecture base. This endpoint was omitted in the API design and is accepted as a foundational requirement in the current generated service. |

---

## 5. Missing Database Collections

The MongoDB schema is detailed but has some gaps that the PRD would likely require around civic action, field evidence, and operational governance.

| Missing Collection | Why It Is Required | Relationship Need |
|---|---|---|
| `asset_registry` | StreetSetu should manage public assets such as drains, lamps, bins, parks, road segments, and water systems. | Linked to ward, neighbourhood, issue, work_orders, and department. |
| `asset_maintenance_history` | History of asset repairs, service events, and maintenance records. | Linked to asset_registry and work_orders. |
| `inspections` | Evidence-based validation of issue presence, severity, and closure status. | Linked to issues, users, work_orders, and photos. |
| `inspection_templates` | Standard inspection and survey templates for recurring civic issue domains. | Linked to departments and categories. |
| `service_levels` | Department SLA and service target records. | Linked to departments, ward, categories, and issues. |
| `service_capacity` | Department workload and staff capacity by ward or category. | Linked to departments and wards. |
| `campaigns` | Civic participation events and neighbourhood action campaigns. | Linked to users, community_groups, ward, and issues. |
| `campaign_participants` | People joining campaigns, events, and local action programs. | Linked to campaigns and users. |
| `feedback_surveys` | Citizen satisfaction and public trust reporting after issue closure. | Linked to issues and users. |
| `public_reports` | A separate public report or transparency publication model. | Linked to reports, ward, department, and issue categories. |
| `complaint_escalations` | Formal escalation or redress workflow for unresolved or sensitive complaints. | Linked to issues, users, departments, and ward. |
| `system_settings` | Configuration of global governance, public visibility, category, activity, AI thresholds, and SLA parameters. | Cross-service configuration. |
| `api_clients` | OAuth client and third-party API consumer registry for integrations. | Linked to permissions and system_admin users. |
| `message_templates` | The notification model needs reusable templates and language control. | Linked to notification type and department. |
| `geo_routes` | Smart routing of field resources and volunteer action areas. | Linked to wards, neighbourhoods, streets, and issue clusters. |

---

## 6. Missing AI Workflows

The existing design only mentions classification, duplicate detection, priority scoring, and summarization. A StreetSetu-grade PRD needs a more complete AI workflow stack.

| Missing AI Workflow | Why It Is Important |
|---|---|
| Image-based issue classification | Photos should help infer damage category, drainage type, garbage type, public safety hazard, and issue intensity. |
| OCR and document extraction | Uploads may include official photos, field observation sheets, or reference documents. |
| Issue duplicate clustering by similarity and location | Duplicate issues need semantic and geospatial clustering, not only string matching. |
| Department routing recommendation with confidence | Routing should be explained and reviewable by department owners. |
| AI review queue and human override workflow | High-risk recommendations must be approved by a human before action. |
| AI-assisted work-order drafting | Generate action plan, work checklist, and required department tasks. |
| AI severity and SLA estimation | Severity scoring should feed into SLA timeline and escalation. |
| Public sentiment and satisfaction analysis | AI should summarize citizen feedback and service sentiment over time. |
| Drift detection and model feedback loop | Retraining or model version review should be managed. |
| Risk flagging and safety issue detection | Public safety and infrastructure risks should be extracted from text and images. |
| Automated summarization of issue history and ward performance | AI summaries should support executive dashboards and democratic reporting. |

---

## 7. Missing User Roles

The current API and schema design cover most traditional roles, but it is missing some civic-domain role definitions that StreetSetu needs for public participation and governance.

| Missing User Role | Why It Is Needed |
|---|---|
| `citizen_analyst` or `data_analyst` | Reporting and dashboard analytics should not be limited to admin-only views. |
| `ward_councillor` or `ward_elected_rep` | Public political accountability and ward visibility require a role that can view and monitor ward claims. |
| `municipal_engineer` | Engineering departments may require specialist technical oversight beyond generic department owner. |
| `public_health_officer` | Public health or sanitation issues need a role-specific lens. |
| `field_agent` | Field verification, inspection, and evidence collection need a distinct role. |
| `community_mobilizer` | Local campaign and citizen behavioural management need a community role. |
| `data_quality_manager` | Master-data and taxonomy validation require a support role. |
| `public_comms_officer` | Public reporting and issue transparency communication should be a role. |
| `contractor` or `vendor` | External execution partners need controlled access to work orders and work evidence. |
| `system_observer` | Read-only system monitoring and audit visibility should be separate from full admin access. |

---

## 8. Recommended Remediation Priority

### Priority 1 — Governance and Product Completeness

Add the following missing design objects early:

- Asset registry and asset lifecycle collections
- Inspection and audit collection model
- Community campaign and volunteer module structure
- Transparency / public reporting service and API boundary

### Priority 2 — Workflow Completeness

Add the following lifecycle operations:

- Issue verification
- Closure evidence
- Reopen and escalation workflows
- Report export and report scheduling
- Human-in-the-loop AI review queue

### Priority 3 — AI and Data Intelligence

Add the full AI operational workflow stack:

- OCR and image classification
- Duplicate clustering and issue matching
- Severity and SLA scoring
- Work-order generation and action checklists
- Human review and feedback loop

### Priority 4 — Role and Permission Refinement

Introduce detailed role modelling for ward elected leaders, field agents, public health specialists, data analysts, and vendor/contractor users.

---

## 9. Final Assessment

The generated architecture is a good starting point and covers the primary StreetSetu issue lifecycle pattern, but it does not yet represent the full end-to-end civic operations architecture expected by the PRD. The most significant missing areas are:

1. Asset and infrastructure management
2. Inspection, evidence, and closure verification
3. Public transparency and campaign participation modules
4. More complete AI review, explanation, and feedback governance
5. Additional civic and departmental operational roles

Those missing structures should be added before implementation moves into code generation or data model locking.
