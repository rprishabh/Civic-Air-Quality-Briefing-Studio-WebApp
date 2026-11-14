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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Gemini API error: ${response.statusText}`,
        details: errText
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown upstream error';
    return res.status(502).json({ error: 'Failed to communicate with Gemini API', message });
  }
}
