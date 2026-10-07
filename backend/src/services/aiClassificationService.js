import AIClassificationRun from '../models/AIClassificationRun.js';
import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES } from '../models/Complaint.js';

export class AIClassificationError extends Error {
  constructor(message, statusCode = 503, code = 'AI_SERVICE_UNAVAILABLE') {
    super(message);
    this.name = 'AIClassificationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function aiServiceConfig() {
  if (!process.env.AI_SERVICE_URL) {
    throw new AIClassificationError('AI classification service is not configured');
  }
  return {
    url: `${process.env.AI_SERVICE_URL.replace(/\/$/, '')}/v1/classify`,
    timeoutMs: Number.parseInt(process.env.AI_SERVICE_TIMEOUT_MS, 10) || 5000
  };
}

function validatePrediction(payload) {
  const details = [];
  if (!COMPLAINT_CATEGORIES.includes(payload?.category)) {
    details.push({ field: 'category', message: 'AI returned an unsupported complaint category' });
  }
  if (!COMPLAINT_PRIORITIES.includes(payload?.priority)) {
    details.push({ field: 'priority', message: 'AI returned an unsupported priority' });
  }
  if (typeof payload?.isToxic !== 'boolean') {
    details.push({ field: 'isToxic', message: 'AI must return a boolean toxicity prediction' });
  }
  if (typeof payload?.isSpam !== 'boolean') {
    details.push({ field: 'isSpam', message: 'AI must return a boolean spam prediction' });
  }
  if (!Number.isFinite(payload?.confidence) || payload.confidence < 0 || payload.confidence > 1) {
    details.push({ field: 'confidence', message: 'AI confidence must be between 0 and 1' });
  }
  if (payload?.reasons !== undefined && (!Array.isArray(payload.reasons)
    || payload.reasons.some((reason) => typeof reason !== 'string'))) {
    details.push({ field: 'reasons', message: 'AI reasons must be an array of strings' });
  }
  if (details.length > 0) {
    const error = new AIClassificationError('AI returned an invalid classification response', 502, 'AI_INVALID_RESPONSE');
    error.details = details;
    throw error;
  }
  return {
    category: payload.category,
    priority: payload.priority,
    isToxic: payload.isToxic,
    isSpam: payload.isSpam,
    confidence: payload.confidence,
    reasons: payload.reasons || []
  };
}

export async function classifyComplaint(complaint, requestedBy) {
  let config;
  try {
    config = aiServiceConfig();
  } catch (error) {
    console.error('[AI] classify failed', { reason: error.message, tokenConfigured: Boolean(process.env.AI_SERVICE_TOKEN) });
    throw error;
  }
  console.info('[AI] classify request', { url: config.url, complaintId: String(complaint._id), tokenConfigured: Boolean(process.env.AI_SERVICE_TOKEN) });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  let response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` } : {})
      },
      body: JSON.stringify({
        complaintId: String(complaint._id),
        title: complaint.title,
        description: complaint.description,
        location: complaint.location,
        categoryOptions: COMPLAINT_CATEGORIES,
        priorityOptions: COMPLAINT_PRIORITIES
      }),
      signal: controller.signal
    });
  } catch (error) {
    const code = error.name === 'AbortError' ? 'AI_SERVICE_TIMEOUT' : 'AI_SERVICE_UNAVAILABLE';
    console.error('[AI] classify failed', { url: config.url, code, reason: error.message });
    throw new AIClassificationError('Unable to reach AI classification service', 503, code);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error('[AI] classify response', { url: config.url, httpStatus: response.status, ok: false });
    throw new AIClassificationError(`AI classification service returned HTTP ${response.status}`, 502, 'AI_SERVICE_ERROR');
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    console.error('[AI] classify failed', { url: config.url, reason: 'invalid JSON response' });
    throw new AIClassificationError('AI classification service returned invalid JSON', 502, 'AI_INVALID_RESPONSE');
  }

  let classification;
  try {
    classification = validatePrediction(body.data || body);
  } catch (error) {
    console.error('[AI] classify failed', { url: config.url, reason: error.message, code: error.code || 'AI_INVALID_RESPONSE' });
    throw error;
  }
  console.info('[AI] classify response', {
    url: config.url,
    httpStatus: response.status,
    ok: true,
    category: classification.category,
    priority: classification.priority,
    confidence: classification.confidence
  });
  const run = await AIClassificationRun.create({
    complaint: complaint._id,
    requestedBy,
    provider: 'streetsetu-ai-service',
    model: body.model,
    classification
  });

  return { runId: run._id, ...classification };
}
