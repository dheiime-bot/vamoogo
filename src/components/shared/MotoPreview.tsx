/**
 * MotoPreview — exibe a motinha animada usada no mapa,
 * para visualização fora de contexto (landing/teste).
 */
const MotoPreview = ({ size = 96, heading = -30 }: { size?: number; heading?: number }) => {
  return (
    <div
      className="relative inline-flex items-center justify-center drop-shadow-xl"
      style={{
        transform: `rotate(${heading}deg)`,
        transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
        width: size,
        height: size,
      }}
      title="Motorista (Moto)"
    >
      <div className="anim-moto-bob" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" width={size} height={size} style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id="mpShadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id="mpBody" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="56" rx="16" ry="3.5" fill="url(#mpShadow)" />
          <g
            className="anim-wheel-spin"
            style={{ transformOrigin: "16px 48px", transformBox: "fill-box" as any }}
          >
            <circle cx="16" cy="48" r="6" fill="#0b1220" stroke="#374151" strokeWidth="1.2" />
            <line x1="16" y1="42" x2="16" y2="54" stroke="#9ca3af" strokeWidth="0.8" />
            <line x1="10" y1="48" x2="22" y2="48" stroke="#9ca3af" strokeWidth="0.8" />
          </g>
          <g
            className="anim-wheel-spin"
            style={{ transformOrigin: "48px 48px", transformBox: "fill-box" as any }}
          >
            <circle cx="48" cy="48" r="6" fill="#0b1220" stroke="#374151" strokeWidth="1.2" />
            <line x1="48" y1="42" x2="48" y2="54" stroke="#9ca3af" strokeWidth="0.8" />
            <line x1="42" y1="48" x2="54" y2="48" stroke="#9ca3af" strokeWidth="0.8" />
          </g>
          <path
            d="M16 48 L26 30 H40 L48 48"
            stroke="url(#mpBody)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="28" y="26" width="12" height="8" rx="2" fill="url(#mpBody)" />
          <path d="M44 26 L52 22" stroke="#0b1220" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="34" cy="20" r="5" fill="#0b1220" />
          <rect x="30" y="18" width="8" height="3" rx="1" fill="#7dd3fc" opacity="0.85" />
          <circle cx="50" cy="30" r="1.6" fill="#fde68a" />
          <circle className="anim-exhaust" cx="14" cy="42" r="1.6" fill="#cbd5e1" />
        </svg>
      </div>
    </div>
  );
};

export default MotoPreview;
