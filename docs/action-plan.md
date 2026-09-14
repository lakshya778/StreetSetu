# StreetSetu Gap Analysis Action Plan

This document summarizes the gaps identified in the generated monorepo architecture, MongoDB schema, and API design and assigns a recommended implementation order.

---

## 1. Prioritized Action Plan

### Priority 1 — High

#### 1. Asset Registry and Infrastructure Module

- Priority: High
- Why it is missing: The generated architecture and schema define issues, categories, work orders, and geography, but there is no dedicated asset inventory or municipal service infrastructure domain.
- Impact on StreetSetu: StreetSetu cannot model drains, public lights, bins, parks, water infrastructure, tree assets, or maintenance dependencies across the city. Asset-level operation and maintenance accountability will remain weak.
- Recommended fix: Add an `asset_registry` module in the monorepo, an `asset_registry` collection in MongoDB schema, and APIs for listing assets, updating asset metadata, and associating assets with wards, neighbourhoods, departments, and issues.

#### 2. Inspection, Verification, and Closure Evidence Workflow

- Priority: High
- Why it is missing: The issue lifecycle includes photo capture, but the design does not add an explicit inspection workflow for verification, evidence collection, and closure evidence.
- Impact on StreetSetu: Work completion, issue resolution quality, closure confidence, and complaint redress will not be auditable or consistent across departments.
- Recommended fix: Create an `inspection` workflow module, add an `inspections` collection, and add endpoints such as `POST /api/v1/inspections`, `GET /api/v1/inspections`, and `POST /api/v1/issues/:id/verify` and `POST /api/v1/issues/:id/close`.

#### 3. AI Governance and Human Review Layer

- Priority: High
- Why it is missing: AI classification, duplicate detection, severity, and summarization are described, but there is no human review table, model governance layer, feedback loop, explanation object, or override workflow.
- Impact on StreetSetu: Automated decisions for classification, prioritization, and routing can become opaque, inconsistent, or biased, reducing trust in civic operations.
- Recommended fix: Add an `ai_governance` module and `ai_review_queue` service with endpoints such as `GET /api/v1/ai/review-queue` and `POST /api/v1/ai/review/:id/override`; store model run outputs in `ai_runs` and route review decisions to an audit trail.

#### 4. Department Capacity and SLA Performance Management

- Priority: High
- Why it is missing: Department ownership and work order operations are modelled, but not department capacity, service levels, SLA targets, staffing, and workload management.
- Impact on StreetSetu: Departments may accept issues without a realistic capacity model, causing unbounded SLA breaches and poor operating accountability.
- Recommended fix: Add a `service_capacity` and `service_levels` collection, a `department_capacity` service module, and APIs for department performance, SLA metrics, and service-level rules.

#### 5. Data Quality and Governance Layer

- Priority: High
- Why it is missing: There is no explicit data quality layer for category consistency, civic master-data quality, ward-neighbourhood mapping quality, validation completeness, and audit reporting.
- Impact on StreetSetu: Poor master data quality will directly degrade location mapping, routing, issue categorization, and analytics integrity.
- Recommended fix: Add a `data_quality` module, `system_settings` collection, validation-report APIs, and automated schema and metadata quality checks across categories, wards, and issue records.

#### 6. Public Transparency and Grievance Publishing

- Priority: High
- Why it is missing: Public-facing issue visibility and transparent reporting are implied, but there is no `public_transparency` module or public reporting record model.
- Impact on StreetSetu: The platform may fail to build public trust and democratic visibility around issue lifecycle, ownership, and final resolution.
- Recommended fix: Add a `public_reports` collection and a `public_transparency` module; expose public-safe issue status and ward-level issue reporting APIs with appropriate privacy governance.

### Priority 2 — Medium

#### 7. Community Engagement and Campaign Workflow

- Priority: Medium
- Why it is missing: Community mobilization, campaigns, volunteer coordination, and public action events are not represented as first-class modules.
- Impact on StreetSetu: StreetSetu would become a ticketing and workflow system instead of a full neighbourhood action platform with local campaign energy and participation loops.
- Recommended fix: Add `campaigns`, `campaign_participants`, and community engagement APIs. Extend the web and mobile apps with a local campaign/listing and volunteer action dashboard.

#### 8. Integration and Notification Gateway Layer

- Priority: Medium
- Why it is missing: Notification APIs exist, but the design lacks a gateway abstraction for email, SMS, WhatsApp, and push channels and missing template coordination.
- Impact on StreetSetu: Communication will be inconsistent and difficult to operate across channels, departments, and user preferences.
- Recommended fix: Add a `message_templates` collection and a notification gateway package that supports provider routing, fallback rules, delivery state logs, and user channel preferences.

#### 9. Reporting and Export Service

- Priority: Medium
- Why it is missing: Reporting requirements exist, but the architecture lacks a structured reporting/export service and scheduled reporting model.
- Impact on StreetSetu: Executive dashboards and public transparency reporting will depend on ad hoc exports and manual data extraction.
- Recommended fix: Add `reports`, `public_reports`, and report scheduler APIs such as `GET /api/v1/reports/export` and `POST /api/v1/reports/schedule` with a reporting service and export pipeline.

#### 10. Ward Action Planning Module

- Priority: Medium
- Why it is missing: Ward-level action planning and neighbourhood annual action design are not represented in the folder structure, schemas, or API model.
- Impact on StreetSetu: City teams will not have a formal ward planning layer that connects backlog issues, budget planning, rolling action plans, and local civic priorities.
- Recommended fix: Create a `ward_action_planning` module and collection for action plans, target areas, status, owner, cost, and impact metrics.

### Priority 3 — Low

#### 11. Additional User Roles

- Priority: Low
- Why it is missing: Current user roles list typical operational roles but not specialist and governance roles such as data analyst, municipal engineer, public health officer, field agent, community mobilizer, data quality manager, public communications officer, contractor, or system observer.
- Impact on StreetSetu: Security boundaries and workflow ownership will not align with real city operations and public participation patterns.
- Recommended fix: Expand the role catalog and permission matrix in the role and permissions model, then align API permissions and UI access accordingly.

#### 12. API Surface Completeness

- Priority: Low
- Why it is missing: Some key APIs such as category tree discovery, department listing, comments creation and retrieval, photo upload, inspection APIs, asset APIs, volunteer APIs, AI review queue, and audit APIs are missing from the generated API design.
- Impact on StreetSetu: The core product will have fragmented operations and incomplete public and internal developer experience.
- Recommended fix: Extend the API design document with all missing endpoints required for issue comments, photos, verification, reopening, inspection, department lookup, volunteer and campaign APIs, asset APIs, and AI review APIs.

#### 13. Supporting Collections and Governance Records

- Priority: Low
- Why it is missing: Database collection design is missing lists for `asset_maintenance_history`, `service_levels`, `service_capacity`, `campaigns`, `campaign_participants`, `feedback_surveys`, `complaint_escalations`, `system_settings`, `api_clients`, and `geo_routes`.
- Impact on StreetSetu: The data model will fail to support reporting, operations, campaign coordination, feedback loops, API consumers, and route optimization.
- Recommended fix: Add those collections to the MongoDB schema design and cross-index them with issues, departments, assets, wards, and users.

---

## 2. Implementation Order

1. Asset Registry and Infrastructure Module
2. Inspection, Verification, and Closure Workflow
3. AI Governance and Human Review Layer
4. Department Capacity and SLA Management
5. Data Quality and Governance Layer
6. Public Transparency and Grievance Publishing
7. Community Engagement and Campaign Workflow
8. Integration and Notification Gateway Layer
9. Reporting and Export Service
10. Ward Action Planning Module
11. User Role and Permission Expansion
12. API Contract Completion
13. Supporting Collection and System Settings Model

---

## 3. Delivery Sequence

### Phase 1: Operational Foundation

- Asset registry module
- Inspection workflow
- Service capacity and SLA model
- Data quality and governance module

### Phase 2: Civic Transparency and Participation

- Public transparency and grievance publishing
- Community engagement and campaign module
- Ward action planning module

### Phase 3: Automation and Intelligence

- AI review queue
- AI override workflow
- Automated route and work-order generation support

### Phase 4: Integration and Reporting

- Notification gateway abstraction
- Reporting/export service
- Audit and compliance exports

### Phase 5: Governance and Role Maturity

- User role expansion
- API coverage completion
- Supporting collection expansion
