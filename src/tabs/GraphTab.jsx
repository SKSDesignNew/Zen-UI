import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap, MarkerType,
  useNodesState, useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code-block';
import { RULES, EDGES, DOM_COLORS, CRIT_COLORS, getPath } from '@/lib/rules';
import { SCALE_DOMS, SCALE_DOM_COLORS, DOM_COUNTS_MAP, RULE_NAMES, TAL_FILES } from '@/lib/scale-data';

// Cluster (domain) layout positions
const CLUSTER_POS = {
  Operations: { x: 0, y: 0 }, Authorization: { x: 260, y: 0 }, Risk: { x: 520, y: 0 },
  Settlement: { x: 0, y: 160 }, Fraud: { x: 260, y: 160 }, Reporting: { x: 520, y: 160 },
  Credit: { x: 0, y: 320 }, Pricing: { x: 520, y: 320 },
  Compliance: { x: 260, y: 320 }, Security: { x: 0, y: 480 },
};

const CLUSTER_EDGES = [
  ['Operations', 'Authorization'], ['Authorization', 'Fraud'], ['Authorization', 'Settlement'],
  ['Fraud', 'Credit'], ['Fraud', 'Compliance'], ['Credit', 'Pricing'], ['Pricing', 'Compliance'],
  ['Compliance', 'Settlement'], ['Settlement', 'Reporting'], ['Risk', 'Fraud'],
  ['Risk', 'Compliance'], ['Security', 'Authorization'], ['Security', 'Operations'],
  ['Reporting', 'Risk'],
];

// 13-rule layout positions inside a domain drill
const RULE_POS = {
  R001: { x: 280, y: 0 }, R002: { x: 280, y: 100 }, R003: { x: 280, y: 200 },
  R004: { x: 140, y: 300 }, R005: { x: 420, y: 300 }, R006: { x: 280, y: 400 },
  R007: { x: 440, y: 500 }, R008: { x: 100, y: 500 }, R009: { x: 310, y: 550 },
  R010: { x: 40, y: 650 }, R011: { x: 180, y: 650 }, R012: { x: 280, y: 750 }, R013: { x: 280, y: 860 },
};

function buildClusterNodes() {
  return SCALE_DOMS.map((d) => ({
    id: d,
    position: CLUSTER_POS[d],
    data: {
      label: (
        <div className="w-[170px] p-3 text-center">
          <div className="text-xs font-bold" style={{ color: SCALE_DOM_COLORS[d] }}>{d}</div>
          <div className="mt-1 font-serif text-2xl font-bold">
            {((DOM_COUNTS_MAP[d] || 10000) / 1000).toFixed(1)}K
          </div>
          <div className="text-[9px] text-muted-foreground">rules</div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-destructive/60" style={{ width: '15%' }} />
          </div>
        </div>
      ),
    },
    style: {
      background: 'hsl(var(--card))',
      border: `2px solid ${SCALE_DOM_COLORS[d]}`,
      borderRadius: 16,
      padding: 0,
      boxShadow: `0 4px 16px ${SCALE_DOM_COLORS[d]}22`,
    },
  }));
}

function buildClusterEdges() {
  return CLUSTER_EDGES.map(([from, to], i) => ({
    id: `e-${from}-${to}`,
    source: from,
    target: to,
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: 'hsl(var(--muted-foreground) / 0.4)', strokeWidth: 1.5 },
  }));
}

function buildRuleNodes(highlightSet) {
  return RULES.map((r) => ({
    id: r.id,
    position: RULE_POS[r.id],
    data: {
      label: (
        <div className="w-[130px] p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold" style={{ color: DOM_COLORS[r.dom] }}>
              {r.id}
            </span>
            <span className="h-2 w-2 rounded-full" style={{ background: CRIT_COLORS[r.crit] }} />
          </div>
          <div className="mt-1 text-[10px] leading-tight">{r.name}</div>
        </div>
      ),
    },
    style: {
      background: highlightSet.has(r.id) ? DOM_COLORS[r.dom] + '15' : 'hsl(var(--card))',
      border: `2px solid ${highlightSet.has(r.id) ? DOM_COLORS[r.dom] : 'hsl(var(--border))'}`,
      borderRadius: 12,
      padding: 0,
    },
  }));
}

function buildRuleEdges(highlightSet) {
  return EDGES.map((e, i) => {
    const hl = highlightSet.has(e.from) && highlightSet.has(e.to);
    return {
      id: `re-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      animated: hl,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke: hl ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground) / 0.3)',
        strokeWidth: hl ? 2.5 : 1,
      },
    };
  });
}

export function GraphTab() {
  const [drillDomain, setDrillDomain] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);

  const highlightSet = useMemo(() => new Set(getPath(selectedRule)), [selectedRule]);

  const clusterNodes = useMemo(buildClusterNodes, []);
  const clusterEdges = useMemo(buildClusterEdges, []);
  const ruleNodes = useMemo(() => buildRuleNodes(highlightSet), [highlightSet]);
  const ruleEdges = useMemo(() => buildRuleEdges(highlightSet), [highlightSet]);

  const [cNodes, , onCNodesChange] = useNodesState(clusterNodes);
  const [cEdges, , onCEdgesChange] = useEdgesState(clusterEdges);
  const [rNodes, setRNodes, onRNodesChange] = useNodesState(ruleNodes);
  const [rEdges, setREdges, onREdgesChange] = useEdgesState(ruleEdges);

  // Keep rule graph in sync with selection highlights
  useMemo(() => {
    setRNodes(buildRuleNodes(highlightSet));
    setREdges(buildRuleEdges(highlightSet));
  }, [highlightSet, setRNodes, setREdges]);

  const onClusterNodeClick = useCallback((_, node) => setDrillDomain(node.id), []);
  const onRuleNodeClick = useCallback((_, node) => {
    const rule = RULES.find((r) => r.id === node.id);
    if (rule) setSelectedRule(rule);
  }, []);

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* LEFT: Graph canvas */}
      <div className="flex flex-1 flex-col border-r bg-muted/30">
        <div className="flex items-center justify-between border-b bg-card/60 px-4 py-2 backdrop-blur-lg">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Z+Graph
            </span>
            {drillDomain && (
              <>
                <span className="text-muted-foreground">›</span>
                <span className="text-xs font-bold" style={{ color: SCALE_DOM_COLORS[drillDomain] }}>
                  {drillDomain}
                </span>
              </>
            )}
          </div>
          {drillDomain && (
            <Button size="sm" variant="outline" onClick={() => { setDrillDomain(null); setSelectedRule(null); }}>
              <ArrowLeft className="h-3 w-3" />
              All Domains
            </Button>
          )}
        </div>
        <div className="flex-1">
          {!drillDomain ? (
            <ReactFlow
              nodes={cNodes}
              edges={cEdges}
              onNodesChange={onCNodesChange}
              onEdgesChange={onCEdgesChange}
              onNodeClick={onClusterNodeClick}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
              <Controls className="!bg-card !border" />
              <MiniMap
                className="!bg-card !border"
                nodeColor={(n) => SCALE_DOM_COLORS[n.id] || '#94a3b8'}
              />
            </ReactFlow>
          ) : (
            <ReactFlow
              nodes={rNodes}
              edges={rEdges}
              onNodesChange={onRNodesChange}
              onEdgesChange={onREdgesChange}
              onNodeClick={onRuleNodeClick}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
              <Controls className="!bg-card !border" />
              <MiniMap
                className="!bg-card !border"
                nodeColor={(n) => {
                  const r = RULES.find((x) => x.id === n.id);
                  return r ? DOM_COLORS[r.dom] : '#94a3b8';
                }}
              />
            </ReactFlow>
          )}
        </div>
      </div>

      {/* RIGHT: Detail panel */}
      <div className="w-[420px] overflow-auto bg-card p-6">
        <AnimatePresence mode="wait">
          {selectedRule ? (
            <RuleDetail key={selectedRule.id} rule={selectedRule} onClose={() => setSelectedRule(null)} />
          ) : drillDomain ? (
            <DomainDetail key={drillDomain} domain={drillDomain} />
          ) : (
            <DomainOverview key="overview" onSelect={setDrillDomain} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DomainOverview({ onSelect }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h3 className="mb-2 font-serif text-xl font-bold">100,000 Rules — by Domain</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Click any domain cluster on the graph or below to drill into its call graph.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SCALE_DOMS.map((d) => (
          <motion.button
            key={d}
            whileHover={{ y: -2 }}
            onClick={() => onSelect(d)}
            className="rounded-xl border-2 bg-card p-3 text-left transition-colors hover:border-accent"
            style={{ borderColor: SCALE_DOM_COLORS[d] + '30' }}
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SCALE_DOM_COLORS[d] }} />
              <span className="text-xs font-bold">{d}</span>
            </div>
            <div className="mt-1 font-serif text-lg font-bold" style={{ color: SCALE_DOM_COLORS[d] }}>
              {(DOM_COUNTS_MAP[d] || 0).toLocaleString()}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground">
              {(RULE_NAMES[d] || []).slice(0, 3).join(', ')}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function DomainDetail({ domain }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: SCALE_DOM_COLORS[domain] }}>
        Domain Drill
      </div>
      <h3 className="mb-3 font-serif text-xl font-bold">{domain}</h3>
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              { n: DOM_COUNTS_MAP[domain]?.toLocaleString() || '0', l: 'Total' },
              { n: Math.round((DOM_COUNTS_MAP[domain] || 0) * 0.15).toLocaleString(), l: 'HIGH Crit' },
              { n: (TAL_FILES[domain] || []).length, l: 'TAL Files' },
            ].map((s) => (
              <div key={s.l} className="rounded-md bg-muted p-2 text-center">
                <div className="font-serif text-base font-bold" style={{ color: SCALE_DOM_COLORS[domain] }}>
                  {s.n}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Source Files</div>
          <div className="flex flex-wrap gap-1.5">
            {(TAL_FILES[domain] || []).map((f) => (
              <span key={f} className="rounded border bg-card px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
                {f}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rule Types</div>
      <div className="space-y-1">
        {(RULE_NAMES[domain] || []).slice(0, 12).map((rn, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold"
              style={{ background: SCALE_DOM_COLORS[domain] + '15', color: SCALE_DOM_COLORS[domain] }}
            >
              R{String(i + 1).padStart(3, '0')}
            </span>
            <span className="text-xs">{rn}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function RuleDetail({ rule, onClose }) {
  const [tab, setTab] = useState('trace');
  const tabs = [
    { k: 'trace', l: 'Trace' },
    { k: 'source', l: 'Source' },
    { k: 'target', l: 'Java' },
    { k: 'meta', l: 'Meta' },
  ];
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge style={{ background: DOM_COLORS[rule.dom] + '22', color: DOM_COLORS[rule.dom] }}>
              {rule.dom}
            </Badge>
            <Badge variant="outline" style={{ borderColor: CRIT_COLORS[rule.crit], color: CRIT_COLORS[rule.crit] }}>
              {rule.crit}
            </Badge>
          </div>
          <h3 className="font-serif text-lg font-bold">
            {rule.id}: {rule.name}
          </h3>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          ×
        </Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{rule.desc}</p>

      <div className="mb-3 flex gap-1 border-b">
        {tabs.map((tb) => (
          <button
            key={tb.k}
            onClick={() => setTab(tb.k)}
            className={cn(
              'relative px-3 py-2 text-xs font-semibold',
              tab === tb.k ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tb.l}
            {tab === tb.k && <motion.div layoutId="rule-tab" className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
          </button>
        ))}
      </div>

      {tab === 'trace' && (
        <div className="space-y-2 text-xs">
          <div>
            <span className="font-semibold">Depends on: </span>
            {rule.deps.length ? (
              rule.deps.map((d) => (
                <Badge key={d} variant="info" className="mr-1">{d}</Badge>
              ))
            ) : (
              <em className="text-muted-foreground">None — entry point</em>
            )}
          </div>
          <div>
            <span className="font-semibold">Triggers: </span>
            {rule.trig.length ? (
              rule.trig.map((d) => (
                <Badge key={d} variant="success" className="mr-1">{d}</Badge>
              ))
            ) : (
              <em className="text-muted-foreground">Terminal</em>
            )}
          </div>
        </div>
      )}
      {tab === 'source' && (
        <div>
          <div className="mb-1 text-[10px] text-muted-foreground">
            {rule.src.r} — {rule.src.f} (lines {rule.src.l})
          </div>
          <CodeBlock code={rule.tal} />
        </div>
      )}
      {tab === 'target' && <CodeBlock code={rule.java} />}
      {tab === 'meta' && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            ['Type', rule.type],
            ['Domain', rule.dom],
            ['Criticality', rule.crit],
            ['Source', rule.src.f],
            ['Lines', rule.src.l],
            ['Routine', rule.src.r],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="mt-0.5">{v}</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function cn(...a) { return a.filter(Boolean).join(' '); }
