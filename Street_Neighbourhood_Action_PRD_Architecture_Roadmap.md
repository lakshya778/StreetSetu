# Street Neighbourhood Action Platform — PRD Analysis and Implementation Roadmap

## 1. Executive Summary

The Street Neighbourhood Action Platform is a civic technology product that turns local neighbourhood issues into structured citizen reports, ward-level action workflows, municipal oversight, and AI-assisted triage. The platform should connect citizens, neighbourhood volunteers, ward officers, local government administration, and data/analytics teams through a single operating model.

The product should prioritize three outcomes:

1. Capture neighbourhood-level issues in a standard, verifiable, and geo-tagged structure.
2. Convert reported issues into accountable ward and city action workflows.
3. Provide AI-enabled prioritization, dashboard intelligence, and public transparency.

This roadmap separates the system into planning, user management, issue intake, workflow management, fund/action execution, monitoring, analytics, and administrative control.

---

## 2. Product Scope and Key Stakeholder Groups

### 2.1 Primary Users

- Citizens / residents
- Ward-level volunteers and community mobilizers
- Local public works or municipal staff
- Ward officers / action coordinators
- City or district administration
- Data and GIS/analytics teams
- System administrators

### 2.2 Core Product Goals

- Create a trusted public feedback and issue resolution channel.
- Enable structured issue reporting with photos, location, categories, urgency, and civic context.
- Support action ownership and escalation across wards and departments.
- Provide transparent status updates to citizens and government teams.
- Use AI for classification, duplication detection, prioritization, and descriptive summaries.

---

## 3. Modules and Submodules

The full product can be divided into the following major modules.

### Module A — User Identity, Access, and Security

Submodules:

- User registration and profile management
- Role-based access control
- Login and authentication flows
- Organisation and ward mapping
- Admin account approval and moderation
- User audit trail and session handling

### Module B — Citizen Issue Reporting

Submodules:

- Issue create form
- Category/type selection
- Location capture using map or GPS
- Photo/video upload
- Description and metadata capture
- Priority and urgency tagging
- Anonymous or logged submission flows

### Module C — Geospatial and Location Intelligence

Submodules:

- Ward and neighbourhood boundary management
- Geo-coordinate capture
- Map visualisation of issue density
- Street and landmark reference data
- GIS polygon or neighbourhood clustering
- Location-based issue filtering

### Module D — AI Issue Triage and Classification

Submodules:

- Issue category classification
- Duplicate detection
- Severity scoring
- Priority recommendation
- Summarisation of issue content
- Municipal department routing suggestions
- Language and image-assisted issue interpretation

### Module E — Workflow and Action Management

Submodules:

- Issue lifecycle states
- Escalation rules
- Assignment to ward officers or departments
- Inspection scheduling
- Action planning and checklists
- Closure and verification workflows
- SLA tracking and escalation alerts

### Module F — Public Works and Field Operations

Submodules:

- Task creation for street cleaning, drainage, lighting, traffic, sanitation, repairs, and infrastructure
- Field worker assignment
- Work order status updates
- Asset dependency tracking
- Inspection and completion records

### Module G — Community and Volunteer Management

Submodules:

- Volunteer registration
- Volunteer issue verification support
- Community awareness campaigns
- Street action event coordination
- Local group and ward dashboards

### Module H — Dashboard, Analytics, and Reporting

Submodules:

- Executive dashboard
- Ward performance analytics
- Department-wise resolution printouts
- Issue trend and heatmaps
- Citizen satisfaction indicators
- SLA and backlog indicators

### Module I — Communication and Notification Layer

Submodules:

- User notifications
- Government and public communications
- Issue acknowledgement and status messages
- Escalation notices
- SMS, email, WhatsApp, and in-app notification integration

### Module J — Admin and Governance Controls

Submodules:

- Ward and city configuration
- User management
- Department mapping
- Metadata and master data management
- Data access policy
- Audit logging and compliance reporting

---

## 4. Suggested Product Functional Architecture

### 4.1 Tiered Architecture

- Frontend: Web portal for citizens, officers, and admin users
- Backend: REST or GraphQL APIs for issue, workflow, user, notification, and data services
- Application services: AI services, workflow engine, GIS and map APIs, notifications
- Data layer: PostgreSQL or MongoDB depending on schema and document needs
- Object storage: Photos and field evidence

### 4.2 Application Layers

1. Presentation Layer
   - Citizen portal
   - Officer / ward dashboard
   - Admin console
   - Map and issue visualisation UI

2. Business Layer
   - Issue lifecycle management
   - NLP and AI triage services
   - Action assignment and escalation rules
   - Dashboard metrics engine

3. Data Layer
   - User records
   - Issue records
   - Ward and departmental records
   - Action records
   - Notification logs
   - AI model output records

---

## 5. Module Dependencies

The modules have important dependencies.

### Dependency Map

- Identity and role management is foundational for all access-controlled workflows.
- Issue reporting depends on category taxonomy, user identity, metadata setup, location service, and file upload handling.
- AI triage depends on issue data model, category master data, full issue text, location, and image metadata.
- Issue workflow and action handling depends on issue creation, category routing, department mapping, and ward ownership records.
- GIS mapping depends on location data, ward boundary data, and issue coordinates.
- Dashboard analytics depends on workflow completion, issue state changes, and event data.
- Notification service depends on issue event and user assignment data.
- Admin governance depends on the same master configuration used in taxonomy, workflows, and user roles.

### Critical Sequence

The architecture should be implemented in the following dependency order:

1. User roles and authentication
2. Metadata and master configuration
3. Issue creation and data model
4. Issue category and location intelligence
5. Workflow and lifecycle engine
6. Public works/action management
7. AI triage and prioritization
8. Notifications and communications
9. Dashboard and reporting
10. Admin controls and audit

---

## 6. Optimal Development Order

The recommended implementation order is:

### Phase 0 — Foundation and Platform Setup

- Project scaffolding
- Backend and API base
- Authentication foundation
- User role and permission model
- DB schema foundations
- File upload and S3/object storage base

### Phase 1 — MVP Civic Reporting

- Citizens can submit and view issues
- Location or map capture
- Basic category taxonomy
- Basic dashboard for ward-level issue visibility
- Issue lifecycle states

### Phase 2 — Workflow and Operations

- Issue assignment
- Ward officer panels
- Department routing
- SLA management
- Action record and work order execution

### Phase 3 — Community and Field Coordination

- Volunteer coordination
- Field activity workflows
- Map-driven route planning
- Evidence and photo records
- Feedback and resolution confirmation

### Phase 4 — AI Intelligence Layer

- Categorisation and severity recommendations
- Duplicate detection
- Priority ranking
- Summaries and auto-generated action descriptions
- AI-assisted routing recommendations

### Phase 5 — Governance and Analytics

- Senior dashboard
- Performance analytics
- Ward comparative reporting
- Public transparency reporting
- Compliance and audit export

---

## 7. Detailed Implementation Roadmap

### Phase 0: Platform Foundation

Objectives:

- Set up project structure, architecture, repository, environments, and CI/CD.
- Establish data governance and testing standards.

Deliverables:

- Frontend web app shell
- Backend API structure
- Database schema design
- Authentication service skeleton
- Storage and file upload configuration
- Project documentation and development runbook

### Phase 1: Civic Issue Intake

Objectives:

- Enable citizen issue capture and submission with category and location metadata.

Submodules:

- User and resident profile registration
- Citizen issue submission form
- Category taxonomy
- Issue photo upload and metadata handling
- Map or grid location selection

Deliverables:

- Issue submission API
- Location capture API
- Issue listing API
- Issue detail API
- Mayor or admin issue overview page

### Phase 2: Ward and Department Workflow

Objectives:

- Create a full operational issue journey from report to closure.

Submodules:

- Issue state machine
- Issue assignment
- Department routing
- Field action planning
- Work order creation
- Closure and verification

Deliverables:

- Workflow engine
- Assignment controls
- Action and work order entities
- SLA / escalation management
- Officer dashboard

### Phase 3: Community and Local Action Engagement

Objectives:

- Bring public participation and local volunteer engagement into the process.

Submodules:

- Community volunteer profiles
- Ward-level engagement campaigns
- Volunteer verification workflow
- Community event coordination
- Local action groups

Deliverables:

- Volunteer directory and roles
- Community action events
- Volunteer issue verification APIs
- Community dashboard elements

### Phase 4: AI and Intelligence

Objectives:

- Reduce manual effort and improve prioritization and categorisation.

Submodules:

- Category inference
- Duplicate issue detection
- Priority and urgency classifier
- Issue summary generator
- Department assignment recommendation
- Action plan and resolution suggestion model

Deliverables:

- AI service adapters
- Model training and evaluation pipeline
- Explanation logs and confidence records
- Human-in-the-loop review queue

### Phase 5: Monitoring, Analytics, and Public Transparency

Objectives:

- Turn the generated data into dashboards, reports, and performance visibility.

Submodules:

- Metrics and dashboard services
- Ward performance analytics
- Heatmap and GIS dashboards
- SLA analytics
- Citizen satisfaction reports

Deliverables:

- Executive dashboard
- Department report exports
- Trend analysis and status report automation

---

## 8. Suggested API Design

The product needs a modular API layer. Suggested API groups:

### Authentication APIs

- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- POST /api/v1/auth/refresh
- GET /api/v1/auth/me

### User and Role APIs

- GET /api/v1/users
- GET /api/v1/users/:id
- POST /api/v1/users
- PUT /api/v1/users/:id
- GET /api/v1/roles
- POST /api/v1/roles

### Issue APIs

- POST /api/v1/issues
- GET /api/v1/issues
- GET /api/v1/issues/:id
- PUT /api/v1/issues/:id
- PATCH /api/v1/issues/:id/status
- GET /api/v1/issues/:id/history
- POST /api/v1/issues/:id/photos

### GIS and Location APIs

- GET /api/v1/wards
- GET /api/v1/wards/:id/issues
- GET /api/v1/geo/issues
- POST /api/v1/geo/search

### Workflow and Action APIs

- POST /api/v1/actions
- GET /api/v1/actions
- GET /api/v1/actions/:id
- PATCH /api/v1/actions/:id/status
- POST /api/v1/issues/:id/escalate
- POST /api/v1/issues/:id/assign

### AI APIs

- POST /api/v1/ai/classify
- POST /api/v1/ai/detect-duplicates
- POST /api/v1/ai/score-priority
- POST /api/v1/ai/summarize
- GET /api/v1/ai/recommendations

### Notification APIs

- GET /api/v1/notifications
- POST /api/v1/notifications/send
- PATCH /api/v1/notifications/:id/read

### Dashboard and Analytics APIs

- GET /api/v1/dashboard/summary
- GET /api/v1/dashboard/wards
- GET /api/v1/dashboard/trends
- GET /api/v1/dashboard/reports

---

## 9. Suggested database collections / documents

The exact database should be selected based on the final architecture strategy. A relational database is appropriate for role, department, issue, and workflow consistency; a document database can support volume and flexible metadata. A hybrid design is recommended.

### Core Collections / Tables

#### User and Access

- users
- roles
- permissions
- user_roles
- user_sessions
- audit_logs

#### Ward and Geography

- wards
- neighbourhoods
- streets
- landmarks
- boundary_geojson
- department_wards

#### Issue Management

- issues
- issue_categories
- issue_events
- issue_photos
- issue_comments
- issue_assignees

#### Workflow and Actions

- workflows
- workflow_states
- actions
- action_tasks
- action_audit

#### Public Works and Operations

- work_orders
- field_tasks
- service_requests
- asset_records

#### Community and Volunteer

- volunteers
- community_groups
- events
- event_registrations

#### Notifications and Communications

- notifications
- notification_templates
- sms_logs
- email_logs
- whatsapp_logs

#### AI and Analytics

- ai_labels
- ai_dedup_results
- ai_priority_scores
- ai_summaries
- dashboard_metrics
- report_jobs

---

## 10. Required User Roles

### 10.1 Citizen

- Submit an issue
- Add location and photos
- Track status
- Participate in feedback loops

### 10.2 Volunteer / Community Member

- Support issue validation
- Help gather evidence
- Facilitate local action campaigns
- Coordinate ward-level public initiatives

### 10.3 Ward Officer / Ward Coordinator

- View assigned issues
- Assign tasks
- Monitor action progress
- Escalate unresolved issues
- Prepare ward-level reports

### 10.4 Municipal Department Owner

- Receive department-routed issues
- Create and close work orders
- Provide field completion records
- Maintain service quality metrics

### 10.5 Admin / City Operations Lead

- Configure wards, roles, taxonomy, and departments
- Manage hierarchy and escalation rules
- Approve or supervise high-impact action flows
- Use executive dashboards

### 10.6 System Admin / Platform Admin

- Secure the application
- Manage users and audit permissions
- Monitor API integrations
- Maintain infrastructure and data quality

### 10.7 AI / Analytics Service

- Classify issue
- Detect duplicates
- Build prioritization and routing recommendations
- Generate summaries

---

## 11. AI Components Required

The AI layer should be designed as a human-in-the-loop decision support layer, not an autonomous control layer.

### 11.1 AI Capabilities

- Issue category detection using natural language and optional image inputs
- Duplicate issue clustering and semantic matching
- Severity/urgency scoring
- Department or ward routing recommendation
- Issue summarization for officer action queues
- Public sentiment and community signal summarization
- Trend and incident clustering analysis

### 11.2 AI Data Flow

1. A citizen submits a complaint or issue.
2. Text, category, GPS, ward, and photo metadata are passed to the AI service.
3. The AI service returns category, priority, duplicate-status, department suggestion, and summary.
4. A human officer or admin confirms or adjusts the result.
5. The issue is routed into the workflow system.

### 11.3 AI Governance Requirements

- Maintain confidence thresholds and override workflows.
- Log all AI decisions and confidence values.
- Keep a human review mechanism for high impact or public-facing classification decisions.
- Ensure transparency on AI-generated prioritization.

---

## 12. Non-Functional Requirements

The platform must support:

- Secure authentication and access control
- Mobile-friendly citizen submissions
- High availability for city operations teams
- Strong role-based permissions
- Fast GIS lookup and map rendering
- Data privacy and audit trail
- Large image/object storage
- Reporting and export support

---

## 13. Risks and Constraints

### Key Risks

- Inconsistent or incomplete issue data from citizens
- Duplicate issues across wards and departments
- Unclear ownership across municipal teams
- Inadequate ward and geographic master data
- Department capacity mismatch
- Bias or misclassification in AI categorisation

### Mitigations

- Require mandatory issue fields such as location and category
- Use duplicate detection thresholds and review bins
- Enforce issue ownership and escalation paths
- Keep data quality dashboards for ward admins
- Require review of AI recommendations before closure or escalation

---

## 14. Recommended Delivery Strategy

The product should be developed as a modular civic platform rather than a single monolithic app. Use an API-first architecture with a web frontend and dashboard surfaces that share the same issue workflow data model.

Recommended technology direction:

- Backend: Node.js with Express or a similar lightweight API framework
- Frontend: React or Next.js
- Database: PostgreSQL for structured workflow and relational records
- GIS: Mapbox, Leaflet, or OpenStreetMap-compatible services
- Object storage: S3-compatible or cloud object storage
- Notifications: SMS, email, WhatsApp, or push notification gateways
- AI engine: NLP and classification services integrated through APIs

---

## 15. Project Phases Summary

| Phase | Focus | Deliverables |
|---|---|---|
| Phase 0 | Foundation | Architecture, user model, project setup |
| Phase 1 | Issue Intake | Citizen reports, categories, location capture |
| Phase 2 | Operations | Workflow, assignments, action tasks |
| Phase 3 | Community | Volunteers and local field engagement |
| Phase 4 | AI | Classification, prioritization, summaries |
| Phase 5 | Governance | Analytics, dashboards, audits, reporting |

---

## 16. Final Architecture Recommendation

The best implementation path is to build a city operations platform around a single trusted issue lifecycle model. The issue object becomes the central entity that connects users, location, category, action, AI triage, workflow history, and departmental accountability.

The architecture should keep three design principles central:

1. Good civic data quality before advanced AI
2. Human-in-the-loop decisioning before full automation
3. A transparent issue-to-action lifecycle for public accountability

This modularisation allows the platform to start with a strong MVP while scaling into an AI-enabled smart neighbourhood action system.
