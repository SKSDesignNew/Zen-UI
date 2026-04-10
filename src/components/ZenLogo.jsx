export function ZenLogo({ size = 30 }) {
  const s = size / 30;
  return (
    <svg width={36 * s} height={28 * s} viewBox="0 0 36 32" fill="none" style={{ display: 'block' }}>
      <path
        d="M4 8h20L4 24h20"
        stroke="hsl(var(--foreground))"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <animate attributeName="stroke-dasharray" from="0 80" to="80 0" dur="1.8s" fill="freeze" />
      </path>
      <line x1="28" y1="4" x2="34" y2="4" stroke="hsl(var(--accent))" strokeWidth="2.8" strokeLinecap="round">
        <animate attributeName="opacity" values="0;1" dur="0.4s" begin="1.6s" fill="freeze" />
      </line>
      <line x1="31" y1="1" x2="31" y2="7" stroke="hsl(var(--accent))" strokeWidth="2.8" strokeLinecap="round">
        <animate attributeName="opacity" values="0;1" dur="0.4s" begin="1.6s" fill="freeze" />
      </line>
    </svg>
  );
}
