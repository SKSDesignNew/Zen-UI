import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { Scene } from '@/components/three/Scene';
import { GlassNode } from '@/components/three/GlassNode';
import { Edge } from '@/components/three/Edge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { compute3DLayout } from '@/lib/force-layout';
import { RULES, EDGES, DOM_COLORS, CRIT_COLORS, getPath } from '@/lib/rules';
import { SCALE_DOMS, SCALE_DOM_COLORS, DOM_COUNTS_MAP } from '@/lib/scale-data';

const CLUSTER_LINKS = [
  ['Operations', 'Authorization'], ['Authorization', 'Fraud'], ['Authorization', 'Settlement'],
  ['Fraud', 'Credit'], ['Fraud', 'Compliance'], ['Credit', 'Pricing'], ['Pricing', 'Compliance'],
  ['Compliance', 'Settlement'], ['Settlement', 'Reporting'], ['Risk', 'Fraud'],
  ['Risk', 'Compliance'], ['Security', 'Authorization'], ['Security', 'Operations'],
  ['Reporting', 'Risk'],
];

export function GraphTab() {
  const [drillDomain, setDrillDomain] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);

  // Compute 3D positions for cluster view
  const clusterPositions = useMemo(() => {
    const nodes = SCALE_DOMS.map((id) => ({ id }));
    const links = CLUSTER_LINKS.map(([source, target]) => ({ source, target }));
    return compute3DLayout(nodes, links, { iterations: 250, charge: -800, linkDistance: 25 });
  }, []);

  // Compute 3D positions for rule drill view
  const rulePositions = useMemo(() => {
    const nodes = RULES.map((r) => ({ id: r.id }));
    const links = EDGES.map((e) => ({ source: e.from, target: e.to }));
    return compute3DLayout(nodes, links, { iterations: 300, charge: -200, linkDistance: 12 });
  }, []);

  const highlightSet = useMemo(() => new Set(getPath(selectedRule)), [selectedRule]);

  return (
    <div className="relative h-[calc(100vh-120px)] w-full overflow-hidden">
      {/* Three.js canvas */}
      <Scene cameraPosition={drillDomain ? [0, 0, 60] : [0, 10, 70]}>
        {!drillDomain ? (
          // Cluster view — 10 domain glass spheres
          <>
            {CLUSTER_LINKS.map(([from, to], i) => {
              const f = clusterPositions[from];
              const t = clusterPositions[to];
              if (!f || !t) return null;
              const isHl = hoveredCluster === from || hoveredCluster === to;
              return (
                <Edge
                  key={i}
                  from={f}
                  to={t}
                  color={isHl ? '#fbbf24' : '#6366f1'}
                  highlighted={isHl}
                  radius={0.12}
                />
              );
            })}
            {SCALE_DOMS.map((d) => {
              const pos = clusterPositions[d];
              if (!pos) return null;
              const count = DOM_COUNTS_MAP[d] || 10000;
              return (
                <GlassNode
                  key={d}
                  position={pos}
                  radius={4 + (count / 20000)}
                  color={SCALE_DOM_COLORS[d]}
                  label={d}
                  sublabel={`${(count / 1000).toFixed(1)}K rules`}
                  selected={hoveredCluster === d}
                  onClick={() => setDrillDomain(d)}
                  onPointerOver={() => setHoveredCluster(d)}
                  onPointerOut={() => setHoveredCluster(null)}
                />
              );
            })}
          </>
        ) : (
          // Rule drill view — 13 glass rule nodes
          <>
            {EDGES.map((e, i) => {
              const f = rulePositions[e.from];
              const t = rulePositions[e.to];
              if (!f || !t) return null;
              const isHl = highlightSet.has(e.from) && highlightSet.has(e.to);
              return (
                <Edge
                  key={i}
                  from={f}
                  to={t}
                  color={isHl ? '#fbbf24' : DOM_COLORS[RULES.find((r) => r.id === e.from)?.dom] || '#6366f1'}
                  highlighted={isHl}
                  radius={0.07}
                />
              );
            })}
            {RULES.map((r) => {
              const pos = rulePositions[r.id];
              if (!pos) return null;
              return (
                <GlassNode
                  key={r.id}
                  position={pos}
                  radius={1.8 + (r.crit === 'HIGH' ? 0.6 : r.crit === 'MEDIUM' ? 0.3 : 0)}
                  color={DOM_COLORS[r.dom]}
                  label={r.id}
                  sublabel={r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name}
                  selected={selectedRule?.id === r.id || highlightSet.has(r.id)}
                  onClick={() => setSelectedRule(r)}
                />
              );
            })}
          </>
        )}
      </Scene>

      {/* Top-left header overlay */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <div className="pointer-events-auto rounded-xl border border-white/15 bg-black/40 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Z+Graph</span>
            {drillDomain && (
              <>
                <span className="text-white/40">›</span>
                <span className="text-xs font-bold" style={{ color: SCALE_DOM_COLORS[drillDomain] }}>
                  {drillDomain}
                </span>
              </>
            )}
            {drillDomain && (
              <button
                onClick={() => { setDrillDomain(null); setSelectedRule(null); }}
                className="ml-3 flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/80 transition-colors hover:bg-white/10"
              >
                <ArrowLeft className="h-3 w-3" />
                All Domains
              </button>
            )}
          </div>
          <div className="mt-1 text-[10px] text-white/50">
            {drillDomain
              ? `${DOM_COUNTS_MAP[drillDomain]?.toLocaleString()} rules · click any node`
              : '2K rules · 10 domains · drag to orbit · scroll to zoom'}
          </div>
        </div>
      </div>

      {/* Top-right legend overlay */}
      <div className="pointer-events-none absolute right-4 top-4 z-10">
        <div className="pointer-events-auto max-w-[200px] rounded-xl border border-white/15 bg-black/40 px-4 py-3 backdrop-blur-xl">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/60">
            {drillDomain ? 'Criticality' : 'Domains'}
          </div>
          <div className="space-y-1">
            {drillDomain
              ? Object.entries(CRIT_COLORS).map(([k, c]) => (
                  <div key={k} className="flex items-center gap-2 text-[10px] text-white/80">
                    <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                    {k}
                  </div>
                ))
              : SCALE_DOMS.slice(0, 6).map((d) => (
                  <div key={d} className="flex items-center gap-2 text-[10px] text-white/80">
                    <span className="h-2 w-2 rounded-full" style={{ background: SCALE_DOM_COLORS[d] }} />
                    {d}
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* Right-side rule detail panel */}
      <AnimatePresence>
        {selectedRule && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="absolute right-4 top-24 z-10 w-[380px] max-h-[calc(100vh-180px)] overflow-auto rounded-2xl border border-white/15 bg-black/50 p-5 backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge style={{ background: DOM_COLORS[selectedRule.dom] + '33', color: DOM_COLORS[selectedRule.dom] }}>
                    {selectedRule.dom}
                  </Badge>
                  <Badge variant="outline" style={{ borderColor: CRIT_COLORS[selectedRule.crit], color: CRIT_COLORS[selectedRule.crit] }}>
                    {selectedRule.crit}
                  </Badge>
                </div>
                <h3 className="font-serif text-lg font-bold text-white">
                  {selectedRule.id}: {selectedRule.name}
                </h3>
              </div>
              <button onClick={() => setSelectedRule(null)} className="text-white/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-white/70">{selectedRule.desc}</p>

            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
              {selectedRule.src.r} — {selectedRule.src.f}:{selectedRule.src.l}
            </div>
            <CodeBlock code={selectedRule.tal} className="mb-3 max-h-[140px] overflow-auto" />

            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">Target Java</div>
            <CodeBlock code={selectedRule.java} className="max-h-[140px] overflow-auto" />

            <div className="mt-4 space-y-1 text-[11px]">
              <div>
                <span className="font-semibold text-white/80">Depends: </span>
                {selectedRule.deps.length ? selectedRule.deps.join(', ') : <em className="text-white/40">none</em>}
              </div>
              <div>
                <span className="font-semibold text-white/80">Triggers: </span>
                {selectedRule.trig.length ? selectedRule.trig.join(', ') : <em className="text-white/40">terminal</em>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom hint */}
      {!selectedRule && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-[10px] text-white/60 backdrop-blur-xl">
          {drillDomain ? 'Click any rule to inspect its source TAL and Java' : 'Click any glass cluster to drill into its 13 rules'}
        </div>
      )}
    </div>
  );
}
