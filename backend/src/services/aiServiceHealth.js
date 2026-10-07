const HEALTH_TIMEOUT_MS = 5000;

function baseUrl() {
  const value = process.env.AI_SERVICE_URL?.trim();
  if (!value) return null;
  return value.replace(/\/+$/, '');
}

export async function checkAiServiceHealth() {
  const root = baseUrl();
  if (!root) {
    console.error('[AI] health failed', { reason: 'AI_SERVICE_URL is not configured', tokenConfigured: Boolean(process.env.AI_SERVICE_TOKEN) });
    return false;
  }

  try {
    const response = await fetch(`${root}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.status !== 'ok') {
      console.error('[AI] health failed', { url: `${root}/health`, httpStatus: response.status, serviceStatus: body?.status || 'invalid response' });
      return false;
    }
    console.info('[AI] health ok', { url: `${root}/health`, tokenConfigured: Boolean(process.env.AI_SERVICE_TOKEN) });
    return true;
  } catch (error) {
    console.error('[AI] health failed', { url: `${root}/health`, reason: error.name === 'TimeoutError' ? 'request timed out' : error.message });
    return false;
  }
}
