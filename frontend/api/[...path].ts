/**
 * Vercel Serverless API Proxy for FulfillSmart
 *
 * Forwards all /api/* requests to the Render FastAPI backend service.
 * Injects FULFILLSMART_API_KEY exclusively on the server side.
 * Never exposes backend secrets in client bundles or browser JavaScript.
 */
import type { IncomingMessage, ServerResponse } from 'http';

interface VercelApiRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  body: any;
  method?: string;
  url?: string;
}

interface VercelApiResponse extends ServerResponse {
  status: (code: number) => VercelApiResponse;
  json: (data: any) => void;
  send: (data: any) => void;
}

export default async function handler(req: VercelApiRequest, res: VercelApiResponse) {
  const backendBaseUrl = process.env.BACKEND_API_URL || process.env.RENDER_BACKEND_URL;

  if (!backendBaseUrl) {
    res.status(502).json({
      status: 'error',
      code: 502,
      title: 'Bad Gateway',
      detail: 'Server configuration error: BACKEND_API_URL environment variable is not configured on Vercel.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Sanitize base URL (strip trailing slash)
  const sanitizedBase = backendBaseUrl.replace(/\/+$/, '');
  const rawUrl = req.url || '';
  const targetUrl = `${sanitizedBase}${rawUrl}`;

  // Filter and forward safe request headers
  const forwardHeaders: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (!val) continue;
    const lowerKey = key.toLowerCase();
    // Exclude connection and host headers
    if (['host', 'connection', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
      continue;
    }
    forwardHeaders[lowerKey] = Array.isArray(val) ? val.join(', ') : val;
  }

  // Inject backend master API key securely server-side
  const apiKey = process.env.FULFILLSMART_API_KEY;
  if (apiKey) {
    forwardHeaders['x-api-key'] = apiKey;
  }

  // Prepare body for non-GET/HEAD methods
  const method = (req.method || 'GET').toUpperCase();
  let body: BodyInit | undefined = undefined;

  if (!['GET', 'HEAD'].includes(method)) {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (req.body && typeof req.body === 'object') {
      body = JSON.stringify(req.body);
      if (!forwardHeaders['content-type']) {
        forwardHeaders['content-type'] = 'application/json';
      }
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for analytical/simulation runs

  try {
    const upstreamRes = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Forward status code
    res.status(upstreamRes.status);

    // Forward response headers
    upstreamRes.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
        res.setHeader(key, val);
      }
    });

    const arrayBuffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';
    const statusCode = isTimeout ? 504 : 502;
    const errorTitle = isTimeout ? 'Gateway Timeout' : 'Bad Gateway';
    const detail = isTimeout
      ? 'Upstream backend request timed out after 60 seconds.'
      : 'Unable to reach backend service.';

    res.status(statusCode).json({
      status: 'error',
      code: statusCode,
      title: errorTitle,
      detail,
      timestamp: new Date().toISOString(),
    });
  }
}
