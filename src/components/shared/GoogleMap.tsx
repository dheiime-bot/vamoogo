/**
 * GoogleMap — mapa premium estilo Uber/99.
 * - Carrinho animado para motorista (gira pelo heading)
 * - Bonequinho para passageiro/origem
 * - Pino de destino destacado
 * - Movimento interpolado suave (sem teleporte)
 * - Rota com gradiente azul
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Loader2, LocateFixed } from "lucide-react";
import { useGoogleMapsKey } from "@/hooks/useGoogleMapsKey";

interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  heading?: number;
  /** Categoria do veículo — define o ícone/cor do marker do motorista. */
  category?: "moto" | "economico" | "conforto";
}

interface GoogleMapProps {
  className?: string;
  origin?: MapPoint | null;
  destination?: MapPoint | null;
  driverLocation?: MapPoint | null;
  stops?: MapPoint[];
  /** Carrinhos de motoristas online próximos (mostrados em estado idle no mapa do passageiro). */
  nearbyDrivers?: MapPoint[];
  onMapClick?: (lat: number, lng: number) => void;
  showCenterPin?: boolean;
  onCenterChange?: (lat: number, lng: number) => void;
  interactive?: boolean;
  showRoute?: boolean;
  trackUserLocation?: boolean;
  /** Como mostrar a posição do próprio usuário no mapa: bonequinho (passageiro) ou carrinho (motorista). */
  userMarkerVariant?: "passenger" | "car-economico" | "car-conforto" | "moto";
  /** Espaçamento extra no rodapé (px) — sobe o botão recentralizar e o logo do Google p/ não ficarem cobertos por CTAs. */
  bottomInset?: number;
}

const ALTAMIRA_CENTER = { lat: -3.2036, lng: -52.2108 };
const MAP_ID = "vamoogo-map";

// Estilo de mapa moderno (claro, limpo, premium)
const MODERN_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f7f8fa" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6573" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e8eef7" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#dbe3f0" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe2ff" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5b8def" }] },
];

/* ---------- Markers premium ---------- */

/** Converte nome de cor (pt-BR) em hex. Retorna null se não reconhecida. */
export const vehicleColorToHex = (name?: string | null): string | null => {
  if (!name) return null;
  const k = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const map: Record<string, string> = {
    branco: "#f8fafc",
    branca: "#f8fafc",
    prata: "#c0c4cc",
    prateado: "#c0c4cc",
    cinza: "#6b7280",
    grafite: "#374151",
    chumbo: "#475569",
    preto: "#0f172a",
    preta: "#0f172a",
    vermelho: "#dc2626",
    vermelha: "#dc2626",
    azul: "#2563eb",
    "azul escuro": "#1e3a8a",
    "azul claro": "#60a5fa",
    marinho: "#1e3a8a",
    verde: "#16a34a",
    "verde escuro": "#166534",
    amarelo: "#facc15",
    amarela: "#facc15",
    laranja: "#f97316",
    marrom: "#78350f",
    bege: "#d6b894",
    dourado: "#d4af37",
    rosa: "#ec4899",
    roxo: "#7c3aed",
    vinho: "#7f1d1d",
  };
  if (map[k]) return map[k];
  // tenta primeira palavra
  const first = k.split(/\s+/)[0];
  return map[first] || null;
};

/** Determina se uma cor é clara (precisa de outline escuro p/ destaque). */
const isLightColor = (hex: string) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 200;
};

/** Escurece um hex em N% (p/ gradiente). */
const shadeColor = (hex: string, percent: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 + percent))));
  return `#${[f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

/** Cores padrão por categoria quando o veículo do motorista não é conhecido (idle/nearby). */
const CATEGORY_DEFAULT_COLOR: Record<"economico" | "conforto" | "moto", string> = {
  economico: "#2563eb", // azul vamoo
  conforto: "#d4af37",  // dourado
  moto: "#2563eb",
};

/* ----- Pino estilo "map-pin" com veículo dentro ----- */

const CarMarker = ({
  heading = 0,
  variant = "economico",
  color,
}: {
  heading?: number;
  variant?: "economico" | "conforto";
  color?: string | null;
}) => {
  const baseColor = color || CATEGORY_DEFAULT_COLOR[variant];
  const light = isLightColor(baseColor);
  const pinTop = baseColor;
  const pinBottom = shadeColor(baseColor, -0.25);
  const smoothHeading = useSmoothHeading(heading);
  const uid = `${variant}-${baseColor.replace("#", "")}`;
  // cor do corpo do carro = cor do veículo
  const bodyTop = baseColor;
  const bodyBottom = shadeColor(baseColor, -0.35);
  const bodyEdge = shadeColor(baseColor, -0.55);
  const glassColor = light ? "#1e293b" : "#0f172a";
  const roofColor = shadeColor(baseColor, light ? -0.15 : 0.15);
  return (
    <div
      className="relative drop-shadow-xl"
      style={{ width: 56, height: 70 }}
      title={variant === "conforto" ? "Motorista (Conforto)" : "Motorista"}
    >
      <div className="anim-vehicle-bob" style={{ width: 56, height: 70 }}>
        <svg viewBox="0 0 64 80" width="56" height="70" style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id={`carShadow-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.45)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id={`pinBg-${uid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={pinTop} />
              <stop offset="100%" stopColor={pinBottom} />
            </linearGradient>
            <linearGradient id={`carBody-${uid}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={bodyBottom} />
              <stop offset="50%" stopColor={bodyTop} />
              <stop offset="100%" stopColor={bodyBottom} />
            </linearGradient>
          </defs>
          {/* sombra */}
          <ellipse cx="32" cy="76" rx="14" ry="3" fill={`url(#carShadow-${uid})`} />
          {/* gota do pino */}
          <path
            d="M32 4 C18 4 8 14 8 28 C8 42 26 64 32 70 C38 64 56 42 56 28 C56 14 46 4 32 4 Z"
            fill={`url(#pinBg-${uid})`}
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          {/* círculo branco interno */}
          <circle cx="32" cy="28" r="20" fill="#ffffff" />
          {/* carro dentro (gira pelo heading) */}
          <g
            style={{
              transform: `rotate(${smoothHeading}deg)`,
              transformOrigin: "32px 28px",
              transformBox: "fill-box" as any,
              transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {/* sombra interna sob o carro */}
            <ellipse cx="32" cy="29" rx="11" ry="14" fill="rgba(0,0,0,0.12)" />

            {/* Corpo do carro (vista superior) — cor do veículo */}
            <path
              d="M26 14
                 C 23 14 21.5 16 21.5 19
                 L 21.5 38
                 C 21.5 41 23 43 26 43
                 L 38 43
                 C 41 43 42.5 41 42.5 38
                 L 42.5 19
                 C 42.5 16 41 14 38 14 Z"
              fill={`url(#carBody-${uid})`}
              stroke={bodyEdge}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />

            {/* highlight lateral (brilho) */}
            <path
              d="M23.5 18 L 23.5 39"
              stroke="#ffffff"
              strokeWidth="0.8"
              opacity="0.35"
              strokeLinecap="round"
            />
            <path
              d="M40.5 18 L 40.5 39"
              stroke="#000000"
              strokeWidth="0.6"
              opacity="0.18"
              strokeLinecap="round"
            />

            {/* para-brisa frontal (escuro/fumê) */}
            <path
              d="M24 19.5 L 26 23 L 38 23 L 40 19.5
                 C 38.5 18 36 17.2 32 17.2
                 C 28 17.2 25.5 18 24 19.5 Z"
              fill={glassColor}
              opacity="0.85"
            />
            {/* reflexo no para-brisa */}
            <path
              d="M26 19.5 L 27.5 22.5 L 30 22.5 Z"
              fill="#ffffff"
              opacity="0.18"
            />

            {/* teto / cabine */}
            <rect
              x="25"
              y="24"
              width="14"
              height="9"
              rx="1.5"
              fill={roofColor}
              opacity="0.9"
            />
            {/* divisão central do teto */}
            <line x1="32" y1="24.5" x2="32" y2="32.5" stroke={bodyEdge} strokeWidth="0.4" opacity="0.5" />

            {/* para-brisa traseiro */}
            <path
              d="M24 37.5 L 26 34 L 38 34 L 40 37.5
                 C 38.5 39 36 39.8 32 39.8
                 C 28 39.8 25.5 39 24 37.5 Z"
              fill={glassColor}
              opacity="0.7"
            />

            {/* faróis dianteiros */}
            <rect x="23" y="14.8" width="3" height="1.6" rx="0.6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.3" />
            <rect x="38" y="14.8" width="3" height="1.6" rx="0.6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.3" />

            {/* lanternas traseiras */}
            <rect x="23" y="40.6" width="3" height="1.6" rx="0.6" fill="#ef4444" />
            <rect x="38" y="40.6" width="3" height="1.6" rx="0.6" fill="#ef4444" />

            {/* retrovisores */}
            <ellipse cx="20.8" cy="22" rx="1.2" ry="0.9" fill={bodyBottom} stroke={bodyEdge} strokeWidth="0.3" />
            <ellipse cx="43.2" cy="22" rx="1.2" ry="0.9" fill={bodyBottom} stroke={bodyEdge} strokeWidth="0.3" />
          </g>
        </svg>
      </div>
    </div>
  );
};

const MotoMarker = ({
  heading = 0,
  color,
}: {
  heading?: number;
  color?: string | null;
}) => {
  const baseColor = color || CATEGORY_DEFAULT_COLOR.moto;
  const light = isLightColor(baseColor);
  const pinTop = baseColor;
  const pinBottom = shadeColor(baseColor, -0.25);
  const smoothHeading = useSmoothHeading(heading);
  const uid = `moto-${baseColor.replace("#", "")}`;
  const tankTop = baseColor;
  const tankBottom = shadeColor(baseColor, -0.35);
  const tireColor = "#0b1220";
  const rimColor = "#cbd5e1";
  const helmetTop = light ? "#1e293b" : "#0f172a";
  const helmetBottom = light ? "#020617" : "#1e293b";
  const visorColor = "#7dd3fc";
  const chromeColor = "#94a3b8";
  return (
    <div
      className="relative drop-shadow-xl"
      style={{ width: 56, height: 70 }}
      title="Motorista (Moto)"
    >
      <div className="anim-moto-bob" style={{ width: 56, height: 70 }}>
        <svg viewBox="0 0 64 80" width="56" height="70" style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id={`motoShadow-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.45)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id={`motoPin-${uid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={pinTop} />
              <stop offset="100%" stopColor={pinBottom} />
            </linearGradient>
            <linearGradient id={`motoTank-${uid}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={tankBottom} />
              <stop offset="50%" stopColor={tankTop} />
              <stop offset="100%" stopColor={tankBottom} />
            </linearGradient>
            <radialGradient id={`motoHelmet-${uid}`} cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor={helmetTop} />
              <stop offset="100%" stopColor={helmetBottom} />
            </radialGradient>
          </defs>
          <ellipse cx="32" cy="76" rx="13" ry="3" fill={`url(#motoShadow-${uid})`} />
          {/* gota do pino */}
          <path
            d="M32 4 C18 4 8 14 8 28 C8 42 26 64 32 70 C38 64 56 42 56 28 C56 14 46 4 32 4 Z"
            fill={`url(#motoPin-${uid})`}
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          <circle cx="32" cy="28" r="20" fill="#ffffff" />
          {/* moto vista de cima, gira pelo heading */}
          <g
            style={{
              transform: `rotate(${smoothHeading}deg)`,
              transformOrigin: "32px 28px",
              transformBox: "fill-box" as any,
              transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {/* sombra interna sob a moto */}
            <ellipse cx="32" cy="30" rx="9" ry="14" fill="rgba(0,0,0,0.12)" />

            {/* pneu traseiro (mais largo) */}
            <rect x="28" y="36" width="8" height="6" rx="1.5" fill={tireColor} />
            <rect x="29" y="37.5" width="6" height="3" rx="0.8" fill={rimColor} opacity="0.7" />

            {/* pneu dianteiro (mais fino) */}
            <rect x="29" y="14" width="6" height="5" rx="1.2" fill={tireColor} />
            <rect x="29.8" y="15.2" width="4.4" height="2.6" rx="0.6" fill={rimColor} opacity="0.7" />

            {/* tanque/carenagem central — formato de gota apontando para cima */}
            <path
              d="M32 18
                 C 27 18 25 22 25 27
                 L 25 34
                 C 25 36 27 37 32 37
                 C 37 37 39 36 39 34
                 L 39 27
                 C 39 22 37 18 32 18 Z"
              fill={`url(#motoTank-${uid})`}
              stroke={shadeColor(baseColor, -0.5)}
              strokeWidth="0.8"
            />
            {/* highlight do tanque */}
            <path
              d="M28 22 C 28 26 28 32 28.5 35"
              stroke="#ffffff"
              strokeWidth="0.8"
              opacity="0.35"
              fill="none"
              strokeLinecap="round"
            />

            {/* guidão largo */}
            <rect x="22" y="20.2" width="20" height="1.8" rx="0.9" fill={chromeColor} />
            {/* manoplas */}
            <circle cx="22.5" cy="21.1" r="1.6" fill={tireColor} />
            <circle cx="41.5" cy="21.1" r="1.6" fill={tireColor} />

            {/* farol dianteiro */}
            <ellipse cx="32" cy="16" rx="2.2" ry="1.4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.4" />
            <ellipse cx="32" cy="15.7" rx="1" ry="0.5" fill="#ffffff" opacity="0.9" />

            {/* lanterna traseira */}
            <rect x="30" y="40.5" width="4" height="1.2" rx="0.5" fill="#ef4444" />

            {/* capacete do piloto (vista superior) */}
            <circle cx="32" cy="28" r="4.2" fill={`url(#motoHelmet-${uid})`} stroke="#ffffff" strokeWidth="0.6" />
            {/* faixa colorida do capacete */}
            <path
              d="M28.5 27 Q 32 25.8 35.5 27"
              stroke={baseColor}
              strokeWidth="1.1"
              fill="none"
              strokeLinecap="round"
            />
            {/* viseira */}
            <path
              d="M29 25.8 Q 32 24.4 35 25.8 L 34.4 26.6 Q 32 25.6 29.6 26.6 Z"
              fill={visorColor}
              opacity="0.85"
            />
            {/* reflexo no capacete */}
            <ellipse cx="30.5" cy="26.8" rx="0.8" ry="0.5" fill="#ffffff" opacity="0.5" />
          </g>
        </svg>
      </div>
    </div>
  );
};

const PassengerMarker = () => {
  const baseColor = "#2563eb"; // azul vamoo
  const pinTop = "#60a5fa";
  const pinBottom = "#1d4ed8";
  return (
    <div className="relative drop-shadow-xl" title="Passageiro" style={{ width: 56, height: 70 }}>
      {/* Halo pulsante atrás do pino */}
      <div
        className="absolute rounded-full bg-primary/25 animate-ping pointer-events-none"
        style={{ width: 56, height: 56, top: 2, left: 0 }}
      />
      <div className="anim-passenger-bounce relative" style={{ width: 56, height: 70 }}>
        <svg viewBox="0 0 64 80" width="56" height="70" style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id="paxShadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.45)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <linearGradient id="paxPin" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={pinTop} />
              <stop offset="100%" stopColor={pinBottom} />
            </linearGradient>
            <linearGradient id="paxShirt" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="50%" stopColor={baseColor} />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <radialGradient id="paxHead" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#fde6d3" />
              <stop offset="100%" stopColor="#e2a877" />
            </radialGradient>
          </defs>

          {/* sombra */}
          <ellipse cx="32" cy="76" rx="13" ry="3" fill="url(#paxShadow)" />

          {/* gota do pino azul */}
          <path
            d="M32 4 C18 4 8 14 8 28 C8 42 26 64 32 70 C38 64 56 42 56 28 C56 14 46 4 32 4 Z"
            fill="url(#paxPin)"
            stroke="#ffffff"
            strokeWidth="2.5"
          />

          {/* círculo branco interno */}
          <circle cx="32" cy="28" r="20" fill="#ffffff" />

          {/* sombra interna sob o passageiro */}
          <ellipse cx="32" cy="30" rx="11" ry="13" fill="rgba(0,0,0,0.1)" />

          {/* OMBROS / camiseta — vista de cima */}
          <path
            d="M18 38
               C 18 32 22 28 32 28
               C 42 28 46 32 46 38
               L 46 42
               C 46 44 44 45 42 45
               L 22 45
               C 20 45 18 44 18 42 Z"
            fill="url(#paxShirt)"
            stroke="#0b1220"
            strokeOpacity="0.2"
            strokeWidth="0.6"
          />
          {/* gola da camiseta */}
          <path
            d="M28 28 Q 32 31 36 28"
            stroke={shadeColor(baseColor, -0.4)}
            strokeWidth="0.8"
            fill="none"
            strokeLinecap="round"
          />

          {/* CABEÇA — vista superior */}
          <circle cx="32" cy="26" r="6.5" fill="url(#paxHead)" stroke="#0b1220" strokeOpacity="0.25" strokeWidth="0.6" />
          {/* cabelo (faixa por cima da cabeça) */}
          <path
            d="M26 24
               Q 32 19 38 24
               Q 36 22.5 32 22.3
               Q 28 22.5 26 24 Z"
            fill="#3b2a1f"
          />
          {/* highlight do cabelo */}
          <path
            d="M28 23 Q 32 21 36 23"
            stroke="#1f1410"
            strokeWidth="0.4"
            fill="none"
            opacity="0.8"
          />
          {/* reflexo na cabeça */}
          <ellipse cx="30" cy="24.5" rx="1.4" ry="0.9" fill="#ffffff" opacity="0.35" />
        </svg>
      </div>
    </div>
  );
};

const DestinationMarker = () => (
  <div className="relative drop-shadow-lg" title="Destino">
    <svg viewBox="0 0 48 48" width="38" height="38">
      <defs>
        <linearGradient id="dBg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>
      <path
        d="M24 2 C14 2 7 9 7 19 c0 12 17 27 17 27 s17-15 17-27 C41 9 34 2 24 2 z"
        fill="url(#dBg)"
        stroke="#fff"
        strokeWidth="2.5"
      />
      <circle cx="24" cy="19" r="6" fill="#fff" />
    </svg>
  </div>
);

const StopMarker = ({ index }: { index: number }) => (
  <div className="relative drop-shadow-md" title={`Parada ${index + 1}`}>
    <div
      className="h-7 w-7 rounded-full bg-amber-500 border-[3px] border-white flex items-center justify-center text-white text-xs font-bold"
    >
      {index + 1}
    </div>
  </div>
);

/* ---------- Helpers de heading ---------- */

/** Calcula bearing (0-360°) entre dois pontos geográficos. */
const computeBearing = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/** Hook: mantém um heading "contínuo" para que rotações ultrapassem 360° sem voltar pelo caminho longo. */
const useSmoothHeading = (target: number) => {
  const [smooth, setSmooth] = useState<number>(target);
  const lastRef = useRef<number>(target);
  useEffect(() => {
    const last = lastRef.current;
    // Diferença mínima entre -180° e +180°
    let diff = ((target - last + 540) % 360) - 180;
    const next = last + diff;
    lastRef.current = next;
    setSmooth(next);
  }, [target]);
  return smooth;
};

/* ---------- Interpolação de posição (movimento suave) ---------- */

const useInterpolatedPosition = (target: MapPoint | null | undefined) => {
  const [pos, setPos] = useState<MapPoint | null>(target ?? null);
  const fromRef = useRef<MapPoint | null>(target ?? null);
  const startTsRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number>(target?.heading ?? 0);

  useEffect(() => {
    if (!target) {
      setPos(null);
      fromRef.current = null;
      return;
    }
    if (!fromRef.current) {
      fromRef.current = target;
      lastHeadingRef.current = target.heading ?? 0;
      setPos(target);
      return;
    }
    const from = pos || fromRef.current;
    const to = target;

    // Calcula heading automaticamente quando GPS não envia, baseado no vetor de movimento.
    // Distância mínima ~5m para evitar ruído de GPS parado.
    const distDeg = Math.hypot(to.lat - from.lat, to.lng - from.lng);
    const movedEnough = distDeg > 0.00005;
    let resolvedHeading = to.heading;
    if (resolvedHeading == null && movedEnough) {
      resolvedHeading = computeBearing(from, to);
    }
    if (resolvedHeading == null) resolvedHeading = lastHeadingRef.current;
    lastHeadingRef.current = resolvedHeading;

    const duration = 900; // ms
    startTsRef.current = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTsRef.current) / duration);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
      setPos({
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
        heading: resolvedHeading,
        label: to.label,
        category: to.category,
        color: to.color,
      });
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = { ...to, heading: resolvedHeading };
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, target?.heading]);

  return pos;
};

/* ---------- Rota / camadas ---------- */

// Paleta de cores para trechos (cíclica). Cada trecho ganha uma cor distinta.
// Exportada para que outros componentes (ex: breakdown de preço) usem as MESMAS cores.
export const LEG_COLORS = [
  "#3b82f6", // azul
  "#10b981", // verde
  "#f59e0b", // âmbar
  "#ef4444", // vermelho
  "#8b5cf6", // violeta
  "#ec4899", // rosa
  "#06b6d4", // ciano
];

const RouteLayer = ({
  origin,
  destination,
  stops,
}: {
  origin: MapPoint;
  destination: MapPoint;
  stops: MapPoint[];
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const polylinesRef = useRef<any[]>([]);
  const halosRef = useRef<any[]>([]);

  // Chave estável para deps (evita re-render por nova referência de array)
  const stopsKey = stops.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    if (!map || !routesLib) return;
    let cancelled = false;

    const clearAll = () => {
      polylinesRef.current.forEach((p) => p?.setMap(null));
      halosRef.current.forEach((p) => p?.setMap(null));
      polylinesRef.current = [];
      halosRef.current = [];
    };

    const fetchRoute = async () => {
      try {
        const g = (window as any).google;
        const ds = new routesLib.DirectionsService();

        // Sequência completa: origem -> paradas -> destino
        const sequence: MapPoint[] = [origin, ...stops, destination];
        clearAll();
        const bounds = new g.maps.LatLngBounds();

        // Para cada trecho, busca rota independente e desenha com cor própria
        for (let i = 0; i < sequence.length - 1; i++) {
          const a = sequence[i];
          const b = sequence[i + 1];
          try {
            const res = await ds.route({
              origin: { lat: a.lat, lng: a.lng },
              destination: { lat: b.lat, lng: b.lng },
              travelMode: "DRIVING" as any,
            });
            if (cancelled) return;
            const path = res.routes[0]?.overview_path;
            if (!path) continue;

            const color = LEG_COLORS[i % LEG_COLORS.length];

            // halo escuro (largura maior, baixa opacidade)
            const halo = new g.maps.Polyline({
              path,
              strokeColor: "#0b1220",
              strokeOpacity: 0.22,
              strokeWeight: 10,
              map,
              zIndex: 1,
            });
            // linha principal colorida
            const line = new g.maps.Polyline({
              path,
              strokeColor: color,
              strokeOpacity: 1,
              strokeWeight: 5,
              map,
              zIndex: 2,
            });

            halosRef.current.push(halo);
            polylinesRef.current.push(line);
            path.forEach((p: any) => bounds.extend(p));
          } catch (err) {
            console.warn(`Directions trecho ${i} falhou:`, err);
          }
        }

        if (!cancelled && !bounds.isEmpty()) {
          map.fitBounds(bounds, 80);
        }
      } catch (e) {
        console.warn("Directions error:", e);
      }
    };

    fetchRoute();
    return () => {
      cancelled = true;
      clearAll();
    };
  }, [map, routesLib, origin.lat, origin.lng, destination.lat, destination.lng, stopsKey]);

  return null;
};

const FitToPoints = ({ points }: { points: MapPoint[] }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.panTo({ lat: points[0].lat, lng: points[0].lng });
      // Mesmo nível do botão "recentralizar" — visão de bairro, sem zoom agressivo
      map.setZoom(14);
      return;
    }
    const g = (window as any).google;
    if (!g) return;
    const bounds = new g.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 80);
  }, [map, points]);
  return null;
};

const ClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (e: any) => {
      if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => listener.remove();
  }, [map, onMapClick]);
  return null;
};

const CenterTracker = ({
  onCenterChange,
}: {
  onCenterChange: (lat: number, lng: number) => void;
}) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", () => {
      const c = map.getCenter();
      if (c) onCenterChange(c.lat(), c.lng());
    });
    return () => listener.remove();
  }, [map, onCenterChange]);
  return null;
};

const MapStyler = () => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    try {
      (map as any).setOptions({ styles: MODERN_MAP_STYLE });
    } catch {
      /* noop — quando mapId define estilo, isto é ignorado */
    }
  }, [map]);
  return null;
};

/** Botão flutuante para recentralizar o mapa em um ponto preferido. */
const RecenterButton = ({ target, bottomInset = 0 }: { target: MapPoint | null; bottomInset?: number }) => {
  const map = useMap();

  const handleClick = () => {
    if (!map) return;
    if (target) {
      map.panTo({ lat: target.lat, lng: target.lng });
      map.setZoom(14);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          map.setZoom(14);
        },
        () => {
          map.panTo(ALTAMIRA_CENTER);
          map.setZoom(13);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  };

  // Alinhado verticalmente com a DriverBottomNav (h-16 + py-2 + safe-area + 8px).
  // Os botões da nav inferior (Corridas/Switch ON-OFF) têm h-16 e ficam ancorados a
  // `env(safe-area-inset-bottom) + 16px` do fundo (paddingBottom = safe + 0.5rem + 8px,
  // mais py-2 = 8px do container). Aqui usamos `calc(env(safe-area-inset-bottom) + 16px)`
  // para ficar EXATAMENTE na mesma linha do switch e do pneuzinho.
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Recentralizar mapa"
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${bottomInset + 16}px)` }}
      className="absolute right-3 z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-card/95 backdrop-blur-md shadow-lg ring-2 ring-background border border-border transition-transform active:scale-95 hover:bg-muted"
    >
      <LocateFixed className="h-6 w-6 text-primary" />
    </button>
  );
};

/** Aplica padding interno ao mapa — empurra logo Google e controles para cima do bottomInset. */
const MapPaddingController = ({ bottomInset }: { bottomInset: number }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    (map as any).setOptions?.({ padding: { top: 0, right: 0, bottom: bottomInset, left: 0 } });
  }, [map, bottomInset]);
  return null;
};

/* ---------- Mapa principal ---------- */

const GoogleMapInner = ({
  origin,
  destination,
  driverLocation,
  stops = [],
  nearbyDrivers = [],
  onMapClick,
  onCenterChange,
  interactive = true,
  showRoute = true,
  trackUserLocation = false,
  userMarkerVariant = "passenger",
  bottomInset = 0,
}: Omit<GoogleMapProps, "className" | "showCenterPin">) => {
  const [userLoc, setUserLoc] = useState<MapPoint | null>(null);
  const animatedDriver = useInterpolatedPosition(driverLocation || null);

  useEffect(() => {
    if (!trackUserLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [trackUserLocation]);

  const points = useMemo(
    () => [origin, destination, animatedDriver, ...stops, userLoc].filter(Boolean) as MapPoint[],
    [origin, destination, animatedDriver, stops, userLoc]
  );

  return (
    <Map
      defaultCenter={ALTAMIRA_CENTER}
      defaultZoom={17}
      mapId={MAP_ID}
      gestureHandling={interactive ? "greedy" : "none"}
      disableDefaultUI={true}
      zoomControl={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      rotateControl={false}
      scaleControl={false}
      clickableIcons={false}
      style={{ width: "100%", height: "100%" }}
    >
      <MapStyler />
      <MapPaddingController bottomInset={bottomInset} />

      {origin && (
        <AdvancedMarker position={{ lat: origin.lat, lng: origin.lng }}>
          <PassengerMarker />
        </AdvancedMarker>
      )}
      {destination && (
        <AdvancedMarker position={{ lat: destination.lat, lng: destination.lng }}>
          <DestinationMarker />
        </AdvancedMarker>
      )}
      {stops.map((s, i) => (
        <AdvancedMarker key={i} position={{ lat: s.lat, lng: s.lng }}>
          <StopMarker index={i} />
        </AdvancedMarker>
      ))}
      {animatedDriver && (
        <AdvancedMarker position={{ lat: animatedDriver.lat, lng: animatedDriver.lng }}>
          {animatedDriver.category === "moto" ? (
            <MotoMarker heading={animatedDriver.heading || 0} color={animatedDriver.color} />
          ) : (
            <CarMarker
              heading={animatedDriver.heading || 0}
              variant={animatedDriver.category === "conforto" ? "conforto" : "economico"}
              color={animatedDriver.color}
            />
          )}
        </AdvancedMarker>
      )}
      {/* Motoristas online próximos — só mostra quando NÃO há motorista ativo (animatedDriver) */}
      {!animatedDriver &&
        nearbyDrivers.map((d, i) => (
          <AdvancedMarker key={`nb-${i}-${d.lat.toFixed(4)},${d.lng.toFixed(4)}`} position={{ lat: d.lat, lng: d.lng }}>
            <div className="rounded-full bg-card/90 p-1 shadow-lg ring-1 ring-border">
              {d.category === "moto" ? (
                <MotoMarker heading={d.heading || 0} color={d.color} />
              ) : (
                <CarMarker
                  heading={d.heading || 0}
                  variant={d.category === "conforto" ? "conforto" : "economico"}
                  color={d.color}
                />
              )}
            </div>
          </AdvancedMarker>
        ))}
      {userLoc && !origin && (
        <AdvancedMarker position={{ lat: userLoc.lat, lng: userLoc.lng }}>
          {userMarkerVariant === "moto" ? (
            <MotoMarker heading={0} />
          ) : userMarkerVariant === "car-economico" ? (
            <CarMarker heading={0} variant="economico" />
          ) : userMarkerVariant === "car-conforto" ? (
            <CarMarker heading={0} variant="conforto" />
          ) : (
            <PassengerMarker />
          )}
        </AdvancedMarker>
      )}

      {showRoute && origin && destination && (
        <RouteLayer origin={origin} destination={destination} stops={stops} />
      )}
      {!showRoute && <FitToPoints points={points} />}
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}
      {onCenterChange && <CenterTracker onCenterChange={onCenterChange} />}
      {interactive && (
        <RecenterButton target={origin || animatedDriver || userLoc || null} bottomInset={bottomInset} />
      )}
    </Map>
  );
};

const GoogleMap = ({ className = "h-[300px]", ...rest }: GoogleMapProps) => {
  const { key, loading } = useGoogleMapsKey();

  if (loading || !key) {
    return (
      <div className={`${className} rounded-2xl bg-muted flex items-center justify-center`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`${className} gmap-clean relative rounded-2xl overflow-hidden shadow-sm`}>
      <APIProvider apiKey={key} libraries={["places"]} language="pt-BR" region="BR">
        <GoogleMapInner {...rest} />
      </APIProvider>
      {rest.showCenterPin && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
          <svg viewBox="0 0 24 24" className="w-9 h-9 text-primary drop-shadow-xl" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default GoogleMap;
