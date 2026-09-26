import { useId } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';

export function LogoMark({ size = 32, className }) {
  const id = `tc-logo-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7439a8" />
          <stop offset="1" stopColor="#3b1f59" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id})`} />
      <circle cx="44" cy="20" r="7" fill="#ffc04c" />
      <path d="M8 50 L24 28 L32 38 L40 30 L56 50 Z" fill="#fff" opacity="0.95" />
      <path d="M8 50 L24 28 L30 36 L22 50 Z" fill="#dfd0f1" />
      <path d="M14 56 C24 50 40 50 50 56" stroke="#ffc04c" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ to = '/', light = false, className, size = 32 }) {
  return (
    <Link to={to} className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className={clsx('font-display text-[21px] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>
        itenary<span className={light ? 'text-marigold-300' : 'text-plum-600'}>.com</span>
      </span>
    </Link>
  );
}
