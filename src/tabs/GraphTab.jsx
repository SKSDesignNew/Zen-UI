import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Scene } from '@/components/three/Scene';
import { GlassNode } from '@/components/three/GlassNode';
import { Edge } from '@/components/three/Edge';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { compute3DLayout } from '@/lib/force-layout';
import { RULES, DOM_COLORS, CRIT_COLORS } from '@/lib/rules';
import { SCALE_DOMS, SCALE_DOM_COLORS, RULE_NAMES, TAL_FILES } from '@/lib/scale-data';

const TOTAL_RULES = 50;
const TOTAL_EDGES = 100;

const DOMAIN_NEIGHBORS = {
  Authorization: ['Fraud', 'Credit', 'Settlement'],
  Fraud: ['Authorization', 'Risk', 'Compliance'],
  Credit: ['Authorization', 'Pricing'],
  Pricing: ['Credit', 'Settlement'],
  Compliance: ['Fraud', 'Reporting'],
  Settlement: ['Authorization', 'Pricing', 'Reporting'],
  Reporting: ['Settlement', 'Compliance', 'Risk'],
  Risk: ['Fraud', 'Reporting'],
  Operations: ['Authorization', 'Settlement', 'Security'],
  Security: ['Authorization', 'Operations'],
};

// Build 50 rules: the 13 hand-authored RULES (with rich TAL/Java) + 37 generated.
function buildGraph() {
  const seed = (i) => (Math.sin(i * 9301 + 49297) % 1 + 1) % 1;

  // Start with the 13 hand-authored rules — these have the rich TAL/Java/desc payload
  const featured = RULES.map((r) => ({ ...r, featured: true }));

  // Generate 37 more rules across all 10 domains
  const generated = [];
  for (let i = 0; i < TOTAL_RULES - featured.length; i++) {
    const dom = SCALE_DOMS[Math.floor(seed(i + 100) * SCALE_DOMS.length)];
    const names = RULE_NAMES[dom];
    const name = names[Math.floor(seed(i + 200) * names.length)];
    const files = TAL_FILES[dom];
    const file = files[Math.floor(seed(i + 300) * files.length)];
    const crits = ['HIGH', 'MEDIUM', 'LOW'];
    const s = seed(i + 400);
    const crit = crits[s < 0.2 ? 0 : s < 0.55 ? 1 : 2];
    const lineStart = Math.floor(seed(i + 500) * 2000) + 1;
    const id = `R${String(i + 14).padStart(3, '0')}`;
    generated.push({
      id,
      name,
      dom,
      crit,
      type: seed(i + 600) < 0.85 ? 'code' : 'document',
      featured: false,
      src: { f: file, l: `${lineStart}–${lineStart + Math.floor(seed(i + 700) * 80) + 20}`, r: name.toUpperCase().replace(/\s+/g, '^') },
      desc: `Generated rule for ${dom} domain — represents one of thousands of similar routines extracted from legacy TAL.`,
      deps: [], trig: [],
    });
  }

  const all = [...featured, ...generated];

  // Build 100 edges. Start by including the existing call graph between the 13 RULES, then synthesize the rest.
  const seen = new Set();
  const links = [];
  const addEdge = (from, to) => {
    if (from === to) return;
    const key = from < to ? `${from}-${to}` : `${to}-${from}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ source: from, target: to });
  };

  // Featured edges (R001 → R002 → R003 etc.)
  for (const r of featured) for (const t of r.trig) addEdge(r.id, t);

  // Bucket all rule ids by domain for fast random selection.
  // Featured RULES include domains (e.g. "Validation") that aren't in SCALE_DOMS,
  // so initialize buckets dynamically from the rules themselves.
  const byDomain = {};
  for (const r of all) {
    if (!byDomain[r.dom]) byDomain[r.dom] = [];
    byDomain[r.dom].push(r.id);
  }

  // Pad with synthesized edges until we hit TOTAL_EDGES
  let i = 0;
  while (links.length < TOTAL_EDGES && i < TOTAL_RULES * 6) {
    const src = all[i % TOTAL_RULES];
    const cross = seed(i * 0.7) > 0.6;
    const targetDom = cross
      ? (DOMAIN_NEIGHBORS[src.dom] || [src.dom])[Math.floor(seed(i * 1.3) * 3)]
      : src.dom;
    const pool = byDomain[targetDom] || [];
    if (pool.length > 0) {
      const tgt = pool[Math.floor(seed(i * 2.1) * pool.length)];
      addEdge(src.id, tgt);
    }
    i++;
  }

  return { rules: all, edges: links };
}

export function GraphTab() {
  const [selected, setSelected] = useState(null);

  const { rules, edges } = useMemo(buildGraph, []);

  // 3D force-directed layout
  const positions = useMemo(() => {
    const nodes = rules.map((r) => ({ id: r.id }));
    const links = edges.map((e) => ({ source: e.source, target: e.target }));
    return compute3DLayout(nodes, links, { iterations: 400, charge: -35, linkDistance: 4 });
  }, [rules, edges]);

  // Highlight set: selected rule + its direct neighbors
  const highlightSet = useMemo(() => {
    if (!selected) return new Set();
    const s = new Set([selected.id]);
    edges.forEach((e) => {
      if (e.source === selected.id) s.add(e.target);
      if (e.target === selected.id) s.add(e.source);
    });
    return s;
  }, [selected, edges]);

  const ruleById = useMemo(() => Object.fromEntries(rules.map((r) => [r.id, r])), [rules]);

  return (
    <div className="relative h-[calc(100vh-120px)] w-full overflow-hidden">
      <Scene cameraPosition={[0, 0, 130]}>
        {edges.map((e, i) => {
          const f = positions[e.source];
          const t = positions[e.target];
          if (!f || !t) return null;
          const isHl = highlightSet.has(e.source) && highlightSet.has(e.target);
          const sourceRule = ruleById[e.source];
          return (
            <Edge
              key={i}
              from={f}
              to={t}
              color={isHl ? '#fbbf24' : DOM_COLORS[sourceRule?.dom] || SCALE_DOM_COLORS[sourceRule?.dom] || '#6366f1'}
              highlighted={isHl}
              radius={0.06}
            />
          );
        })}
        {rules.map((r) => {
          const pos = positions[r.id];
          if (!pos) return null;
          const radius = 1.8 + (r.crit === 'HIGH' ? 0.7 : r.crit === 'MEDIUM' ? 0.3 : 0);
          return (
            <GlassNode
              key={r.id}
              position={pos}
              radius={radius}
              color={DOM_COLORS[r.dom] || SCALE_DOM_COLORS[r.dom] || '#6366f1'}
              label={r.id}
              sublabel={r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name}
              selected={selected?.id === r.id || highlightSet.has(r.id)}
              onClick={() => setSelected(r)}
            />
          );
        })}
      </Scene>

      {/* Top-left header */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/40 px-4 py-3 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg font-bold text-white">Z+Graph</span>
            <Badge variant="accent" className="text-[10px]">3D Glass Web</Badge>
          </div>
          <div className="mt-1 text-[10px] text-white/60">
            {TOTAL_RULES} rules · {TOTAL_EDGES} connections · drag to orbit · scroll to zoom
          </div>
        </div>
      </div>

      {/* Top-right legend */}
      <div className="pointer-events-none absolute right-4 top-4 z-10">
        <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/40 px-4 py-3 backdrop-blur-2xl">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/60">Domains</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {SCALE_DOMS.slice(0, 10).map((d) => (
              <div key={d} className="flex items-center gap-1.5 text-[10px] text-white/80">
                <span className="h-2 w-2 rounded-full" style={{ background: SCALE_DOM_COLORS[d] }} />
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right rule detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="absolute right-4 top-24 z-10 w-[380px] max-h-[calc(100vh-180px)] overflow-auto rounded-2xl border border-white/15 bg-black/50 p-5 backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge style={{ background: (DOM_COLORS[selected.dom] || SCALE_DOM_COLORS[selected.dom]) + '33', color: DOM_COLORS[selected.dom] || SCALE_DOM_COLORS[selected.dom] }}>
                    {selected.dom}
                  </Badge>
                  <Badge variant="outline" style={{ borderColor: CRIT_COLORS[selected.crit], color: CRIT_COLORS[selected.crit] }}>
                    {selected.crit}
                  </Badge>
                </div>
                <h3 className="font-serif text-lg font-bold text-white">
                  {selected.id}: {selected.name}
                </h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-white/70">{selected.desc}</p>

            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
              {selected.src.r} — {selected.src.f}:{selected.src.l}
            </div>

            {selected.featured ? (
              <>
                <CodeBlock code={selected.tal} className="mb-3 max-h-[140px] overflow-auto" />
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">Target Java</div>
                <CodeBlock code={selected.java} className="max-h-[140px] overflow-auto" />
              </>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-[11px] text-white/70">
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/50">Status</div>
                Synthesized rule. Source TAL and target Java are extracted from {selected.src.f} during the migration sandbox phase.
              </div>
            )}

            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-2 text-[10px] text-white/70">
              ✓ One of {TOTAL_RULES} rules in this view · {TOTAL_EDGES} dependency edges total · click an empty area to deselect.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom hint */}
      {!selected && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-[10px] text-white/60 backdrop-blur-xl">
          Click any glass node to inspect its rule, source, and dependencies
        </div>
      )}
    </div>
  );
}
