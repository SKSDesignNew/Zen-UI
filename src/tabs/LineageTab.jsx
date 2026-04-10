import { useCallback, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background, BackgroundVariant, Controls, MarkerType, useEdgesState, useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import { Play, RotateCcw, X, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

const ST_COLORS = {
  pass: '#059669', flag: '#d97706', fail: '#dc2626', info: '#2563eb', critical: '#991b1b',
};
const ST_LABELS = {
  pass: 'PASS', flag: 'FLAGGED', fail: 'DECLINED', info: 'APPLIED', critical: 'BLOCKED',
};

const PRESETS = [
  { l: 'Normal Approval', v: { amount: 450, vel: 3, country: 'US', watchlist: false, balance: 1200, limit: 5000 } },
  { l: 'Velocity Exceeded', v: { amount: 2847.5, vel: 18, country: 'CA', watchlist: false, balance: 1200, limit: 5000 } },
  { l: 'Over Credit Limit', v: { amount: 4500, vel: 5, country: 'US', watchlist: false, balance: 2000, limit: 5000 } },
  { l: 'AML Watchlist Hit', v: { amount: 15000, vel: 2, country: 'US', watchlist: true, balance: 1200, limit: 20000 } },
];

function buildChain(txn) {
  const chain = [];
  const v = txn.vel;
  const amt = txn.amount;
  const velOk = v <= 15;
  const expOk = txn.expiry > '04/2026';
  const statusOk = txn.status === 'ACTIVE';
  const creditOk = txn.balance + amt <= txn.limit;

  chain.push({
    id: 'R001', rule: 'PAN Format Check', file: 'PANVALID.TAL:12–38',
    action: txn.pan.length === 16 || txn.pan.length === 19
      ? `PAN ${txn.pan.slice(0, 6)}*** validated as ${txn.pan.length}-digit`
      : `PAN length ${txn.pan.length} invalid`,
    st: txn.pan.length === 16 || txn.pan.length === 19 ? 'pass' : 'fail',
    tal: 'IF PAN^LENGTH <> 16 AND PAN^LENGTH <> 19 THEN\n  CALL SET^ERROR(ERR^CODE := "14")',
    java: 'if (pan.length() != 16 && pan.length() != 19) {\n  setError("14");\n  throw new InputRejectedException();\n}',
  });
  if (chain[chain.length - 1].st === 'fail') return chain;

  chain.push({
    id: 'R002', rule: 'Luhn Checksum', file: 'PANVALID.TAL:42–78',
    action: 'Mod-10 checksum passed', st: 'pass',
    tal: 'SUM := 0;\nWHILE I >= 0 DO\n  D := PAN[I] * 2;\nIF SUM MOD 10 <> 0 THEN DECLINE("14")',
    java: 'int sum = ...;\nif (sum%10!=0) decline("14");',
  });
  chain.push({
    id: 'R003', rule: 'BIN Range Lookup', file: 'AUTHPROC.TAL:45–89',
    action: `BIN ${txn.pan.slice(0, 6)} matched — Issuer: VISA-${txn.country}`, st: 'pass',
    tal: 'SCAN BIN^TABLE WHILE BIN^ENTRY.STATUS = "A"',
    java: 'binTable.stream().filter(BinEntry::isActive)...',
  });
  chain.push({
    id: 'R004', rule: 'Card Status Check', file: 'AUTHPROC.TAL:142–178',
    action: statusOk ? `Status: ${txn.status} — proceed` : `Status: ${txn.status} — DECLINED 05`,
    st: statusOk ? 'pass' : 'fail',
    tal: 'IF CARD^STATUS <> "ACTIVE" THEN DECLINE("05")',
    java: 'if (!card.getStatus().equals(ACTIVE)) decline("05");',
  });
  if (!statusOk) return chain;

  chain.push({
    id: 'R005', rule: 'Expiry Validation', file: 'AUTHPROC.TAL:92–110',
    action: expOk ? `Expiry ${txn.expiry} valid` : `EXPIRED — code 54`,
    st: expOk ? 'pass' : 'fail',
    tal: 'IF EXP^DATE < CURRENT^DATE THEN DECLINE("54")',
    java: 'if (card.getExpiryDate().isBefore(now())) decline("54");',
  });
  if (!expOk) return chain;

  chain.push({
    id: 'R006', rule: 'Velocity Limit', file: 'FRAUDCHK.TAL:201–267',
    action: velOk ? `Velocity ${v}/15 — within limits` : `Velocity ${v}/15 EXCEEDED → manual review`,
    st: velOk ? 'pass' : 'flag',
    tal: 'IF TXN^COUNT^24HR > VELOCITY^LIMIT THEN\n  CALL FLAG^SUSPICIOUS("HIGH")',
    java: 'if (txnCount24Hr > velocityLimit) {\n  flagSuspicious(HIGH);\n}',
  });
  chain.push({
    id: 'R007', rule: 'Geo-Location Risk', file: 'FRAUDCHK.TAL:310–358',
    action: txn.country !== 'US' ? `Cross-border (${txn.country}) — geo-risk +40` : 'Domestic — no geo-risk',
    st: txn.country !== 'US' ? 'info' : 'pass',
    tal: 'IF DISTANCE > IMPOSSIBLE^TRAVEL THEN GEO^RISK := GEO^RISK + 40',
    java: 'if (dist > THRESHOLD) geoRiskScore += 40;',
  });
  chain.push({
    id: 'R008', rule: 'Credit Limit Auth', file: 'CREDITAUTH.TAL:88–145',
    action: creditOk
      ? `$${(txn.balance + amt).toLocaleString()} < $${txn.limit.toLocaleString()} — approved`
      : `$${(txn.balance + amt).toLocaleString()} > $${txn.limit.toLocaleString()} — OVERLIMIT`,
    st: creditOk ? 'pass' : 'flag',
    tal: 'IF (BALANCE + TXN^AMT) > CREDIT^LIMIT THEN DECLINE("51")',
    java: 'if (projected.compareTo(limit) > 0) decline("51");',
  });
  chain.push({
    id: 'R012', rule: 'AML/CTR Screening', file: 'AML-Policy-v4.2.pdf:§3.1',
    action: txn.watchlist
      ? 'WATCHLIST MATCH → BLOCKED & ESCALATED'
      : amt > 10000 ? `$${amt.toLocaleString()} > $10K → CTR filed` : 'Below CTR threshold',
    st: txn.watchlist ? 'critical' : amt > 10000 ? 'info' : 'pass',
    tal: 'IF WATCHLIST^MATCH THEN BLOCK^ESCALATE',
    java: 'if (watchlistMatch) blockAndEscalate(txn);',
  });
  if (txn.watchlist) return chain;
  chain.push({
    id: 'R013', rule: 'Auth Response Build', file: 'AUTHRESP.TAL:10–55',
    action: `Code ${velOk && creditOk ? '00 APPROVED' : '59 REVIEW'} | Auth: ZF-${Date.now().toString(36).toUpperCase().slice(-5)}`,
    st: velOk && creditOk ? 'pass' : 'flag',
    tal: 'CALL SEND^RESPONSE(RESP^MSG)',
    java: 'return AuthResponse.builder().build();',
  });
  return chain;
}

function buildLineageNodes(chain, flowStep) {
  return chain.map((step, i) => {
    const visible = i <= flowStep;
    const sc = ST_COLORS[step.st];
    return {
      id: step.id,
      position: { x: 80, y: i * 100 },
      data: {
        label: (
          <div className="w-[260px] p-3 text-left">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold" style={{ color: sc }}>{step.id}</span>
              <span className="text-xs font-semibold">{step.rule}</span>
              {visible && (
                <span
                  className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: sc + '22', color: sc }}
                >
                  {ST_LABELS[step.st]}
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-[9px] text-muted-foreground">{step.file}</div>
            {visible && (
              <div className="mt-1 text-[10px] leading-snug" style={{ color: ['fail', 'critical'].includes(step.st) ? sc : 'hsl(var(--muted-foreground))' }}>
                {step.action}
              </div>
            )}
          </div>
        ),
      },
      style: {
        background: 'hsl(var(--card))',
        border: `2px solid ${visible ? sc : 'hsl(var(--border))'}`,
        borderRadius: 12,
        padding: 0,
        opacity: visible ? 1 : 0.35,
        transition: 'all .3s',
      },
    };
  });
}

function buildLineageEdges(chain, flowStep) {
  return chain.slice(0, -1).map((step, i) => ({
    id: `le-${i}`,
    source: step.id,
    target: chain[i + 1].id,
    type: 'smoothstep',
    animated: i < flowStep,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: {
      stroke: i < flowStep ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground) / 0.3)',
      strokeWidth: i < flowStep ? 2 : 1,
    },
  }));
}

export function LineageTab() {
  const [txn, setTxn] = useState({
    pan: '4532015112830366', amount: 2847.5, mcc: '5411', country: 'CA',
    vel: 18, expiry: '08/2027', status: 'ACTIVE', balance: 1200, limit: 5000, watchlist: false,
  });
  const [flowStep, setFlowStep] = useState(-1);
  const [selected, setSelected] = useState(null);
  const timer = useRef(null);

  const chain = useMemo(() => buildChain(txn), [txn]);
  const nodes = useMemo(() => buildLineageNodes(chain, flowStep), [chain, flowStep]);
  const edges = useMemo(() => buildLineageEdges(chain, flowStep), [chain, flowStep]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);

  useMemo(() => {
    setRfNodes(nodes);
    setRfEdges(edges);
  }, [nodes, edges, setRfNodes, setRfEdges]);

  const reset = () => {
    clearTimeout(timer.current);
    setFlowStep(-1);
    setSelected(null);
  };
  const runAll = useCallback(() => {
    reset();
    let i = 0;
    const go = () => {
      if (i >= chain.length) return;
      setFlowStep(i);
      i++;
      timer.current = setTimeout(go, 450);
    };
    setTimeout(go, 100);
  }, [chain.length]);

  const onNodeClick = useCallback((_, node) => {
    const step = chain.find((s) => s.id === node.id);
    if (step) setSelected(step);
  }, [chain]);

  return (
    <div className="px-6 py-6">
      <div className="mb-3">
        <h3 className="font-serif text-2xl font-bold tracking-tight">Live Transaction Lineage</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a transaction and watch it flow through the rule chain in real time. Change any value and the path changes dynamically.
        </p>
        <div className="mt-1 text-xs font-semibold italic text-accent">
          Click any rule node to see source TAL and target Java
        </div>
      </div>

      {/* Inputs */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Transaction — Change Any Value to Alter the Flow
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {[
              { k: 'pan', l: 'PAN' }, { k: 'amount', l: 'Amount ($)' }, { k: 'mcc', l: 'MCC' },
              { k: 'country', l: 'Country' }, { k: 'vel', l: 'Velocity' },
              { k: 'limit', l: 'Credit Limit' }, { k: 'balance', l: 'Balance' },
            ].map((f) => (
              <div key={f.k}>
                <label className="mb-1 block text-[9px] uppercase tracking-wider text-muted-foreground">
                  {f.l}
                </label>
                <Input
                  className="h-8 font-mono text-xs"
                  value={txn[f.k]}
                  onChange={(e) => {
                    const val = ['amount', 'vel', 'limit', 'balance'].includes(f.k)
                      ? Number(e.target.value) || 0 : e.target.value;
                    setTxn({ ...txn, [f.k]: val });
                    reset();
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.l} size="sm" variant="outline"
                onClick={() => { setTxn({ ...txn, ...p.v }); reset(); }}
              >
                {p.l}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="mb-4 flex items-center gap-2">
        <Button onClick={runAll} variant="accent">
          <Play className="h-4 w-4" />
          Run Full Flow
        </Button>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {Math.min(Math.max(flowStep + 1, 0), chain.length)} / {chain.length} rules
        </div>
      </div>

      {/* Flow + Detail split */}
      <div className="grid gap-4" style={{ gridTemplateColumns: selected ? '1fr 380px' : '1fr' }}>
        <Card className="h-[600px] overflow-hidden">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls className="!bg-card !border" />
          </ReactFlow>
        </Card>

        {selected && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-accent/30">
              <CardContent className="p-5">
                <div className="mb-3 flex items-start gap-2">
                  <div className="flex-1">
                    <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                      {selected.id}
                    </span>
                    <h4 className="mt-2 font-serif text-lg font-bold">{selected.rule}</h4>
                    <div className="text-[10px] font-mono text-muted-foreground">{selected.file}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setSelected(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mb-3 rounded border p-2 text-xs"
                  style={{
                    background: ST_COLORS[selected.st] + '08',
                    borderColor: ST_COLORS[selected.st] + '25',
                    color: ST_COLORS[selected.st],
                  }}
                >
                  {selected.action}
                </div>
                <div className="mb-3">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Source TAL
                  </div>
                  <CodeBlock code={selected.tal} />
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-success">
                    Target Java
                  </div>
                  <CodeBlock code={selected.java} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
