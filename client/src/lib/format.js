import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const inr = (n, { compact = false } = {}) => {
  const v = Math.round(Number(n) || 0);
  if (compact && Math.abs(v) >= 100000) return '₹' + (v / 100000).toFixed(v >= 1000000 ? 0 : 1).replace(/\.0$/, '') + 'L';
  if (compact && Math.abs(v) >= 1000) return '₹' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '₹' + v.toLocaleString('en-IN');
};

export const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');

export const fmtDate = (d, fmt = 'D MMM YYYY') => (d ? dayjs(d).format(fmt) : '');
export const fmtDay = (d) => (d ? dayjs(d).format('ddd, D MMM') : '');
export const fmtDateTime = (d) => (d ? dayjs(d).format('D MMM, h:mm A') : '');
export const timeAgo = (d) => (d ? dayjs(d).fromNow() : '');

export function fmtRange(a, b) {
  if (!a) return '';
  const s = dayjs(a);
  const e = dayjs(b || a);
  if (s.isSame(e, 'day')) return s.format('D MMM YYYY');
  if (s.isSame(e, 'month')) return `${s.format('D')}–${e.format('D MMM YYYY')}`;
  if (s.isSame(e, 'year')) return `${s.format('D MMM')} – ${e.format('D MMM YYYY')}`;
  return `${s.format('D MMM YYYY')} – ${e.format('D MMM YYYY')}`;
}

/** "14:30" → "2:30 PM" */
export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export const daysBetween = (a, b) => dayjs(b).startOf('day').diff(dayjs(a).startOf('day'), 'day');
export const tripLength = (a, b) => daysBetween(a, b) + 1;

export function tripCountdown(start, end) {
  const today = dayjs().startOf('day');
  const s = dayjs(start);
  const e = dayjs(end);
  if (today.isBefore(s)) {
    const n = s.diff(today, 'day');
    return n === 1 ? 'Tomorrow!' : `In ${n} days`;
  }
  if (!today.isAfter(e)) return `Day ${today.diff(s, 'day') + 1} of ${e.diff(s, 'day') + 1}`;
  return `Ended ${e.fromNow()}`;
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

const AVATAR_COLORS = ['#7439a8', '#dd6505', '#0f766e', '#be185d', '#1d4ed8', '#4d7c0f', '#9333ea', '#b45309', '#0e7490', '#c2410c'];
export function colorFor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const vibeLabel = (v) => (v < 25 ? 'Super chill' : v < 45 ? 'Chill' : v <= 60 ? 'Balanced' : v <= 80 ? 'Adventurous' : 'Full send');

export const BOOKING_STATUS = {
  proposed: { label: 'Awaiting your OK', tone: 'marigold' },
  requested: { label: 'Processing', tone: 'blue' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  needs_attention: { label: 'Specialist on it', tone: 'red' },
};

export const CATEGORY = {
  cab: { label: 'Cab', emoji: '🚕', color: '#dd6505' },
  food: { label: 'Food', emoji: '🍛', color: '#be185d' },
  stay: { label: 'Stay', emoji: '🏡', color: '#7439a8' },
  experience: { label: 'Experience', emoji: '🎟️', color: '#0f766e' },
};

export const ITEM_TYPES = {
  place: { label: 'Place', emoji: '📍', color: '#7439a8' },
  activity: { label: 'Activity', emoji: '🎯', color: '#0f766e' },
  food: { label: 'Food', emoji: '🍛', color: '#be185d' },
  stay: { label: 'Stay', emoji: '🏡', color: '#4b2570' },
  transport: { label: 'Transport', emoji: '🚕', color: '#dd6505' },
  note: { label: 'Note', emoji: '📝', color: '#6b6178' },
};

export const EXPENSE_CATEGORY = {
  stay: { label: 'Stay', emoji: '🏡', color: '#7439a8' },
  transport: { label: 'Transport', emoji: '🚕', color: '#dd6505' },
  food: { label: 'Food', emoji: '🍛', color: '#be185d' },
  activities: { label: 'Activities', emoji: '🎯', color: '#0f766e' },
  shopping: { label: 'Shopping', emoji: '🛍️', color: '#1d4ed8' },
  other: { label: 'Other', emoji: '💸', color: '#6b6178' },
};

export const UPI_APPS = {
  gpay: { label: 'Google Pay', color: '#1a73e8' },
  phonepe: { label: 'PhonePe', color: '#5f259f' },
  paytm: { label: 'Paytm', color: '#00baf2' },
  bhim: { label: 'BHIM', color: '#f58220' },
  other: { label: 'Other UPI', color: '#6b6178' },
};

/** Minimal, safe markdown for chat: **bold**, _italic_, bullets, line breaks. Returns React-safe segments. */
export function chatSegments(text = '') {
  return text.split('\n').map((line) => {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
    let last = 0;
    let m;
    while ((m = re.exec(line))) {
      if (m.index > last) parts.push({ t: 'text', v: line.slice(last, m.index) });
      parts.push(m[0].startsWith('**') ? { t: 'bold', v: m[0].slice(2, -2) } : { t: 'em', v: m[0].slice(1, -1) });
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push({ t: 'text', v: line.slice(last) });
    return parts;
  });
}
