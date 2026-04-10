import { useEffect, useMemo, useRef, useState } from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network.js';
import { DataSet } from 'vis-data/standalone/esm/vis-data.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Maximize2, Filter, Play, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  SCALE_DOMS, SCALE_DOM_COLORS, RULE_NAMES, TAL_FILES,
} from '@/lib/scale-data';
import { CRIT_COLORS } from '@/lib/rules';
import { cn } from '@/lib/utils';

const TOTAL_RULES = 500;
const TOTAL_EDGES = 1000;

const SIZE_BY_CRIT = { HIGH: 22, MEDIUM: 14, LOW: 9 };

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

// Local generator — 500 rules, ~1000 edges, deterministic seed
function generateData() {
  const seed = (i) => (Math.sin(i * 9301 + 49297) % 1 + 1) % 1;
  const rules = [];
  for (let i = 0; i < TOTAL_RULES; i++) {
    const dom = SCALE_DOMS[Math.floor(seed(i) * 10)];
    const names = RULE_NAMES[dom];
    const name = names[Math.floor(seed(i + 1) * names.length)];
    const files = TAL_FILES[dom];
    const file = files[Math.floor(seed(i + 2) * files.length)];
    const crits = ['HIGH', 'MEDIUM', 'LOW'];
    const s3 = seed(i + 3);
    const crit = crits[s3 < 0.15 ? 0 : s3 < 0.5 ? 1 : 2];
    const lineStart = Math.floor(seed(i + 4) * 2000) + 1;
    const variant = Math.floor(i / 20);
    rules.push({
      id: `R${String(i + 1).padStart(4, '0')}`,
      name: `${name}${variant > 0 ? ' v' + variant : ''}`,
      dom, crit,
      type: seed(i + 5) < 0.85 ? 'code' : 'document',
      file,
      lines: `${lineStart}–${lineStart + Math.floor(seed(i + 6) * 120) + 20}`,
    });
  }

  const byDomain = {};
  SCALE_DOMS.forEach((d) => { byDomain[d] = []; });
  rules.forEach((r, i) => byDomain[r.dom].push(i));

  const edgeSeed = (i) => (Math.sin(i * 12.9898 + 78.233) % 1 + 1) % 1;
  const edges = [];
  const seen = new Set();
  for (let i = 0; i < TOTAL_RULES; i++) {
    if (edges.length >= TOTAL_EDGES) break;
    const r = rules[i];
    const s = edgeSeed(i + 0.7);
    const triggerCount = s < 0.2 ? 1 : s < 0.6 ? 2 : s < 0.85 ? 3 : 4;
    const neighbors = DOMAIN_NEIGHBORS[r.dom] || [r.dom];
    for (let k = 0; k < triggerCount; k++) {
      if (edges.length >= TOTAL_EDGES) break;
      const cross = edgeSeed(i * 7 + k * 3.1) > 0.65;
      const targetDom = cross ? neighbors[Math.floor(edgeSeed(i * 11 + k) * neighbors.length)] : r.dom;
      const pool = byDomain[targetDom];
      if (!pool || pool.length === 0) continue;
      const targetIdx = pool[Math.floor(edgeSeed(i * 13 + k * 5) * pool.length)];
      if (targetIdx === i) continue;
      const key = i < targetIdx ? `${i}-${targetIdx}` : `${targetIdx}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: rules[i].id, to: rules[targetIdx].id });
    }
  }
  return { rules, edges };
}

export function OrganicWebTab() {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const dataRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [domFilter, setDomFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [physicsOn, setPhysicsOn] = useState(true);

  const { rules, edges } = useMemo(generateData, []);

  // Initialize the vis-network instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const nodesDataset = new DataSet(
      rules.map((r) => ({
        id: r.id,
        label: r.id,
        title: `${r.id} — ${r.name}`,
        size: SIZE_BY_CRIT[r.crit],
        color: {
          background: SCALE_DOM_COLORS[r.dom],
          border: '#ffffff',
          highlight: { background: '#fbbf24', border: '#ffffff' },
          hover: { background: '#fbbf24', border: '#ffffff' },
        },
        font: {
          color: '#ffffff',
          size: r.crit === 'HIGH' ? 11 : 8,
          face: 'JetBrains Mono, monospace',
          strokeWidth: 0,
          vadjust: 0,
        },
        borderWidth: 1.5,
        shadow: {
          enabled: true,
          color: SCALE_DOM_COLORS[r.dom],
          size: 18,
          x: 0, y: 0,
        },
        _dom: r.dom,
        _crit: r.crit,
      }))
    );

    const edgesDataset = new DataSet(
      edges.map((e, i) => {
        const sourceDom = rules.find((r) => r.id === e.from)?.dom;
        const color = SCALE_DOM_COLORS[sourceDom] || '#94a3b8';
        return {
          id: `e${i}`,
          from: e.from,
          to: e.to,
          color: { color: color + '55', highlight: '#fbbf24', hover: '#fbbf24' },
          width: 0.8,
          smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
          selectionWidth: 2,
        };
      })
    );

    const options = {
      autoResize: true,
      height: '100%',
      width: '100%',
      interaction: {
        hover: true,
        tooltipDelay: 200,
        navigationButtons: false,
        keyboard: false,
        zoomView: true,
        dragView: true,
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -55,
          centralGravity: 0.012,
          springLength: 90,
          springConstant: 0.08,
          damping: 0.5,
          avoidOverlap: 0.6,
        },
        stabilization: {
          enabled: true,
          iterations: 250,
          updateInterval: 25,
          fit: true,
        },
        timestep: 0.4,
        adaptiveTimestep: true,
      },
      nodes: {
        shape: 'dot',
        scaling: { min: 8, max: 30 },
      },
      edges: {
        smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
      },
    };

    const network = new Network(containerRef.current, { nodes: nodesDataset, edges: edgesDataset }, options);
    networkRef.current = network;
    dataRef.current = { rules, edges, nodesDataset, edgesDataset };

    network.on('stabilizationProgress', () => {
      // (could surface progress here if desired)
    });
    network.once('stabilizationIterationsDone', () => {
      setLoading(false);
    });

    network.on('selectNode', (params) => {
      const id = params.nodes[0];
      const rule = rules.find((r) => r.id === id);
      if (rule) setSelected(rule);
    });
    network.on('deselectNode', () => setSelected(null));
    network.on('click', (params) => {
      if (!params.nodes.length) setSelected(null);
    });

    return () => {
      try { network.destroy(); } catch {}
      networkRef.current = null;
      dataRef.current = null;
    };
  }, [rules, edges]);

  // Domain filter — recolor nodes/edges in place
  useEffect(() => {
    const d = dataRef.current;
    if (!d) return;
    const { nodesDataset, edgesDataset, rules } = d;

    nodesDataset.update(
      rules.map((r) => {
        const inFilter = domFilter === 'All' || r.dom === domFilter;
        const baseColor = inFilter ? SCALE_DOM_COLORS[r.dom] : '#1a1f2e';
        return {
          id: r.id,
          color: {
            background: baseColor,
            border: inFilter ? '#ffffff' : '#1a1f2e',
            highlight: { background: '#fbbf24', border: '#ffffff' },
            hover: { background: '#fbbf24', border: '#ffffff' },
          },
          shadow: { enabled: inFilter, color: SCALE_DOM_COLORS[r.dom], size: 18, x: 0, y: 0 },
          font: { color: inFilter ? '#ffffff' : '#1a1f2e' },
        };
      })
    );

    edgesDataset.forEach((e) => {
      const sourceRule = rules.find((r) => r.id === e.from);
      const targetRule = rules.find((r) => r.id === e.to);
      const visible =
        domFilter === 'All' ||
        sourceRule?.dom === domFilter ||
        targetRule?.dom === domFilter;
      const color = SCALE_DOM_COLORS[sourceRule?.dom] || '#94a3b8';
      edgesDataset.update({
        id: e.id,
        color: { color: visible ? color + '55' : '#1a1f2e22', highlight: '#fbbf24', hover: '#fbbf24' },
      });
    });
  }, [domFilter]);

  const onSearch = (term) => {
    setSearchTerm(term);
    if (!term || !networkRef.current) return;
    const t = term.toUpperCase();
    let match = rules.find((r) => r.id.toUpperCase() === t);
    if (!match) {
      const lower = term.toLowerCase();
      match = rules.find((r) => r.name.toLowerCase().includes(lower));
    }
    if (match) {
      try {
        networkRef.current.focus(match.id, {
          scale: 1.6,
          animation: { duration: 800, easingFunction: 'easeInOutQuad' },
        });
        networkRef.current.selectNodes([match.id]);
        setSelected(match);
      } catch {}
    }
  };

  const togglePhysics = () => {
    const n = networkRef.current;
    if (!n) return;
    const next = !physicsOn;
    n.setOptions({ physics: { enabled: next } });
    setPhysicsOn(next);
  };

  const fitView = () => {
    networkRef.current?.fit({ animation: { duration: 600, easingFunction: 'easeInOutQuad' } });
  };

  // Domain counts (computed from local 500-rule dataset)
  const domCounts = useMemo(() => {
    const m = {};
    SCALE_DOMS.forEach((d) => { m[d] = 0; });
    rules.forEach((r) => { m[r.dom]++; });
    return m;
  }, [rules]);

  return (
    <div className="relative h-[calc(100vh-120px)] w-full overflow-hidden bg-[#0a0e1a]">
      {/* Vis-network mount point */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0e1a]"
          >
            <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
            <div className="mt-4 font-serif text-2xl font-bold text-white">
              Stabilizing organic web…
            </div>
            <div className="mt-1 text-sm text-white/60">
              500 rules · 1,000 dependencies · ForceAtlas2 physics
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-left header */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/50 px-4 py-3 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="font-serif text-lg font-bold text-white">Organic Web</div>
            <Badge variant="accent" className="text-[10px]">vis-network</Badge>
          </div>
          <div className="mt-1 text-[10px] text-white/60">
            500 rules · 1,000 dependencies · ForceAtlas2 simulation
          </div>
        </div>
      </div>

      {/* Top-center search */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-2 py-1.5 backdrop-blur-2xl">
          <Search className="ml-2 h-3.5 w-3.5 text-white/50" />
          <input
            type="text"
            placeholder="Search rule R0123 or name…"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className="w-[280px] bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => onSearch('')} className="text-white/50 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Top-right controls */}
      <div className="pointer-events-none absolute right-4 top-4 z-10">
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            onClick={fitView}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-2xl hover:bg-white/10"
          >
            <Maximize2 className="h-3 w-3" /> Fit View
          </button>
          <button
            onClick={togglePhysics}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-2xl hover:bg-white/10"
          >
            {physicsOn ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {physicsOn ? 'Freeze Layout' : 'Resume Physics'}
          </button>
        </div>
      </div>

      {/* Bottom domain filter chips */}
      {!loading && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
          <div className="pointer-events-auto flex max-w-[90vw] flex-wrap items-center gap-1.5 rounded-2xl border border-white/15 bg-black/50 px-3 py-2 backdrop-blur-2xl">
            <Filter className="h-3 w-3 text-white/50" />
            <button
              onClick={() => setDomFilter('All')}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] font-semibold transition-colors',
                domFilter === 'All' ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10'
              )}
            >
              All ({TOTAL_RULES})
            </button>
            {SCALE_DOMS.map((d) => (
              <button
                key={d}
                onClick={() => setDomFilter(domFilter === d ? 'All' : d)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors',
                  domFilter === d ? 'text-white' : 'text-white/60 hover:bg-white/10'
                )}
                style={domFilter === d ? { background: SCALE_DOM_COLORS[d] + '40' } : {}}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: SCALE_DOM_COLORS[d] }} />
                {d}
                <span className="opacity-60">{domCounts[d]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected rule detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="absolute right-4 top-24 z-10 w-[340px] rounded-2xl border border-white/15 bg-black/55 p-5 backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: SCALE_DOM_COLORS[selected.dom] + '33', color: SCALE_DOM_COLORS[selected.dom] }}
                  >
                    {selected.dom}
                  </span>
                  <span
                    className="rounded border px-2 py-0.5 text-[10px] font-bold"
                    style={{ borderColor: CRIT_COLORS[selected.crit], color: CRIT_COLORS[selected.crit] }}
                  >
                    {selected.crit}
                  </span>
                </div>
                <h3 className="font-mono text-sm font-bold text-amber-400">{selected.id}</h3>
                <h4 className="font-serif text-base font-semibold text-white">{selected.name}</h4>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-[11px]">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">Source File</div>
                <div className="font-mono text-white/85">{selected.file}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">Line Range</div>
                <div className="font-mono text-white/85">{selected.lines}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">Type</div>
                <div className="text-white/85">{selected.type === 'code' ? 'Code Rule' : 'Document Rule'}</div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-2 text-[10px] text-white/70">
              ✓ One of {TOTAL_RULES} rules in the governed repository.
              Drag the node to perturb the web — it springs back into place.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
