/** Small shared helpers. No host-specific imports. */

export class WhaleError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'WhaleError';
    this.code = code;
    this.detail = detail;
  }
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function isAbortError(error) {
  return Boolean(error) && (error.name === 'AbortError' || error.code === 'ABORT_ERR' || error.cause?.name === 'AbortError');
}

export function errorShape(error) {
  if (error instanceof WhaleError) return { code: error.code, message: error.message };
  if (isAbortError(error)) return { code: 'aborted', message: '已取消' };
  return { code: 'internal', message: error instanceof Error ? error.message : String(error) };
}

export function truncate(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export function messageText(message) {
  if (typeof message === 'string') return message;
  if (!message || typeof message !== 'object') return '';
  if (typeof message.text === 'string') return message.text;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  return '';
}

export function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

export function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new WhaleError('body-too-large', '请求体太大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
