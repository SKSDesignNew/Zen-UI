import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ArrowLeft, ChevronRight, GripVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code-block';
import { RULES, EDGES, DOM_COLORS, CRIT_COLORS, getPath } from '@/lib/rules';
import {
  SCALE_DOMS,
  SCALE_DOM_COLORS,
  DOM_COUNTS_MAP,
  RULE_NAMES,
  TAL_FILES,
} from '@/lib/scale-data';
import { cn } from '@/lib/utils';

// ─── Cluster (domain) positions on a hand-arranged grid ──────────────────
// 4-row layout: 3 / 3 / 2 / 2 nodes. Authorization is the central hub.
// All y values are shifted down so the largest circle (Authorization, r≈92)
// has its top edge well inside the viewBox.
const CLUSTER_POS = {
  Operations:    { x: 110, y: 130 },
  Authorization: { x: 320, y: 110 },
  Risk:          { x: 530, y: 130 },
  Settlement:    { x: 100, y: 270 },
  Fraud:         { x: 320, y: 270 },
  Reporting:     { x: 540, y: 270 },
  Credit:        { x: 130, y: 420 },
  Pricing:       { x: 510, y: 420 },
  Compliance:    { x: 320, y: 450 },
  Security:      { x: 320, y: 590 },
};

// 14 edges between domain clusters — forms a connected web
const CLUSTER_LINKS = [
  ['Operations', 'Authorization'],
  ['Authorization', 'Fraud'],
  ['Authorization', 'Settlement'],
  ['Fraud', 'Credit'],
  ['Fraud', 'Compliance'],
  ['Credit', 'Pricing'],
  ['Pricing', 'Compliance'],
  ['Compliance', 'Settlement'],
  ['Settlement', 'Reporting'],
  ['Risk', 'Fraud'],
  ['Risk', 'Compliance'],
  ['Security', 'Authorization'],
  ['Security', 'Operations'],
  ['Reporting', 'Risk'],
];

// Maps domain count → circle radius. Aggressive range so the hub-spoke story
// is unmistakable from across a room — Authorization (370) and Security (372)
// should be visibly ~2× larger than Risk (145).
function radiusFor(count) {
  const minC = 140, maxC = 380;
  const minR = 38, maxR = 92;
  const t = Math.max(0, Math.min(1, (count - minC) / (maxC - minC)));
  return minR + t * (maxR - minR);
}

// Maps count → background fill opacity inside the circle. More rules = more
// saturated tint = visually "weightier" / more critical to the overall system.
function fillOpacityFor(count) {
  const t = Math.max(0, Math.min(1, (count - 140) / 240));
  return 0.06 + t * 0.22;
}

// Match a synthetic rule name in the right panel (e.g. "Card Status Validation")
// to one of the 13 hand-authored RULES so clicking the chip selects a real
// node in the call graph. Falls back to any RULE in the same domain.
function matchDemoRule(ruleName, domain) {
  const tokens = ruleName.toLowerCase().split(/[\s-]+/).filter((t) => t.length > 2);
  let best = null;
  let bestScore = 0;
  for (const r of RULES) {
    const rTokens = r.name.toLowerCase().split(/[\s-]+/).filter((t) => t.length > 2);
    const score = tokens.filter((t) => rTokens.some((rt) => rt.includes(t) || t.includes(rt))).length;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  if (best && bestScore > 0) return best;
  // Fallback: any RULE in the same domain (most relevant)
  return RULES.find((r) => r.dom === domain) || null;
}

// Smooth quadratic curve between two points so connections feel organic.
function curvePath(a, b) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // Pull control point slightly outward from the line for a soft arc
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = Math.min(40, len * 0.18);
  const cx = mx + nx * bow;
  const cy = my + ny * bow;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

// Horizontal call graph layout — fills the wide canvas instead of the
// narrow vertical column the reference uses. Left-to-right flow with
// branching at R003 (R004/R005), R006 (R008/R009), and R009 (R010/R011).
const RULE_POS = {
  R001: { x:  70, y: 360 },
  R002: { x: 180, y: 360 },
  R003: { x: 290, y: 360 },
  R004: { x: 400, y: 220 },
  R005: { x: 400, y: 500 },
  R006: { x: 510, y: 360 },
  R007: { x: 620, y: 180 },
  R008: { x: 620, y: 360 },
  R009: { x: 620, y: 540 },
  R010: { x: 730, y: 260 },
  R011: { x: 730, y: 460 },
  R012: { x: 840, y: 360 },
  R013: { x: 950, y: 360 },
};
const RULE_VIEWBOX = '0 0 1020 720';

// ─── Main component ──────────────────────────────────────────────────────
export function ZG2Tab() {
  const [view, setView] = useState('overview'); // 'overview' | 'drill'
  const [drillDomain, setDrillDomain] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [leftWidth, setLeftWidth] = useState(64); // % of total — draggable
  const containerRef = useRef(null);
  const draggingRef = useRef(false);

  // Drag-to-resize divider between left graph and right panel
  const onDividerMouseDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.max(35, Math.min(85, pct)));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const start = () => {
    setView('overview');
    setDrillDomain(null);
    setSelectedRule(null);
    setHoveredCluster(null);
  };
  const goBack = () => start();
  const drillInto = (domain) => {
    setView('drill');
    setDrillDomain(domain);
    setSelectedRule(null);
  };

  return (
    <div ref={containerRef} className="flex h-[calc(100vh-120px)] w-full overflow-hidden">
      {/* ─── LEFT PANE: graph canvas ─── */}
      <div
        className="relative flex flex-col bg-muted/30"
        style={{ width: `${leftWidth}%` }}
      >
        {/* Top breadcrumb + Start/Back buttons */}
        <div className="flex items-center justify-between border-b bg-card/60 px-4 py-2 backdrop-blur-lg">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={start}
              className="flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <Home className="h-3 w-3" />
              Start
            </button>
            <span className="text-muted-foreground/60">›</span>
            <span
              className={cn(
                'font-bold uppercase tracking-widest text-[10px]',
                view === 'overview' ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              Z+Graph
            </span>
            {view === 'drill' && (
              <>
                <span className="text-muted-foreground/60">›</span>
                <span
                  className="text-xs font-bold"
                  style={{ color: SCALE_DOM_COLORS[drillDomain] }}
                >
                  {drillDomain}
                </span>
              </>
            )}
          </div>
          {view === 'drill' && (
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              className="h-7 gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to All Domains
            </Button>
          )}
        </div>

        {/* Graph canvas */}
        <div className="relative flex-1 overflow-auto p-4">
          {view === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <ClusterCanvas
                onSelect={drillInto}
                hovered={hoveredCluster}
                setHovered={setHoveredCluster}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`drill-${drillDomain}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <DrillCanvas
                domain={drillDomain}
                selectedRule={selectedRule}
                setSelectedRule={setSelectedRule}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* ─── DRAGGABLE DIVIDER ─── */}
      <div
        onMouseDown={onDividerMouseDown}
        className="group relative flex w-2 cursor-col-resize items-center justify-center bg-border hover:bg-accent/40"
        title="Drag to resize"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-card p-0.5 opacity-0 shadow-md transition-opacity group-hover:opacity-100">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* ─── RIGHT PANE: info panel ─── */}
      <div
        className="flex-1 overflow-auto bg-card"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {view === 'overview' ? (
          <motion.div
            key="overview-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            <ClusterPanel onSelect={drillInto} setHovered={setHoveredCluster} />
          </motion.div>
        ) : (
          <motion.div
            key={`drill-panel-${drillDomain}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="p-6"
          >
            <DrillPanel
              domain={drillDomain}
              selectedRule={selectedRule}
              setSelectedRule={setSelectedRule}
              onBack={goBack}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ═════════════ CLUSTER OVERVIEW (left canvas) ════════════════════════════
function ClusterCanvas({ onSelect, hovered, setHovered }) {
  // Compute the set of cluster ids the hovered one connects to
  const connectedToHovered = useMemo(() => {
    if (!hovered) return new Set();
    const s = new Set();
    for (const [a, b] of CLUSTER_LINKS) {
      if (a === hovered) s.add(b);
      if (b === hovered) s.add(a);
    }
    return s;
  }, [hovered]);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Domain Call Graph
        </span>
        <span className="text-[10px] text-muted-foreground">
          2,000 rules · 10 domains · click any circle to drill in
        </span>
      </div>
      <svg viewBox="0 0 660 720" className="block w-full" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        {/* Arrow marker for highlighted edges */}
        <defs>
          <marker id="cluster-arrow" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--accent))" />
          </marker>
        </defs>

        {/* Edges */}
        {CLUSTER_LINKS.map(([a, b], i) => {
          const pa = CLUSTER_POS[a];
          const pb = CLUSTER_POS[b];
          if (!pa || !pb) return null;
          const isHl = hovered && (a === hovered || b === hovered);
          return (
            <path
              key={i}
              d={curvePath(pa, pb)}
              fill="none"
              stroke={isHl ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
              strokeWidth={isHl ? 2.2 : 1.2}
              opacity={isHl ? 0.95 : 0.6}
              markerEnd={isHl ? 'url(#cluster-arrow)' : undefined}
              style={{ transition: 'all 0.2s' }}
            />
          );
        })}

        {/* Nodes */}
        {SCALE_DOMS.map((d) => {
          const p = CLUSTER_POS[d];
          if (!p) return null;
          const count = DOM_COUNTS_MAP[d] || 0;
          const r = radiusFor(count);
          const color = SCALE_DOM_COLORS[d];
          const isHovered = hovered === d;
          const isConnected = hovered && connectedToHovered.has(d);
          const dim = hovered && !isHovered && !isConnected;

          return (
            <g
              key={d}
              transform={`translate(${p.x}, ${p.y})`}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              opacity={dim ? 0.35 : 1}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(d)}
            >
              {/* Soft outer glow on hover */}
              {isHovered && (
                <circle r={r + 10} fill={color} opacity={0.18} />
              )}
              {/* Card-colored base so text stays readable */}
              <circle r={r} fill="hsl(var(--card))" />
              {/* Tinted overlay — saturation scales with rule count = "criticality weight" */}
              <circle r={r} fill={color} fillOpacity={fillOpacityFor(count)} />
              {/* Crisp border */}
              <circle
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={isHovered ? 3.2 : 2}
                style={{ transition: 'stroke-width 0.2s' }}
              />
              {/* Domain name */}
              <text
                y={-r * 0.28}
                textAnchor="middle"
                fill={color}
                fontSize={11}
                fontWeight={700}
                fontFamily="DM Sans, sans-serif"
                style={{ textTransform: 'uppercase', letterSpacing: 1 }}
              >
                {d}
              </text>
              {/* Count (the hero) */}
              <text
                y={r * 0.1}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontSize={20}
                fontWeight={800}
                fontFamily="Playfair Display, serif"
              >
                {count.toLocaleString()}
              </text>
              {/* "rules" caption */}
              <text
                y={r * 0.42}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize={9}
                fontFamily="DM Sans, sans-serif"
              >
                rules
              </text>
              {/* Thin progress arc — proportion of HIGH critical (~15%) */}
              <circle
                r={r - 4}
                fill="none"
                stroke={color}
                strokeOpacity={0.18}
                strokeWidth={2}
              />
              <circle
                r={r - 4}
                fill="none"
                stroke={color}
                strokeWidth={2.4}
                strokeDasharray={`${0.15 * 2 * Math.PI * (r - 4)} ${2 * Math.PI * (r - 4)}`}
                transform="rotate(-90)"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═════════════ CLUSTER OVERVIEW (right panel) ════════════════════════════
function ClusterPanel({ onSelect, setHovered }) {
  return (
    <div>
      <h3 className="mb-1 font-serif text-2xl font-bold tracking-tight">
        2,000 Rules — Organized by Domain
      </h3>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        Click any domain on the graph or below to drill into its call graph and
        see every rule, source file, and dependency.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {SCALE_DOMS.map((d) => {
          const count = DOM_COUNTS_MAP[d] || 0;
          const sample = (RULE_NAMES[d] || []).slice(0, 4).join(', ');
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all',
                'hover:-translate-y-0.5 hover:shadow-md'
              )}
              style={{ borderColor: 'transparent' }}
            >
              <div
                className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  background: `linear-gradient(135deg, ${SCALE_DOM_COLORS[d]}10, transparent)`,
                  border: `1px solid ${SCALE_DOM_COLORS[d]}40`,
                  borderRadius: 12,
                }}
              />
              <div className="absolute inset-0 rounded-xl border" />
              <div className="relative">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: SCALE_DOM_COLORS[d] }}
                    />
                    <span className="text-xs font-bold">{d}</span>
                  </div>
                  <span
                    className="font-serif text-base font-bold"
                    style={{ color: SCALE_DOM_COLORS[d] }}
                  >
                    {count.toLocaleString()}
                  </span>
                </div>
                <div className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {sample}…
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════ DRILL VIEW (left canvas — call graph of 13 demo rules) ════
function DrillCanvas({ domain, selectedRule, setSelectedRule }) {
  // Set of rule ids in the highlighted dependency path
  const highlightSet = useMemo(() => new Set(getPath(selectedRule)), [selectedRule]);
  const ruleById = useMemo(() => Object.fromEntries(RULES.map((r) => [r.id, r])), []);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Call Graph for{' '}
          <span style={{ color: SCALE_DOM_COLORS[domain] }}>{domain}</span>
        </span>
        <span className="text-[10px] text-muted-foreground">
          {DOM_COUNTS_MAP[domain]?.toLocaleString() || 0} rules · click a node to trace
        </span>
      </div>
      <svg
        viewBox={RULE_VIEWBOX}
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ minHeight: 'calc(100vh - 280px)' }}
      >
        <defs>
          <marker
            id="rule-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5.5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--muted-foreground))" />
          </marker>
          <marker
            id="rule-arrow-hl"
            markerWidth="6"
            markerHeight="6"
            refX="5.5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--accent))" />
          </marker>
        </defs>

        {/* Edges */}
        {EDGES.map((e, i) => {
          const a = RULE_POS[e.from];
          const b = RULE_POS[e.to];
          if (!a || !b) return null;
          const isHl = highlightSet.has(e.from) && highlightSet.has(e.to);
          return (
            <path
              key={i}
              d={curvePath(a, b)}
              fill="none"
              stroke={isHl ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
              strokeWidth={isHl ? 2.4 : 1.2}
              opacity={isHl ? 1 : 0.65}
              markerEnd={isHl ? 'url(#rule-arrow-hl)' : 'url(#rule-arrow)'}
              style={{ transition: 'all 0.2s' }}
            />
          );
        })}

        {/* Nodes */}
        {RULES.map((r) => {
          const p = RULE_POS[r.id];
          if (!p) return null;
          const isSelected = selectedRule?.id === r.id;
          const isOnPath = highlightSet.has(r.id);
          const dim = selectedRule && !isOnPath;
          const r0 = 36 + (r.crit === 'HIGH' ? 10 : r.crit === 'MEDIUM' ? 5 : 0);
          const color = DOM_COLORS[r.dom] || SCALE_DOM_COLORS[r.dom] || '#94a3b8';
          return (
            <g
              key={r.id}
              transform={`translate(${p.x}, ${p.y})`}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              opacity={dim ? 0.3 : 1}
              onClick={() => setSelectedRule(r)}
            >
              {isSelected && <circle r={r0 + 8} fill={color} opacity={0.22} />}
              <circle r={r0} fill="hsl(var(--card))" />
              <circle r={r0} fill={color} fillOpacity={r.crit === 'HIGH' ? 0.22 : r.crit === 'MEDIUM' ? 0.14 : 0.07} />
              <circle
                r={r0}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 3.2 : isOnPath ? 2.4 : 1.8}
              />
              {/* Criticality dot top-right */}
              <circle
                cx={r0 * 0.62}
                cy={-r0 * 0.62}
                r={4}
                fill={CRIT_COLORS[r.crit]}
              />
              <text
                y={-3}
                textAnchor="middle"
                fontSize={11}
                fontWeight={800}
                fontFamily="JetBrains Mono, monospace"
                fill="hsl(var(--foreground))"
              >
                {r.id}
              </text>
              <text
                y={11}
                textAnchor="middle"
                fontSize={8}
                fontFamily="DM Sans, sans-serif"
                fill="hsl(var(--muted-foreground))"
              >
                {r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═════════════ DRILL VIEW (right panel) ══════════════════════════════════
function DrillPanel({ domain, selectedRule, setSelectedRule, onBack }) {
  const total = DOM_COUNTS_MAP[domain] || 0;
  const high = Math.round(total * 0.15);
  const files = TAL_FILES[domain] || [];
  const ruleTypes = RULE_NAMES[domain] || [];

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to All Domains
      </button>
      <h3 className="mb-1 font-serif text-2xl font-bold tracking-tight">
        <span style={{ color: SCALE_DOM_COLORS[domain] }}>{domain}</span>
      </h3>
      <p className="mb-5 text-sm text-muted-foreground">
        {total.toLocaleString()} rules in this domain
      </p>

      {/* Domain Summary card */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Domain Summary
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <SummaryStat n={total.toLocaleString()} l="Total Rules" color={SCALE_DOM_COLORS[domain]} />
            <SummaryStat n={high.toLocaleString()} l="HIGH Critical" color="#dc2626" />
            <SummaryStat n={files.length} l="TAL Files" color="#0ea5e9" />
          </div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Source Files
          </div>
          <div className="flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span
                key={f}
                className="rounded border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rule types in this domain — clickable, links to call-graph nodes */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Rule Types in this Domain
        </div>
        <div className="text-[9px] italic text-muted-foreground/80">click to trace</div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2">
        {ruleTypes.map((rn, i) => {
          const matched = matchDemoRule(rn, domain);
          const isActive = matched && selectedRule?.id === matched.id;
          return (
            <button
              key={i}
              onClick={() => matched && setSelectedRule(matched)}
              className={cn(
                'flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-left transition-all',
                matched
                  ? 'cursor-pointer hover:-translate-y-px hover:border-accent hover:shadow-sm'
                  : 'cursor-default opacity-60',
                isActive && 'border-accent bg-accent/5 shadow-sm'
              )}
              title={matched ? `Trace ${matched.id} ${matched.name}` : 'Synthesized rule (no demo data)'}
            >
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{
                  background: SCALE_DOM_COLORS[domain] + '22',
                  color: SCALE_DOM_COLORS[domain],
                }}
              >
                R{String(i + 1).padStart(3, '0')}
              </span>
              <span className="flex-1 truncate text-[11px]">{rn}</span>
              {matched && (
                <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected rule (from clicking the call graph) */}
      <AnimatePresence>
        {selectedRule && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-accent/30">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge style={{ background: DOM_COLORS[selectedRule.dom] + '22', color: DOM_COLORS[selectedRule.dom] }}>
                    {selectedRule.dom}
                  </Badge>
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: CRIT_COLORS[selectedRule.crit],
                      color: CRIT_COLORS[selectedRule.crit],
                    }}
                  >
                    {selectedRule.crit}
                  </Badge>
                  <button
                    onClick={() => setSelectedRule(null)}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
                <h4 className="font-serif text-base font-bold">
                  {selectedRule.id}: {selectedRule.name}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {selectedRule.desc}
                </p>
                <div className="mt-3 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  {selectedRule.src.r} — {selectedRule.src.f}:{selectedRule.src.l}
                </div>
                <div className="mt-2">
                  <CodeBlock code={selectedRule.tal} className="max-h-[120px] overflow-auto" />
                </div>
                <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                  Target Java
                </div>
                <CodeBlock
                  code={selectedRule.java}
                  className="mt-1 max-h-[120px] overflow-auto"
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryStat({ n, l, color }) {
  return (
    <div className="rounded-lg bg-muted p-2 text-center">
      <div className="font-serif text-lg font-bold" style={{ color }}>
        {n}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
        {l}
      </div>
    </div>
  );
}
