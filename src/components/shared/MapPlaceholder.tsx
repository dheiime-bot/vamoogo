import { MapPin } from "lucide-react";

const MapPlaceholder = ({ className = "" }: { className?: string }) => (
  <div className={`relative w-full overflow-hidden rounded-2xl bg-muted ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-info/5" />
    {/* Grid pattern */}
    <svg className="absolute inset-0 h-full w-full opacity-10" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
    {/* Roads */}
    <div className="absolute left-1/4 top-0 h-full w-px bg-muted-foreground/20" />
    <div className="absolute left-2/3 top-0 h-full w-px bg-muted-foreground/20" />
    <div className="absolute left-0 top-1/3 h-px w-full bg-muted-foreground/20" />
    <div className="absolute left-0 top-2/3 h-px w-full bg-muted-foreground/20" />
    {/* Route line */}
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300">
      <path d="M 80 250 Q 120 180 180 160 T 320 80" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeDasharray="8 4" opacity="0.7" />
      <circle cx="80" cy="250" r="6" fill="hsl(var(--primary))" />
      <circle cx="320" cy="80" r="6" fill="hsl(var(--destructive))" />
    </svg>
    {/* Center pin */}
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className="animate-pulse-slow">
        <MapPin className="h-8 w-8 text-primary drop-shadow-lg" />
      </div>
    </div>
  </div>
);

export default MapPlaceholder;
