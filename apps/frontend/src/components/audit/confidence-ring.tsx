export function ConfidenceRing({ value, size = 68 }: { value: number; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const len = (value / 100) * circ;
  const color = value >= 97 ? "var(--primary)" : value >= 93 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--secondary)" strokeWidth={6} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${len} ${circ - len}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono font-semibold text-[13px]">
        {value.toFixed(1)}%
      </div>
    </div>
  );
}
