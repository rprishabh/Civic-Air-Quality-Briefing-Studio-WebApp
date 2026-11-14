/**
 * @file api/gemini.js
 * @description Vercel Serverless proxy for Google Gemini API with timeout & payload hardening.
 */

const MAX_PAYLOAD_BYTES = 20480; // 20 KB limit

/**
 * Validates and sanitizes the incoming request body.
 * @param {unknown} body - Incoming request body
 * @returns {{ valid: boolean, error?: string, sanitizedPrompt?: string }}
 */
function validateAndSanitize(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Malformed JSON payload' };
  }
  const payload = /** @type {Record<string, unknown>} */ (body);
  if (!payload.prompt || typeof payload.prompt !== 'string') {
    return { valid: false, error: 'Field "prompt" is required and must be a string' };
  }
  if (payload.prompt.length > 15000) {
    return { valid: false, error: 'Prompt exceeds maximum character length (15,000)' };
  }
  // Strip null bytes and non-printable control characters
  const clean = payload.prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return { valid: true, sanitizedPrompt: clean };
}

/**
 * Handles incoming HTTP requests for Vercel Serverless Function.
 * @param {import('http').IncomingMessage & { query: Record<string, string>, body?: any }} req
 * @param {import('http').ServerResponse & { status: (code: number) => any, json: (data: any) => any }} res
 */
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      proxyReady: Boolean(process.env.GEMINI_API_KEY)
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed. Enforce POST for synthesis.' });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type. Expected application/json.' });
  }

  const rawSize = JSON.stringify(req.body || {}).length;
  if (rawSize > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({ error: 'Payload Too Large. Max 20 KB allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY environment variable is not configured on server.',
      hint: 'Provide in-memory client API key in the web interface header.'
    });
  }

  const validation = validateAndSanitize(req.body);
  if (!validation.valid || !validation.sanitizedPrompt) {
    return res.status(400).json({ error: validation.error || 'Invalid input' });
  }

  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'];
  let lastError = null;

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const geminiPayload = {
      contents: [{ role: 'user', parts: [{ text: validation.sanitizedPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 3500,
        responseMimeType: 'application/json'
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
      lastError = `Upstream error: HTTP ${response.status}`;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err.message : 'Upstream network timeout';
    }
  }

  return res.status(502).json({
    error: 'Failed to communicate with Gemini API',
    details: lastError
  });
}
