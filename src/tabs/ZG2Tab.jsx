import { useEffect, useMemo, useRef, useState } from 'react';
import { Graph } from '@cosmos.gl/graph';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Maximize2, Filter, Play, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  SCALE_DOMS, SCALE_DOM_COLORS, DOM_COUNTS_MAP,
  genScaleRules, genScaleEdges,
} from '@/lib/scale-data';
import { CRIT_COLORS } from '@/lib/rules';
import { cn } from '@/lib/utils';

// Convert hex color string to [r,g,b,a] in 0-1 range
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
    alpha,
  ];
}

const SIZE_BY_CRIT = { HIGH: 6, MEDIUM: 4, LOW: 2.5 };
const GREY_COLOR = [0.1, 0.12, 0.18, 0.4];
const SPACE_SIZE = 4096;

export function ZG2Tab() {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const dataRef = useRef(null); // { rules, edges, baseColors, sizes }
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('Generating rules…');
  const [searchTerm, setSearchTerm] = useState('');
  const [domFilter, setDomFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [isSimRunning, setIsSimRunning] = useState(true);

  // Generate data, build typed arrays, mount Graph instance
  useEffect(() => {
    let cancelled = false;
    let graph = null;

    const init = async () => {
      // Defer to next tick so the loader paints
      await new Promise((r) => setTimeout(r, 50));
      setProgress('Generating 100,000 rules…');
      const rules = genScaleRules();
      if (cancelled) return;

      await new Promise((r) => setTimeout(r, 50));
      setProgress('Building dependency graph…');
      const edges = genScaleEdges(rules);
      if (cancelled) return;

      await new Promise((r) => setTimeout(r, 50));
      setProgress('Allocating GPU buffers…');

      const N = rules.length;
      // Initial random positions in a centered square
      const positions = new Float32Array(N * 2);
      const baseColors = new Float32Array(N * 4);
      const sizes = new Float32Array(N);
      const colorByDom = {};
      for (const d of SCALE_DOMS) colorByDom[d] = hexToRgba(SCALE_DOM_COLORS[d], 1);

      for (let i = 0; i < N; i++) {
        // Random scatter — force simulation will organize
        positions[i * 2] = (Math.random() - 0.5) * SPACE_SIZE * 0.6;
        positions[i * 2 + 1] = (Math.random() - 0.5) * SPACE_SIZE * 0.6;
        const c = colorByDom[rules[i].dom];
        baseColors[i * 4] = c[0];
        baseColors[i * 4 + 1] = c[1];
        baseColors[i * 4 + 2] = c[2];
        baseColors[i * 4 + 3] = c[3];
        sizes[i] = SIZE_BY_CRIT[rules[i].crit];
      }

      // Build id→index map and links Float32Array (source0, target0, source1, target1, ...)
      const idToIndex = new Map();
      for (let i = 0; i < N; i++) idToIndex.set(rules[i].id, i);
      const links = new Float32Array(edges.length * 2);
      let validLinks = 0;
      for (let k = 0; k < edges.length; k++) {
        const s = idToIndex.get(edges[k].source);
        const t = idToIndex.get(edges[k].target);
        if (s !== undefined && t !== undefined) {
          links[validLinks * 2] = s;
          links[validLinks * 2 + 1] = t;
          validLinks++;
        }
      }
      const trimmedLinks = links.slice(0, validLinks * 2);
      if (cancelled) return;

      setProgress('Initializing GPU…');
      await new Promise((r) => setTimeout(r, 50));

      if (!containerRef.current) return;

      // Build the Cosmos graph
      graph = new Graph(containerRef.current, {
        backgroundColor: '#0a0e1a',
        spaceSize: SPACE_SIZE,
        pointSizeScale: 1,
        renderHoveredPointRing: true,
        hoveredPointRingColor: '#fbbf24',
        focusedPointRingColor: '#fbbf24',
        renderLinks: true,
        linkColor: [1, 1, 1, 0.04],
        linkWidth: 0.4,
        linkArrows: false,
        curvedLinks: false,
        enableSimulation: true,
        simulationGravity: 0.25,
        simulationRepulsion: 1.0,
        simulationLinkSpring: 1.0,
        simulationLinkDistance: 3,
        simulationFriction: 0.85,
        simulationDecay: 5000,
        showFPSMonitor: false,
        scalePointsOnZoom: true,
        onClick: (index) => {
          if (index == null) {
            setSelected(null);
            return;
          }
          const rule = dataRef.current?.rules[index];
          if (rule) setSelected(rule);
        },
        onSimulationStart: () => setIsSimRunning(true),
        onSimulationEnd: () => setIsSimRunning(false),
        onSimulationPause: () => setIsSimRunning(false),
        onSimulationUnpause: () => setIsSimRunning(true),
      });

      graphRef.current = graph;
      dataRef.current = { rules, edges, baseColors, sizes, idToIndex };

      graph.setPointPositions(positions);
      graph.setPointColors(baseColors);
      graph.setPointSizes(sizes);
      graph.setLinks(trimmedLinks);
      graph.render();
      graph.start();
      // Fit view after layout starts
      setTimeout(() => graph?.fitView?.(800), 600);

      setLoading(false);
    };

    init();

    return () => {
      cancelled = true;
      try { graph?.destroy?.(); } catch {}
      graphRef.current = null;
      dataRef.current = null;
    };
  }, []);

  // Apply domain filter by mutating point colors in place
  useEffect(() => {
    const g = graphRef.current;
    const d = dataRef.current;
    if (!g || !d) return;
    const N = d.rules.length;
    const colors = new Float32Array(N * 4);
    if (domFilter === 'All') {
      colors.set(d.baseColors);
    } else {
      for (let i = 0; i < N; i++) {
        const inFilter = d.rules[i].dom === domFilter;
        const src = inFilter ? d.baseColors : GREY_COLOR;
        const off = inFilter ? i * 4 : 0;
        colors[i * 4] = inFilter ? src[off] : src[0];
        colors[i * 4 + 1] = inFilter ? src[off + 1] : src[1];
        colors[i * 4 + 2] = inFilter ? src[off + 2] : src[2];
        colors[i * 4 + 3] = inFilter ? src[off + 3] : src[3];
      }
    }
    g.setPointColors(colors);
    g.render();
  }, [domFilter]);

  // Search → focus matching point
  const onSearch = (term) => {
    setSearchTerm(term);
    const g = graphRef.current;
    const d = dataRef.current;
    if (!term || !g || !d) return;
    const t = term.toUpperCase();
    let idx = d.idToIndex.get(t);
    if (idx === undefined) {
      const lower = term.toLowerCase();
      idx = d.rules.findIndex((r) => r.name.toLowerCase().includes(lower));
    }
    if (idx !== undefined && idx >= 0) {
      try {
        g.zoomToPointByIndex?.(idx, 800, 6, true);
        g.setFocusedPointByIndex?.(idx);
      } catch {}
    }
  };

  const togglePlay = () => {
    const g = graphRef.current;
    if (!g) return;
    if (isSimRunning) g.pause();
    else g.start();
  };

  return (
    <div className="relative h-[calc(100vh-120px)] w-full overflow-hidden bg-[#0a0e1a]">
      {/* Cosmos canvas mount point */}
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
            <div className="mt-4 font-serif text-2xl font-bold text-white">{progress}</div>
            <div className="mt-1 text-sm text-white/60">100,000 rules · 300,000 dependencies · GPU force simulation</div>
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
            {loading ? 'Loading…' : '100,000 rules · 300,000 dependencies · GPU force simulation'}
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
            onClick={() => graphRef.current?.fitView?.(800)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-2xl hover:bg-white/10"
          >
            <Maximize2 className="h-3 w-3" /> Fit View
          </button>
          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-semibold text-white/80 backdrop-blur-2xl hover:bg-white/10"
          >
            {isSimRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isSimRunning ? 'Pause Sim' : 'Start Sim'}
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
