import { useEffect, useMemo, useRef, useState } from 'react';
import { Cosmograph } from '@cosmograph/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Maximize2, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SCALE_DOMS, SCALE_DOM_COLORS, DOM_COUNTS_MAP, RULE_NAMES, TAL_FILES,
  genScaleRules, genScaleEdges,
} from '@/lib/scale-data';
import { CRIT_COLORS } from '@/lib/rules';
import { cn } from '@/lib/utils';

// Convert hex to [r,g,b,a] in 0-1 range for Cosmograph
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
    alpha,
  ];
}

export function ZG2Tab() {
  const cosmographRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ points: [], links: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [domFilter, setDomFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  // Generate 100K rules + ~300K edges asynchronously so the UI stays responsive
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Defer to next tick so the spinner can paint first
    const id = setTimeout(() => {
      const rules = genScaleRules();
      const edges = genScaleEdges(rules);
      if (cancelled) return;
      // Cosmograph requires both an id column and a sequential integer index column.
      const idToIndex = new Map();
      const points = rules.map((r, i) => {
        idToIndex.set(r.id, i);
        return {
          index: i,
          id: r.id,
          name: r.name,
          dom: r.dom,
          crit: r.crit,
          file: r.file,
          lines: r.lines,
          type: r.type,
          color: SCALE_DOM_COLORS[r.dom],
          size: r.crit === 'HIGH' ? 6 : r.crit === 'MEDIUM' ? 4 : 3,
        };
      });
      // Cosmograph wants link source/target as numeric indices for fastest path.
      const links = [];
      for (let k = 0; k < edges.length; k++) {
        const s = idToIndex.get(edges[k].source);
        const t = idToIndex.get(edges[k].target);
        if (s !== undefined && t !== undefined) {
          links.push({ sourceIndex: s, targetIndex: t });
        }
      }
      setData({ points, links });
      setLoading(false);
    }, 60);
    return () => { cancelled = true; clearTimeout(id); };
  }, []);

  // Domain filter passes a per-point opacity scaled into the color column
  const filteredPoints = useMemo(() => {
    if (!data.points.length) return data.points;
    if (domFilter === 'All') return data.points;
    return data.points.map((p) => ({
      ...p,
      color: p.dom === domFilter ? SCALE_DOM_COLORS[p.dom] : '#1a1f2e',
    }));
  }, [data.points, domFilter]);

  // Search → focus the matching point
  const onSearch = (term) => {
    setSearchTerm(term);
    if (!term || !cosmographRef.current) return;
    const idx = data.points.findIndex(
      (p) => p.id.toLowerCase() === term.toLowerCase() || p.name.toLowerCase().includes(term.toLowerCase())
    );
    if (idx >= 0) {
      try {
        cosmographRef.current.focusPoint?.(idx);
        cosmographRef.current.zoomToPointByIndex?.(idx, 800, 4, true);
      } catch {}
    }
  };

  const onPointClick = (index) => {
    if (index == null) { setSelected(null); return; }
    const p = data.points[index];
    if (p) setSelected(p);
  };

  return (
    <div className="relative h-[calc(100vh-120px)] w-full overflow-hidden bg-[#0a0e1a]">
      {/* Cosmograph canvas */}
      {!loading && (
        <Cosmograph
          ref={cosmographRef}
          points={filteredPoints}
          links={data.links}
          pointIdBy="id"
          pointIndexBy="index"
          pointColorBy="color"
          pointLabelBy="id"
          pointSizeBy="size"
          linkSourceBy="sourceIndex"
          linkSourceIndexBy="sourceIndex"
          linkTargetBy="targetIndex"
          linkTargetIndexBy="targetIndex"
          backgroundColor="#0a0e1a"
          linkColor={[1, 1, 1, 0.06]}
          linkWidth={0.4}
          linkArrows={false}
          enableSimulation={true}
          simulationGravity={0.25}
          simulationRepulsion={1.0}
          simulationLinkSpring={1.0}
          simulationLinkDistance={3}
          simulationDecay={5000}
          fitViewOnInit={true}
          fitViewDelay={1000}
          showFPSMonitor={false}
          hoveredPointCursor="pointer"
          renderHoveredPointRing={true}
          hoveredPointRingColor="#fbbf24"
          focusedPointRingColor="#fbbf24"
          onClick={onPointClick}
          style={{ width: '100%', height: '100%' }}
        />
      )}

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
              Generating 100,000 rules
            </div>
            <div className="mt-1 text-sm text-white/60">
              Building dependency graph with ~300K edges…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-left header */}
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/50 px-4 py-3 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="font-serif text-lg font-bold text-white">Z+G2</div>
            <Badge variant="accent" className="text-[10px]">Full Call Graph</Badge>
          </div>
          <div className="mt-1 text-[10px] text-white/60">
            {loading
              ? 'Loading…'
              : `${data.points.length.toLocaleString()} rules · ${data.links.length.toLocaleString()} dependencies · GPU force simulation`}
          </div>
        </div>
      </div>

      {/* Top-center search */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-2 py-1.5 backdrop-blur-2xl">
          <Search className="ml-2 h-3.5 w-3.5 text-white/50" />
          <input
            type="text"
            placeholder="Search rule R000123 or name…"
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
            onClick={() => cosmographRef.current?.fitView?.(800)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-2xl hover:bg-white/10"
          >
            <Maximize2 className="h-3 w-3" /> Fit View
          </button>
          <button
            onClick={() => cosmographRef.current?.start?.()}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-2xl hover:bg-white/10"
          >
            ▶ Restart Sim
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
              All ({(100000).toLocaleString()})
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
                <span className="opacity-60">{(DOM_COUNTS_MAP[d] / 1000).toFixed(0)}K</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected point detail panel */}
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
              ✓ One of {(100000).toLocaleString()} rules in the governed repository.
              Click another node or press <kbd className="rounded border border-white/20 px-1">Esc</kbd> to deselect.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
