import clsx from 'clsx';

// Illustrated destination covers — layered SVG landscapes per theme, varied by a seed so
// every trip gets its own look. No stock photos needed, works offline.
function hash(s = '') {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

const PALETTES = {
  mountains: { sky: ['#fde7c7', '#f4b4a4'], sun: '#fff1d0', layers: ['#b79ad6', '#8b67b8', '#5f2d8b', '#3b1f59'] },
  snow: { sky: ['#e0ecff', '#b6c3f5'], sun: '#ffffff', layers: ['#c7d2fe', '#94a3c8', '#5b6b94', '#2f3b63'] },
  beach: { sky: ['#fff1c9', '#ffb27d'], sun: '#fff6de', sea: ['#38bdf8', '#0369a1'], sand: '#fcd9a0', ink: '#7c2d12' },
  heritage: { sky: ['#ffe1bf', '#f58f7c'], sun: '#fff0d6', layers: ['#e6a07a', '#b8574a', '#8a2c3d', '#5a1a33'] },
  desert: { sky: ['#fff0b8', '#ffb347'], sun: '#fffbe8', layers: ['#f7c26b', '#e9973a', '#c96f22', '#8f4413'] },
  spiritual: { sky: ['#ffe4a8', '#ff9a62'], sun: '#fff6dc', water: ['#ffb982', '#c2410c'], ink: '#6b2410' },
  forest: { sky: ['#e6f7d4', '#a7dcb2'], sun: '#fffbe6', layers: ['#7fc79a', '#3f9a6b', '#1f6d4b', '#0f3d2c'] },
  backwaters: { sky: ['#e3f8e9', '#bfe8d8'], sun: '#fffbe0', water: ['#5ec6b8', '#0f766e'], ink: '#064e3b' },
  city: { sky: ['#dcd6ff', '#f4b6e6'], sun: '#fff5f5', layers: ['#a594e6', '#6f5bc4', '#44338f', '#271c5c'] },
  festival: { sky: ['#ffd6f0', '#ff8fa3'], sun: '#fff3f6', layers: ['#f7a8c4', '#d9538a', '#9d2463', '#5d1040'] },
};

function Ridge({ y, amp, seed, color, jag = 5, opacity = 1 }) {
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 400;
    const r = hash(`${seed}-${i}-${y}`);
    const peak = i % 2 === 0 ? -amp * (0.55 + r * 0.6) : amp * 0.1 * r;
    pts.push(`${x.toFixed(1)},${(y + peak + (r - 0.5) * jag).toFixed(1)}`);
  }
  return <polygon points={`0,240 ${pts.join(' ')} 400,240`} fill={color} opacity={opacity} />;
}

function Hills({ y, seed, color }) {
  const r = hash(seed + y);
  const c1 = 80 + r * 60;
  const c2 = 260 + r * 50;
  return <path d={`M0 ${y} Q ${c1} ${y - 38} 200 ${y - 6} T 400 ${y - 12} V240 H0 Z`} fill={color} style={{ transform: `translateX(${(c2 % 20) - 10}px)` }} />;
}

export default function CoverArt({ theme = 'mountains', seed = 'x', className, children, rounded = true }) {
  const p = PALETTES[theme] || PALETTES.mountains;
  const r = hash(seed);
  const sunX = 70 + r * 260;
  const sunY = 58 + hash(seed + 's') * 30;
  const gid = `g-${theme}-${Math.floor(r * 1e6)}`;

  let scene;
  if (theme === 'beach') {
    scene = (
      <>
        <rect y="138" width="400" height="60" fill={`url(#${gid}-sea)`} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M0 ${150 + i * 14} q 25 -5 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0`} stroke="#fff" strokeOpacity={0.35 - i * 0.08} strokeWidth="2" fill="none" />
        ))}
        <path d="M0 196 Q 200 176 400 192 V240 H0 Z" fill={p.sand} />
        <g transform={`translate(${60 + r * 250} 196)`} fill={p.ink}>
          <path d="M0 0 q 6 -40 2 -78" stroke={p.ink} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M2 -78 q -28 -6 -44 10 q 22 -14 44 -10 q -16 -26 -40 -24 q 26 2 40 24 q 10 -26 34 -28 q -24 8 -34 28 q 30 -4 42 16 q -18 -14 -42 -16 z" />
        </g>
      </>
    );
  } else if (theme === 'spiritual' || theme === 'backwaters') {
    const temple = theme === 'spiritual';
    scene = (
      <>
        <Ridge y={150} amp={24} seed={seed} color={temple ? '#e98d5a' : '#9fd8b5'} opacity={0.7} />
        <rect y="160" width="400" height="80" fill={`url(#${gid}-water)`} />
        {temple ? (
          <g fill={p.ink} transform={`translate(${40 + r * 200} 162)`}>
            <rect x="0" y="-26" width="120" height="26" />
            <path d="M20 -26 L40 -70 L60 -26 Z" />
            <path d="M60 -26 L76 -54 L92 -26 Z" />
            <rect x="37" y="-80" width="6" height="12" />
            {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={8 + i * 18} y="-18" width="6" height="18" fill="#ffcf8a" opacity="0.8" />)}
          </g>
        ) : (
          <g transform={`translate(${60 + r * 220} 168)`} fill={p.ink}>
            <path d="M0 0 h110 l-12 14 h-86 z" />
            <path d="M14 0 q 41 -30 82 0 z" fill="#b45309" />
            <g transform="translate(-40 -2)">
              <path d="M0 0 q 4 -44 0 -70" stroke={p.ink} strokeWidth="4" fill="none" />
              <path d="M0 -70 q -24 -4 -38 10 q 18 -12 38 -10 q -12 -22 -34 -22 q 22 2 34 22 q 10 -22 30 -24 q -20 8 -30 24 q 26 -2 36 14 q -16 -12 -36 -14 z" />
            </g>
          </g>
        )}
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${20 + i * 90} ${190 + (i % 2) * 16} h40`} stroke="#fff" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
        ))}
        {temple && [0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx={30 + i * 55 + hash(seed + i) * 20} cy={200 + hash(seed + i + 'y') * 26} r="2.5" fill="#ffd27a" />)}
      </>
    );
  } else if (theme === 'city') {
    scene = (
      <>
        <Ridge y={170} amp={10} seed={seed} color={p.layers[0]} />
        {Array.from({ length: 14 }).map((_, i) => {
          const h = 40 + hash(seed + i) * 90;
          const w = 22 + hash(seed + 'w' + i) * 14;
          const x = i * 29 - 4;
          return (
            <g key={i}>
              <rect x={x} y={240 - h - 20} width={w} height={h + 20} fill={i % 3 === 0 ? p.layers[2] : p.layers[3]} />
              {Array.from({ length: Math.floor(h / 16) }).map((__, j) => (
                <rect key={j} x={x + 5} y={240 - h - 10 + j * 16} width="4" height="6" fill="#ffd889" opacity={hash(seed + i + j) > 0.45 ? 0.85 : 0.15} />
              ))}
            </g>
          );
        })}
      </>
    );
  } else if (theme === 'heritage') {
    scene = (
      <>
        <Ridge y={160} amp={30} seed={seed} color={p.layers[0]} opacity={0.8} />
        <g fill={p.layers[2]} transform={`translate(${20 + r * 150} 0)`}>
          <rect x="0" y="150" width="230" height="90" />
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${14 + i * 46} 150 q 16 -30 32 0 z`} />)}
          <rect x="80" y="112" width="70" height="40" />
          <path d="M80 112 q 35 -46 70 0 z" />
          <rect x="112" y="56" width="6" height="12" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={'a' + i} d={`M${12 + i * 31} 240 v-34 q 10 -14 20 0 v34 z`} fill={p.layers[3]} />)}
        </g>
        <rect y="222" width="400" height="18" fill={p.layers[3]} />
      </>
    );
  } else if (theme === 'desert') {
    scene = (
      <>
        <Hills y={170} seed={seed} color={p.layers[0]} />
        <Hills y={195} seed={seed + 'b'} color={p.layers[1]} />
        <Hills y={218} seed={seed + 'c'} color={p.layers[2]} />
        <g fill={p.layers[3]} transform={`translate(${80 + r * 220} 172) scale(0.9)`}>
          <path d="M0 0 q 6 -14 16 -10 q 6 -14 16 -2 q 10 -4 14 4 l 6 -10 q 4 -2 6 2 l -4 14 v 18 h-3 v-14 h-26 v14 h-3 v-14 q -8 0 -10 -6 z" />
        </g>
      </>
    );
  } else if (theme === 'forest') {
    scene = (
      <>
        <Hills y={150} seed={seed} color={p.layers[0]} />
        <Hills y={180} seed={seed + 'b'} color={p.layers[1]} />
        {Array.from({ length: 16 }).map((_, i) => {
          const x = i * 26 + hash(seed + i) * 10;
          const h = 30 + hash(seed + 'h' + i) * 26;
          return <path key={i} d={`M${x} 214 l 11 -${h} l 11 ${h} z`} fill={i % 2 ? p.layers[2] : p.layers[3]} />;
        })}
        <rect y="210" width="400" height="30" fill={p.layers[3]} />
      </>
    );
  } else if (theme === 'festival') {
    scene = (
      <>
        <Ridge y={190} amp={14} seed={seed} color={p.layers[2]} />
        <path d="M0 40 Q 200 90 400 40" stroke={p.layers[3]} strokeWidth="1.5" fill="none" />
        {Array.from({ length: 11 }).map((_, i) => {
          const x = i * 38 + 12;
          const y = 40 + Math.sin((i / 10) * Math.PI) * 24;
          return <path key={i} d={`M${x} ${y} l 10 0 l -5 14 z`} fill={['#ffc04c', '#ffffff', '#7439a8', '#0f766e'][i % 4]} />;
        })}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${90 + i * 110 + hash(seed + i) * 30} ${110 + hash(seed + 'l' + i) * 30})`}>
            <rect x="-10" y="0" width="20" height="26" rx="8" fill="#ffc04c" opacity="0.9" />
            <rect x="-6" y="-4" width="12" height="4" fill={p.layers[3]} />
          </g>
        ))}
        <rect y="220" width="400" height="20" fill={p.layers[3]} />
      </>
    );
  } else {
    // mountains / snow
    const snow = theme === 'snow';
    scene = (
      <>
        <Ridge y={120} amp={60} seed={seed} color={p.layers[0]} jag={8} />
        {snow && <Ridge y={120} amp={60} seed={seed} color="#ffffff" jag={8} opacity={0.55} />}
        <Ridge y={150} amp={48} seed={seed + 'b'} color={p.layers[1]} />
        <Ridge y={185} amp={34} seed={seed + 'c'} color={p.layers[2]} />
        <Hills y={222} seed={seed + 'd'} color={p.layers[3]} />
        {!snow && Array.from({ length: 9 }).map((_, i) => {
          const x = 10 + i * 46 + hash(seed + 't' + i) * 16;
          return <path key={i} d={`M${x} 232 l 7 -22 l 7 22 z`} fill={p.layers[3]} />;
        })}
      </>
    );
  }

  return (
    <div className={clsx('relative overflow-hidden', rounded && 'rounded-2xl', className)}>
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.sky[0]} />
            <stop offset="1" stopColor={p.sky[1]} />
          </linearGradient>
          {p.sea && (
            <linearGradient id={`${gid}-sea`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.sea[0]} />
              <stop offset="1" stopColor={p.sea[1]} />
            </linearGradient>
          )}
          {p.water && (
            <linearGradient id={`${gid}-water`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.water[0]} />
              <stop offset="1" stopColor={p.water[1]} />
            </linearGradient>
          )}
        </defs>
        <rect width="400" height="240" fill={`url(#${gid}-sky)`} />
        <circle cx={sunX} cy={sunY} r={theme === 'city' ? 18 : 26} fill={p.sun} opacity="0.95" />
        <circle cx={sunX} cy={sunY} r={theme === 'city' ? 30 : 42} fill={p.sun} opacity="0.25" />
        {[0, 1].map((i) => (
          <path key={i} d={`M${(sunX + 90 + i * 140) % 400} ${40 + i * 22} q 12 -10 24 0 q 10 -8 20 0`} stroke="#fff" strokeOpacity="0.6" strokeWidth="2" fill="none" strokeLinecap="round" />
        ))}
        {scene}
      </svg>
      {children && <div className="relative h-full">{children}</div>}
    </div>
  );
}
