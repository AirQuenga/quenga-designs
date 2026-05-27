import { MapPin } from "lucide-react"

/**
 * Stylized preview of the Rental Atlas map.
 * SVG-based to keep payload tiny and crisp on every screen.
 * Replaces the old "MAP" text placeholder with a faithful, on-brand mock.
 */
export function RentalMapPreview() {
  return (
    <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-card shadow-xl">
      {/* Map background — Butte County silhouette mock */}
      <svg
        viewBox="0 0 400 225"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* Base */}
        <rect width="400" height="225" fill="hsl(var(--secondary))" />

        {/* Roads / grid */}
        <g stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.5">
          <line x1="0" y1="56" x2="400" y2="56" />
          <line x1="0" y1="112" x2="400" y2="112" />
          <line x1="0" y1="168" x2="400" y2="168" />
          <line x1="80" y1="0" x2="80" y2="225" />
          <line x1="160" y1="0" x2="160" y2="225" />
          <line x1="240" y1="0" x2="240" y2="225" />
          <line x1="320" y1="0" x2="320" y2="225" />
        </g>

        {/* River / waterway */}
        <path
          d="M 0 140 Q 60 130, 120 145 T 240 150 T 400 135"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          fill="none"
          opacity="0.25"
        />

        {/* Major roads */}
        <path
          d="M 30 200 Q 100 100, 200 110 T 380 60"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          fill="none"
          opacity="0.4"
        />
        <path
          d="M 0 80 L 400 90"
          stroke="hsl(var(--primary))"
          strokeWidth="1"
          fill="none"
          opacity="0.3"
        />

        {/* Property cluster — Chico (large) */}
        <g>
          <circle cx="180" cy="105" r="28" fill="hsl(var(--primary))" opacity="0.12" />
          <circle cx="180" cy="105" r="18" fill="hsl(var(--primary))" opacity="0.2" />
          <circle cx="180" cy="105" r="11" fill="hsl(var(--primary))" />
          <text
            x="180"
            y="109"
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="hsl(var(--primary-foreground))"
            fontFamily="system-ui, sans-serif"
          >
            842
          </text>
        </g>

        {/* Cluster — Oroville */}
        <g>
          <circle cx="240" cy="155" r="20" fill="hsl(var(--primary))" opacity="0.12" />
          <circle cx="240" cy="155" r="13" fill="hsl(var(--primary))" opacity="0.2" />
          <circle cx="240" cy="155" r="9" fill="hsl(var(--primary))" />
          <text
            x="240"
            y="158"
            textAnchor="middle"
            fontSize="7.5"
            fontWeight="700"
            fill="hsl(var(--primary-foreground))"
            fontFamily="system-ui, sans-serif"
          >
            312
          </text>
        </g>

        {/* Cluster — Paradise */}
        <g>
          <circle cx="290" cy="80" r="16" fill="hsl(var(--primary))" opacity="0.12" />
          <circle cx="290" cy="80" r="11" fill="hsl(var(--primary))" opacity="0.2" />
          <circle cx="290" cy="80" r="7.5" fill="hsl(var(--primary))" />
          <text
            x="290"
            y="83"
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="700"
            fill="hsl(var(--primary-foreground))"
            fontFamily="system-ui, sans-serif"
          >
            187
          </text>
        </g>

        {/* Individual pins */}
        {[
          { x: 80, y: 60 },
          { x: 130, y: 175 },
          { x: 320, y: 185 },
          { x: 350, y: 130 },
          { x: 60, y: 130 },
          { x: 220, y: 45 },
        ].map((p) => (
          <g key={`${p.x}-${p.y}`}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="hsl(var(--primary))" opacity="0.85" />
            <circle cx={p.x} cy={p.y} r="1.5" fill="hsl(var(--card))" />
          </g>
        ))}
      </svg>

      {/* Top-left badge */}
      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur">
        <MapPin className="h-3 w-3 text-primary" />
        Butte County
      </div>

      {/* Top-right pill */}
      <div className="absolute right-3 top-3 rounded-md border border-border bg-card/95 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
        <span className="text-muted-foreground">2026 FMR</span>
        <span className="ml-1.5 font-semibold text-foreground">$1,847</span>
      </div>

      {/* Bottom legend */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-md border border-border bg-card/95 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Available</span>
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="h-2 w-2 rounded-full bg-primary opacity-40" />
            <span className="text-muted-foreground">Cluster</span>
          </span>
        </div>
        <span className="font-medium text-foreground">5,712 units mapped</span>
      </div>
    </div>
  )
}
