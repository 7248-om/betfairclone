/**
 * @component StatCard — Dark Teal theme
 */

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  accentColor?: "teal" | "green" | "amber" | "red" | "purple";
}

const accentMap = {
  teal:   { color: "var(--teal)",    bg: "rgba(38,160,181,0.12)"  },
  green:  { color: "var(--success)", bg: "var(--success-bg)"       },
  amber:  { color: "var(--warning)", bg: "var(--warning-bg)"       },
  red:    { color: "var(--danger)",  bg: "var(--danger-bg)"        },
  purple: { color: "#a855f7",        bg: "rgba(168,85,247,0.12)"  },
};

export default function StatCard({
  title,
  value,
  icon,
  trend,
  accentColor = "teal",
}: StatCardProps) {
  const accent = accentMap[accentColor];

  return (
    <div
      className="rounded-lg p-4 shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-secondary)" }}>{title}</p>
        {icon && (
          <span
            className="flex items-center justify-center w-7 h-7 rounded text-sm"
            style={{ backgroundColor: accent.bg, color: accent.color }}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      {trend && (
        <p
          className="text-xs font-medium mt-1.5"
          style={{ color: trend.positive ? "var(--success)" : "var(--danger)" }}
        >
          {trend.positive ? "▲" : "▼"} {trend.value}
        </p>
      )}
    </div>
  );
}
