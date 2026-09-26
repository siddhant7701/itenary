import { useCallback, useLayoutEffect, useRef } from 'react';

// Shared bits for the community, marketplace, events and creator pages.

export const FALLBACK_TAGS = ['Budget', 'Solo Female', 'Foodie', 'Adventure', 'Chill', 'Couple', 'Family', 'Backpacking', 'Luxury', 'Spiritual', 'Offbeat', 'Weekend', 'Trek', 'Beach', 'Heritage', 'Monsoon'];

export const TAG_EMOJI = {
  Budget: '💸',
  'Solo Female': '👩',
  Foodie: '🍛',
  Adventure: '🧗',
  Chill: '🌿',
  Couple: '💑',
  Family: '👨‍👩‍👧',
  Backpacking: '🎒',
  Luxury: '✨',
  Spiritual: '🕉️',
  Offbeat: '🧭',
  Weekend: '🗓️',
  Trek: '🥾',
  Beach: '🏖️',
  Heritage: '🏛️',
  Monsoon: '🌧️',
};

export const EVENT_CATEGORY = {
  festival: { label: 'Festival', plural: 'Festivals', emoji: '🎉' },
  activity: { label: 'Activity', plural: 'Activities', emoji: '🎯' },
  food: { label: 'Food', plural: 'Food', emoji: '🍛' },
  culture: { label: 'Culture', plural: 'Culture', emoji: '🏛️' },
  adventure: { label: 'Adventure', plural: 'Adventure', emoji: '🧗' },
  music: { label: 'Music', plural: 'Music', emoji: '🎶' },
};

export const PAYOUT_STATUS = {
  requested: { label: 'Requested', tone: 'marigold' },
  approved: { label: 'Approved', tone: 'blue' },
  paid: { label: 'Paid', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

/** 150 → "2h 30m", 45 → "45 min" */
export function fmtDuration(min) {
  const m = Math.round(Number(min) || 0);
  if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Stable function identity for callbacks handed to <Modal onClose>. The shared Modal re-runs its
 * autofocus effect whenever onClose changes, which would steal focus mid-typing.
 */
export function useStableCallback(fn) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args) => ref.current?.(...args), []);
}
