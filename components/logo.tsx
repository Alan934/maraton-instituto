/** Escudo dividido en azul y amarillo (colores del instituto), con sol y recorrido. Sin simbología religiosa. */
export function LogoMark({ size = 40 }: { size?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    return (
      <line
        key={i}
        x1={62 + Math.cos(a) * 13}
        y1={38 + Math.sin(a) * 13}
        x2={62 + Math.cos(a) * 19}
        y2={38 + Math.sin(a) * 19}
        stroke="#e2a90f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    );
  });
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 100 112" role="img" aria-label="Escudo">
      <defs>
        <clipPath id="shield">
          <path d="M50 3 92 14v44c0 26-19 41-42 51C27 99 8 84 8 58V14Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#shield)">
        <rect x="0" y="0" width="50" height="112" fill="#5477c4" />
        <rect x="50" y="0" width="50" height="112" fill="#f8e184" />
        <circle cx="62" cy="38" r="9" fill="#f0be2e" />
        {rays}
        <path
          d="M18 96C34 92 40 76 52 74s20 8 34-6"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="1 9"
        />
        <path d="M22 60c8-4 14-14 26-14" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" opacity=".9" />
        <circle cx="24" cy="30" r="5" fill="#fff" opacity=".95" />
      </g>
      <path
        d="M50 3 92 14v44c0 26-19 41-42 51C27 99 8 84 8 58V14Z"
        fill="none"
        stroke="#16265c"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
