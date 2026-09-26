export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const badRequest = (msg, extra) => new HttpError(400, msg, extra);
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

/** Trimmed string with length bounds; returns undefined when absent and not required. */
export function str(value, name, { required = false, max = 500, min = 0 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${name} is required`);
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number') throw badRequest(`${name} must be text`);
  const s = String(value).trim();
  if (required && !s) throw badRequest(`${name} is required`);
  if (s.length > max) throw badRequest(`${name} must be at most ${max} characters`);
  if (s.length < min) throw badRequest(`${name} must be at least ${min} characters`);
  return s;
}

export function int(value, name, { required = false, min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${name} is required`);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`${name} must be a number`);
  const r = Math.round(n);
  if (r < min || r > max) throw badRequest(`${name} must be between ${min} and ${max}`);
  return r;
}

export function num(value, name, { required = false, min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${name} is required`);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${name} is out of range`);
  return n;
}

export function oneOf(value, name, options, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${name} is required`);
    return undefined;
  }
  if (!options.includes(value)) throw badRequest(`${name} must be one of: ${options.join(', ')}`);
  return value;
}

export function date(value, name, { required = false } = {}) {
  const s = str(value, name, { required, max: 40 });
  if (s === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) || Number.isNaN(Date.parse(s))) throw badRequest(`${name} must be a date (YYYY-MM-DD)`);
  return s.slice(0, 10);
}

export function url(value, name) {
  const s = str(value, name, { max: 2000 });
  if (s === undefined) return undefined;
  if (!/^https?:\/\//i.test(s) && !s.startsWith('/uploads/')) throw badRequest(`${name} must be a valid http(s) link`);
  return s;
}

/** Normalise an Indian mobile number to +91XXXXXXXXXX (accepts other E.164 numbers too). */
export function phone(value) {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  let digits = raw.replace(/^\+/, '');
  if (digits.length === 10) digits = '91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1);
  if (!/^\d{11,15}$/.test(digits)) throw badRequest('Enter a valid mobile number');
  if (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits)) throw badRequest('Enter a valid Indian mobile number');
  return '+' + digits;
}

export function paginate(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  const page = Math.max(1, Number(query.page) || 1);
  return { limit, offset: (page - 1) * limit, page };
}

export const rupees = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
