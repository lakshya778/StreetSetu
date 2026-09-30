import 'dotenv/config';

import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import * as Sentry from '@sentry/node';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestContext } from './middleware/requestContext.js';
import { apiRateLimit } from './middleware/rateLimits.js';
import { initializeRealtime } from './services/realtimeService.js';
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development', tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.05) });
}

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT || 5000);
const allowedOrigins = [...new Set([process.env.CLIENT_ORIGIN, ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')]
  .map((origin) => origin?.trim()).filter(Boolean))];

if (process.env.NODE_ENV === 'production') {
  if (!allowedOrigins.length || allowedOrigins.includes('*')) throw new Error('A strict CLIENT_ORIGIN/CORS_ALLOWED_ORIGINS allowlist is required in production');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be configured in production');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters in production');
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) throw new Error('JWT_REFRESH_SECRET must contain at least 32 characters in production');
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('JWT access and refresh secrets must be different');
}

app.disable('x-powered-by');
const trustProxyHops = process.env.TRUST_PROXY_HOPS === undefined
  ? (process.env.NODE_ENV === 'production' ? 1 : 0)
  : Math.max(Number.parseInt(process.env.TRUST_PROXY_HOPS, 10) || 0, 0);
app.set('trust proxy', trustProxyHops);
app.use(requestContext);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'no-referrer' }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origin is not allowed'), { statusCode: 403, code: 'CORS_ORIGIN_DENIED' }));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 100 }));
app.use(cookieParser());
morgan.token('request-id', (req) => req.id);
app.use(morgan(process.env.NODE_ENV === 'production' ? ':request-id :method :url :status :response-time ms' : 'dev'));
app.use('/api/v1', apiRateLimit, apiRoutes);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'StreetSetu API is healthy', requestId: req.id }));

if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

initializeRealtime(httpServer, allowedOrigins.length ? allowedOrigins : ['http://localhost:5173']);

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streetsetu');
console.log('MongoDB connected');
httpServer.listen(PORT, () => console.log(`StreetSetu API running on port ${PORT}`));

async function shutdown(signal) {
  console.log(`${signal} received; closing StreetSetu services`);
  httpServer.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
