/**
 * @file api/gemini.js
 * @description Vercel Serverless proxy for Google Gemini 2.5 Flash API.
 * Keeps API keys secure on server-side environments.
 */

/**
 * Validates the incoming payload against schema limits.
 * @param {unknown} body - Incoming request body
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Malformed JSON payload' };
  }
  const payload = /** @type {Record<string, unknown>} */ (body);
  if (!payload.prompt || typeof payload.prompt !== 'string') {
    return { valid: false, error: 'Field "prompt" is required and must be a string' };
  }
  if (payload.prompt.length > 50000) {
    return { valid: false, error: 'Prompt exceeds maximum character length (50,000)' };
  }
  return { valid: true };
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
    return res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type. Expected application/json.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY environment variable is not configured on server.',
      hint: 'Provide in-memory client API key in the web interface header.'
    });
  }

  const validation = validateRequestBody(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'];
  let lastError = null;

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const geminiPayload = {
        contents: [{ role: 'user', parts: [{ text: req.body.prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
      lastError = await response.text();
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
  }

  return res.status(502).json({
    error: 'Failed to communicate with Gemini API',
    details: lastError
  });
}
