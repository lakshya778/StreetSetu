# StreetSetu

**AI-Powered Civic Issue Reporting & Community Action**

StreetSetu is a web platform for reporting local civic issues and coordinating
community action. Citizens can submit location-aware complaints, follow their
status, and support reports from their neighbourhood. Administrators review and
assign work, while volunteers document their progress and completion evidence.
The application also provides public transparency pages, operational analytics,
and human-reviewed AI assistance.

## Problem Statement

Many civic reporting experiences lack:

- Clear escalation when service deadlines pass.
- Safeguards against complaints being marked resolved without review.
- Help categorising and prioritising incoming reports.
- Tools for neighbours to coordinate community action.
- Transparent status history and public progress information.
- Ongoing participation and recognition for community contributions.

## Key Features

### Reporting

- Submit complaints with a title, description, category, priority, location, and
  photo attachments. Location can use browser geolocation or a point selected
  on the map.
- Capture completion evidence with the live camera and include device location
  and capture-time metadata when the browser makes it available.
- Follow complaint status and receive in-app, real-time, and optionally email
  notifications.
- Report anonymously. Reporter identity is redacted in public and volunteer
  views; the reporter and administrators can see it.
- Check nearby reports for possible duplicates using category, text similarity,
  and location. Administrators can review and merge duplicate complaints.

### AI-Assisted Triage

- A separate Python service uses TF-IDF features and Logistic Regression to
  suggest a complaint category and priority from its title and description.
- Suggestions include confidence and explanatory flags and are presented for
  human review; the model does not classify images.

### Accountability and Transparency

- SLA deadlines are set by priority. High and critical complaints use the high
  SLA setting; medium and low complaints use their respective settings.
- A scheduled job escalates overdue complaints through Ward Officer, Zonal
  Officer, and Commissioner levels. Each escalation is recorded in status
  history and notifies the reporter and assignee where applicable.
- The public overdue list and an administrator-only manual escalation trigger
  are available.
- Complaint status history and administrator audit logs provide an operational
  record of changes.
- Public pages provide aggregate transparency information and no-login complaint
  status tracking.

### Assignment

- Administrators can view volunteer recommendations ranked using distance,
  active workload, resolution rate, and availability.
- Administrators can auto-assign the highest-ranked available recommendation or
  enter a volunteer ID for manual assignment or reassignment.
- Volunteers can accept or decline assignments and update assigned work.

### Completion Evidence

- Volunteers add before-work images and submit completion proof through the live
  camera workflow.
- Available GPS and timestamp metadata are checked, but missing metadata may
  leave a check inconclusive.
- Visual before/after similarity is disabled. Completion evidence enters
  `needs_review` for administrator review before resolution.
- An administrator can approve or reject the evidence. Rejection returns the
  complaint to `in_progress` and retains the rejected proof in evidence history.

### Community

- Authenticated users can create, join, and leave volunteer/community drives.
- Users can vote to support complaints.

### Gamification

- Point events award 5 points for a report, 10 for an approved resolution, 15
  for joining a drive, 25 for organizing a drive, 2 for each support vote
  received, and 20 for a successful referral.
- Badges are awarded for a first report, three resolved complaints, joining a
  drive, organizing a drive, and reaching 100 or 500 total points.
- The leaderboard supports monthly, all-time, and location-scoped rankings.
- The My Impact view shows personal points, ranks, reports, resolved complaints,
  drive participation, badges, a referral code, and a weekly reporting streak.
  The people-impacted figure is an estimate of 25 people per resolved complaint.
- A scheduled monthly close recognizes the top three point earners with badges,
  in-app notifications, and downloadable PDF certificates. Weekly streak
  reminders are in-app notifications.

### Education and Inclusion

- The searchable waste segregation guide groups examples into five waste
  categories.
- The recycling-centre map uses sample Delhi/NCR markers in the repository; the
  locations and accepted materials should be verified before real-world use.
- The web interface supports English and Hindi and saves the selected language
  in browser storage.
- The installable PWA caches the app shell and short-lived, read-only responses
  for offline viewing. Offline complaint submission and synchronization are not
  available.

## Tech Stack

| Area | Implementation |
|---|---|
| Frontend | React, Vite, React Router, Axios |
| Mobile | No mobile application is present in this repository |
| Backend | Node.js 22, Express, Mongoose |
| Database | MongoDB |
| Authentication | JWT access and refresh tokens, bcryptjs password hashing |
| Maps | Leaflet, React Leaflet, OpenStreetMap |
| AI service | Python, Flask, scikit-learn, TF-IDF, Logistic Regression, joblib |
| Media storage | Cloudinary |
| Notifications | MongoDB-backed in-app notifications, Socket.IO, optional SMTP email |
| Scheduling | node-cron |
| Internationalization | i18next and react-i18next; English and Hindi |
| Deployment and CI | Vercel, Render, Docker Compose, GitHub Actions |

## Architecture

The React web client calls the versioned Express API. The API enforces
authentication and authorization, stores application records in MongoDB, sends
images to Cloudinary, and calls the Python service for text classification and
completion metadata checks. Socket.IO provides real-time updates. SLA and
gamification cron jobs run in the API process.

```text
Citizens / Volunteers / Administrators
                  |
                  v
          React + Vite web app
             |          ^
      REST   |          | Socket.IO
             v          |
          Express API --+
          /     |       \
         v      v        v
    MongoDB  Cloudinary  Python Flask AI service
         ^
         |
  API-process cron jobs
  (SLA escalation and gamification)
```

## Project Structure

```text
StreetSetu/
├── backend/
│   ├── scripts/       # Demo seed, migration, and gamification backfill
│   └── src/
│       ├── config/    # Database and token configuration
│       ├── controllers/
│       ├── middleware/
│       ├── models/    # Mongoose data models
│       ├── routes/    # Express API route modules
│       ├── services/  # Workflow, integrations, analytics, and jobs
│       └── validators/
├── frontend/
│   ├── public/        # PWA manifest, service worker, static assets
│   └── src/
│       ├── api/       # API clients
│       ├── components/
│       ├── data/      # Guide, tips, and sample recycling-centre data
│       ├── i18n/      # English and Hindi translations
│       └── pages/
├── ai-service/
│   ├── tests/
│   ├── utils/
│   ├── dataset.csv
│   ├── model.pkl
│   └── vectorizer.pkl
├── docs/              # API, architecture, schema, and release notes
├── docker-compose.yml
├── docker-compose.production.yml
└── render.yaml
```

There is no `mobile/` application or mobile package in the current repository.

## Getting Started

### Prerequisites

- Node.js 22 and npm.
- MongoDB locally or a reachable MongoDB deployment.
- Python 3.10 or newer and pip to run the AI service or its tests.
- Cloudinary credentials to enable image uploads.
- SMTP credentials only if outbound email notifications are required.

### Clone and Install

```bash
git clone https://github.com/lakshya778/StreetSetu.git
cd StreetSetu
npm ci --prefix backend
npm ci --prefix frontend
```

### Configure the Environment

Copy the example files and edit the local copies. Do not commit `.env` files.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

| File | Variable names | Purpose |
|---|---|---|
| `backend/.env` | `PORT` | API listener port. |
| `backend/.env` | `MONGO_URI` | MongoDB connection string. |
| `backend/.env` | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Access and refresh token secrets and lifetimes. |
| `backend/.env` | `CLIENT_ORIGIN`, `CORS_ALLOWED_ORIGINS`, `TRUST_PROXY_HOPS` | Browser origin allowlist and reverse-proxy configuration. |
| `backend/.env` | `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX` | General API rate limit window and maximum requests. |
| `backend/.env` | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | Optional API error monitoring and trace sampling. |
| `backend/.env` | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_FOLDER` | Cloudinary image storage credentials and destination folder. |
| `backend/.env` | `UPLOAD_MAX_FILE_SIZE_BYTES`, `UPLOAD_MAX_FILES` | Upload size and count limits. |
| `backend/.env` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional outbound email configuration. |
| `backend/.env` | `PUBLIC_APP_URL` | Public frontend base URL used in notification links. |
| `backend/.env` | `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `AI_SERVICE_TIMEOUT_MS`, `AI_METADATA_TIMEOUT_MS`, `AI_VERIFICATION_TIMEOUT_MS` | AI service address, optional shared token, and request timeouts. |
| `backend/.env` | `SLA_HIGH_MINUTES`, `SLA_MEDIUM_MINUTES`, `SLA_LOW_MINUTES`, `ESCALATION_CRON` | Complaint SLA durations and automatic escalation schedule. |
| `backend/.env` | `MONTHLY_CLOSE_CRON`, `STREAK_REMINDER_CRON` | Monthly recognition and weekly streak-reminder schedules. |
| `backend/.env` | `GAMIFICATION_CERTIFICATE_DIR`, `GAMIFICATION_CERTIFICATE_FONT_PATH` | Certificate output folder and optional font path. |
| `backend/.env` | `DEMO_SEED_PASSWORD` | Optional password for locally seeded demo accounts. |
| `frontend/.env` | `VITE_API_URL`, `VITE_SOCKET_URL` | Versioned API base URL and Socket.IO server origin. Vite variables are public and must not contain secrets. |
| AI service process | `AI_SERVICE_TOKEN`, `PORT` | Optional request authentication shared with the backend and service listener port. The AI service defaults to port 5000. There is no AI-service `.env.example`. |

Use independent, strong JWT secrets outside local development. Set the same
`AI_SERVICE_TOKEN` for the backend and AI service when token authentication is
enabled. The backend example targets port 8000 for the AI service; set the AI
service `PORT` to 8000 when running it alongside the API locally.

### Run the Services

Start MongoDB first. In separate terminals, start the API and web app:

```bash
npm run dev
```

```bash
npm run frontend
```

The API listens on port 5000 by default, and Vite prints the web URL when it
starts. The API has health routes at `/api/health` and `/api/v1/health`.

To run the optional AI service in a separate terminal from the repository root:

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:PORT = "8000"
python app.py
```

The service loads the checked-in `model.pkl` and `vectorizer.pkl`. Its starter
training data is `dataset.csv`; run `python train_model.py` from `ai-service` to
retrain and replace the local model artifacts.

There is no mobile application to install or run.

### Seed Demo Data

Configure `backend/.env` and make sure MongoDB is available. Then run:

```powershell
cd backend
npm run seed
```

The seed is repeatable and manages one admin account, two citizen accounts, ten
complaints, and two drives. It does not seed a volunteer account; create one
through the registration flow by selecting the volunteer role. The script
prints the demo account credentials when it finishes; use those locally and do
not publish them.

To remove and recreate only the seed-managed accounts, demo-prefixed complaints,
and demo-prefixed drives:

```powershell
npm run seed -- --reset
```

The reset does not clear the entire database.

### Tests and Build

```bash
npm test
npm run build
```

`npm test` runs the backend Node.js test suite. To run the AI service unit tests,
from the `ai-service` directory:

```bash
python -m unittest discover -s tests
```

The frontend package currently defines a production build script but no
frontend test script.

## Roles and Demo Guide

The implemented account roles are `citizen`, `volunteer`, and `admin`.
Registration permits citizen and volunteer accounts; admin accounts are
provisioned rather than self-registered. The seed creates an admin and two
citizens, but no volunteer.

1. Configure the local services, seed the demo data, then register a volunteer
   account and sign in with the seeded citizen account.
2. Submit a complaint with a location and image. Request the AI triage suggestion
   from the complaint workflow and review its suggested category and priority.
3. Sign in as the admin. Review the complaint, inspect volunteer recommendations,
   then use auto-assign or enter a volunteer ID to assign manually.
4. For a quick local escalation demo, temporarily set
   `SLA_HIGH_MINUTES`, `SLA_MEDIUM_MINUTES`, and `SLA_LOW_MINUTES` to `1`, and set
   `ESCALATION_CRON` to `* * * * *`. Restart the API and create a new complaint.
   After its deadline, wait for the next cron run or call
   `POST /api/v1/admin/escalation/run` with an admin access token.
5. Sign in as the assigned volunteer, accept the assignment, add before-work
   evidence, move the work to in-progress, and submit completion proof through
   live capture.
6. The complaint enters `needs_review`. Sign in as admin and approve or reject
   the evidence in the completion review queue. Approval resolves the complaint;
   rejection returns it to `in_progress` and preserves the rejected evidence in
   history.
7. View awarded points and the leaderboard. Report submission awards 5 points;
   an approved resolution awards 10 points to the reporter. These awards are
   also reflected on the My Impact view.

After the demo, restore the normal SLA values appropriate for your environment.
The seed script prints credentials for its demo accounts; this README does not
include passwords.

## API Overview

Application routes are mounted under `/api/v1`. Access-controlled routes require
an access token and enforce role or ownership checks. The separate
`GET /api/health` route is outside the versioned API prefix.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health`, `/api/v1/health` | API health checks |
| `POST` | `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout` | Registration and session lifecycle |
| `GET`, `POST` | `/api/v1/complaints` | List and create complaints |
| `GET` | `/api/v1/complaints/:id`, `/api/v1/complaints/map`, `/api/v1/complaints/nearby` | Complaint details and map/discovery data |
| `POST` | `/api/v1/complaints/duplicates/check` | Find likely nearby duplicate reports |
| `GET` | `/api/v1/complaints/overdue` | Public overdue complaint list |
| `POST`, `DELETE` | `/api/v1/complaints/:id/vote` | Add or remove complaint support |
| `POST` | `/api/v1/ai/complaints/:id/classify` | Request AI category and priority suggestions |
| `GET` | `/api/v1/assignments/recommend/:complaintId` | Get top volunteer recommendations |
| `GET` | `/api/v1/assignments/:complaintId/recommendations` | Get volunteer recommendations |
| `POST` | `/api/v1/assignments/:complaintId/assign` | Assign a volunteer |
| `PUT` | `/api/v1/assignments/:complaintId/reassign` | Reassign a volunteer |
| `GET` | `/api/v1/assignments/my-assignments` | List the signed-in volunteer's assignments |
| `PATCH` | `/api/v1/assignments/:complaintId/response`, `/api/v1/assignments/:complaintId/status` | Accept/decline an assignment or update work status |
| `GET` | `/api/v1/assignments/completion-verifications`, `/api/v1/assignments/completion-verifications/:complaintId` | Load the completion-review queue or evidence details |
| `PATCH` | `/api/v1/assignments/completion-verifications/:complaintId` | Approve or reject completion evidence |
| `GET` | `/api/v1/drives`, `/api/v1/drives/:id` | Browse drives and view drive details |
| `POST` | `/api/v1/drives`, `/api/v1/drives/:id/join`, `/api/v1/drives/:id/leave` | Create a drive or join/leave it |
| `GET` | `/api/v1/leaderboard`, `/api/v1/gamification/top3`, `/api/v1/users/me/stats` | Community rankings, monthly winners, and personal impact |
| `GET` | `/api/v1/public/transparency`, `/api/v1/public/complaints/:complaintId` | Public transparency summary and complaint tracking |
| `GET` | `/api/v1/analytics/hotspots`, `/api/v1/analytics/heatmap` | Admin-only grid-based geographic analytics |
| `POST` | `/api/v1/admin/escalation/run` | Admin-triggered SLA escalation run |
| `GET`, `PATCH` | `/api/v1/notifications`, `/api/v1/notifications/:id/read` | List and mark in-app notifications |
| `POST` | `/api/v1/uploads/images`, `/api/v1/uploads/complaints/:complaintId/before-images`, `/api/v1/uploads/complaints/:complaintId/after-images` | Upload complaint and work evidence images |

The AI service separately exposes `GET /health`, `POST /v1/classify`,
`POST /v1/image-metadata`, and `POST /v1/verify-completion` for service
integration. The latter endpoints are not Express API routes. See
[`docs/api-design.md`](docs/api-design.md) for additional API details.

## Deployment

The repository includes a Vercel configuration for the Vite frontend and a
Render blueprint for the Express API and Python AI service.

| Service | Deployment |
|---|---|
| Frontend | Deploy `frontend/` to Vercel. Set `VITE_API_URL` to `<your-api-url>/api/v1` and `VITE_SOCKET_URL` to the API origin. |
| Backend | Deploy `backend/` to Render and configure MongoDB, JWT, allowed frontend origin, and any enabled integrations. The configured Render health check is `/api/health`. |
| AI service | Deploy `ai-service/` to Render. Configure `AI_SERVICE_TOKEN` consistently with the backend. The configured health check is `/health`. |

Live URLs:

- Frontend: `<your-frontend-url>`
- API: `<your-api-url>`

Render's free tier sleeps when idle. A keep-alive ping to
`<your-api-url>/api/v1/health` can help reduce idle periods, but does not
guarantee continuous availability or change the free-tier sleep policy.

## Privacy and Security

- Passwords are hashed with bcryptjs. API access and refresh tokens use JWT;
  refresh sessions are stored as hashes.
- Role-based authorization and complaint ownership checks protect restricted
  operations.
- Anonymous reporter identity is redacted from public and volunteer views.
- The API applies request validation, rate limits, security headers, and an
  origin allowlist. Production requires separately configured JWT secrets and
  explicit browser origins.
- Keep `.env` files, service credentials, and deployment secrets out of Git.
  Frontend `VITE_` variables are public build-time values, not a place for
  secrets.

## AI & Verification

AI-assisted triage currently uses a lightweight TF-IDF/Logistic Regression text model to suggest complaint category and priority from the title and description; it does not perform YOLOv8 image classification. Suggestions are shown in the UI for human review. Completion evidence uses live-capture and available location/timestamp metadata checks. Visual before/after similarity is not enabled, so all completion evidence is routed to admin review (needs_review) before a complaint is marked resolved.

## Known Limitations & Roadmap

The following are planned and are not implemented as described:

- YOLOv8 image classification for complaint photos.
- Perceptual-hash or CNN-based before/after similarity checking and automatic
  completion approval.
- DBSCAN-based predictive hotspot mapping. The current heatmap and hotspot
  analytics group complaint coordinates into rounded geographic grid cells; they
  are not predictive clustering.
- Full offline reporting and write synchronization. The web app has an installable
  PWA shell and short-lived, read-only cached responses, but cannot submit
  reports offline.
- FCM push notifications. Current notifications are in-app, Socket.IO, and
  optional SMTP email.
- A dedicated mobile application.
- Department and ward directories with department-level issue routing.
- Asset registry, service-capacity, work-order, and dedicated inspection
  management.
- Community group management and broader ward action-planning workflows beyond
  the existing volunteer drives.
- Structured issue comments and formal reopen workflows.
- Additional notification channels such as SMS and WhatsApp.

## Contributing

Contributions should preserve the existing separation between frontend,
backend, and AI service. Please include focused tests for behavior changes,
update relevant documentation, and avoid committing secrets or generated
credentials.

## Author

- Name: `<Your name>`
- Contact or profile: `<Your contact or profile>`

## Manual Verification Notes

- Recycling-centre records are sample data. Confirm their real locations and
  accepted materials before relying on them.
- Configure and verify the actual MongoDB, Cloudinary, SMTP, Render, and Vercel
  settings for your deployment; this README contains no live credentials or
  deployed URLs.
- Completion metadata depends on browser permission and available device
  metadata. Missing GPS or timestamps can produce inconclusive checks and still
  require administrator review.
- Register a volunteer account separately for the end-to-end demo; the seed
  creates only admin and citizen users.
