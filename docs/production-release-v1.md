# StreetSetu Production Release v1

## Runtime and security

The API runs as an HTTP server with authenticated Socket.IO. Access JWTs retain the existing response field; rotating refresh JWTs are hashed in MongoDB and carried in an HttpOnly cookie. Configure independent, random 32+ character `JWT_SECRET` and `JWT_REFRESH_SECRET` values. `CLIENT_ORIGIN` is required in production; `CORS_ALLOWED_ORIGINS` can list additional comma-separated trusted origins. `TRUST_PROXY_HOPS` defaults to one in production. General API limits default to 300 requests per IP per 15 minutes, with authentication limited to 15 per IP per 15 minutes.

Helmet, request IDs, structured request log fields, body limits, allowlisted CORS, and JWT algorithm pinning are enabled. Set `SENTRY_DSN` on backend and `VITE_SENTRY_DSN` at frontend build time to enable error monitoring. The API health check is `GET /api/health`.

The initial rate limiter and Socket.IO adapter are process-local. Production deployment starts with one Render API instance. Before scaling horizontally, add a shared rate-limit store and Socket.IO Redis adapter, and enable sticky sessions if Socket.IO polling transport is used.

## Deploy to MongoDB Atlas, Render, and Vercel

1. Create a MongoDB Atlas cluster and a least-privilege database user. Configure network access and save the TLS connection string as Render `MONGO_URI`.
2. Create the Render web service from `render.yaml`. Add the Vercel production URL to `CLIENT_ORIGIN` and `CORS_ALLOWED_ORIGINS`; configure JWT secrets and optional Cloudinary/Sentry values.
3. For refresh cookies across Vercel and Render, use custom hostnames under the same registrable domain (for example, `app.example.com` and `api.example.com`). Browser third-party cookie restrictions can block unrelated Vercel/Render hostnames.
4. Import `frontend/` into Vercel. Set `VITE_API_URL=https://api.example.com/api/v1`, `VITE_SOCKET_URL=https://api.example.com`, and optionally `VITE_SENTRY_DSN`.
5. Set these GitHub repository secrets to turn on the main-branch deploy job: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `RENDER_DEPLOY_HOOK`. CI always runs tests/build; deploy steps skip when secrets are absent.

## Docker

`docker-compose.production.yml` runs the production API and static frontend containers. Supply `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_ORIGIN`, `VITE_API_URL`, and `VITE_SOCKET_URL` via the environment; do not commit production `.env` files. The existing `docker-compose.yml` remains the local auxiliary-services compose file.

## CI/CD

`.github/workflows/ci.yml` installs locked Node 22 dependencies, runs backend tests and builds the Vite application for pull requests and pushes. A successful `main` push can deploy Vercel and trigger the Render deploy hook when the corresponding GitHub secrets are set.
