import { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, X } from 'lucide-react';
import { Scene } from '@/components/three/Scene';
import { GlassNode } from '@/components/three/GlassNode';
import { Edge } from '@/components/three/Edge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';

const ST_COLORS = {
  pass: '#10b981', flag: '#f59e0b', fail: '#ef4444', info: '#3b82f6', critical: '#991b1b',
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

  chain.push({ id: 'R001', rule: 'PAN Format Check', file: 'PANVALID.TAL:12–38',
    action: txn.pan.length === 16 || txn.pan.length === 19 ? `PAN ${txn.pan.slice(0, 6)}*** validated` : `Invalid length ${txn.pan.length}`,
    st: txn.pan.length === 16 || txn.pan.length === 19 ? 'pass' : 'fail',
    tal: 'IF PAN^LENGTH <> 16 AND PAN^LENGTH <> 19 THEN\n  CALL SET^ERROR("14")',
    java: 'if (pan.length() != 16 && pan.length() != 19)\n  throw new InputRejectedException();' });
  if (chain[chain.length - 1].st === 'fail') return chain;

  chain.push({ id: 'R002', rule: 'Luhn Checksum', file: 'PANVALID.TAL:42–78',
    action: 'Mod-10 checksum passed', st: 'pass',
    tal: 'IF SUM MOD 10 <> 0 THEN DECLINE("14")', java: 'if (sum%10!=0) decline("14");' });
  chain.push({ id: 'R003', rule: 'BIN Lookup', file: 'AUTHPROC.TAL:45–89',
    action: `BIN ${txn.pan.slice(0, 6)} → VISA-${txn.country}`, st: 'pass',
    tal: 'SCAN BIN^TABLE WHILE STATUS = "A"', java: 'binTable.stream().filter(...).findFirst();' });
  chain.push({ id: 'R004', rule: 'Card Status', file: 'AUTHPROC.TAL:142–178',
    action: statusOk ? `${txn.status} — proceed` : `${txn.status} — DECLINED 05`,
    st: statusOk ? 'pass' : 'fail',
    tal: 'IF STATUS <> "ACTIVE" THEN DECLINE("05")', java: 'if (!ACTIVE.equals(card.getStatus())) decline("05");' });
  if (!statusOk) return chain;

  chain.push({ id: 'R005', rule: 'Expiry', file: 'AUTHPROC.TAL:92–110',
    action: expOk ? `${txn.expiry} valid` : 'EXPIRED — code 54',
    st: expOk ? 'pass' : 'fail',
    tal: 'IF EXP^DATE < CURRENT^DATE THEN DECLINE("54")', java: 'if (exp.isBefore(now())) decline("54");' });
  if (!expOk) return chain;

  chain.push({ id: 'R006', rule: 'Velocity Limit', file: 'FRAUDCHK.TAL:201–267',
    action: velOk ? `${v}/15 — within limits` : `${v}/15 EXCEEDED → review`,
    st: velOk ? 'pass' : 'flag',
    tal: 'IF TXN^COUNT > LIMIT THEN FLAG^SUSPICIOUS("HIGH")',
    java: 'if (count > limit) flagSuspicious(HIGH);' });
  chain.push({ id: 'R007', rule: 'Geo-Risk', file: 'FRAUDCHK.TAL:310–358',
    action: txn.country !== 'US' ? `Cross-border (${txn.country}) +40` : 'Domestic',
    st: txn.country !== 'US' ? 'info' : 'pass',
    tal: 'IF DISTANCE > IMPOSSIBLE^TRAVEL THEN GEO^RISK += 40',
    java: 'if (dist > THRESHOLD) geoRiskScore += 40;' });
  chain.push({ id: 'R008', rule: 'Credit Limit', file: 'CREDITAUTH.TAL:88–145',
    action: creditOk
      ? `$${(txn.balance + amt).toLocaleString()} < $${txn.limit.toLocaleString()}`
      : `$${(txn.balance + amt).toLocaleString()} OVERLIMIT`,
    st: creditOk ? 'pass' : 'flag',
    tal: 'IF (BALANCE + TXN^AMT) > LIMIT THEN DECLINE("51")',
    java: 'if (projected.compareTo(limit) > 0) decline("51");' });
  chain.push({ id: 'R012', rule: 'AML/CTR', file: 'AML-Policy:§3.1',
    action: txn.watchlist ? 'WATCHLIST → BLOCKED' : amt > 10000 ? 'CTR filed' : 'Below threshold',
    st: txn.watchlist ? 'critical' : amt > 10000 ? 'info' : 'pass',
    tal: 'IF WATCHLIST^MATCH THEN BLOCK^ESCALATE',
    java: 'if (watchlistMatch) blockAndEscalate(txn);' });
  if (txn.watchlist) return chain;
  chain.push({ id: 'R013', rule: 'Auth Response', file: 'AUTHRESP.TAL:10–55',
    action: `Code ${velOk && creditOk ? '00 APPROVED' : '59 REVIEW'}`,
    st: velOk && creditOk ? 'pass' : 'flag',
    tal: 'CALL SEND^RESPONSE(RESP^MSG)',
    java: 'return AuthResponse.builder().build();' });
  return chain;
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

  // 3D positions: vertical pipeline with slight horizontal jitter
  const positions = useMemo(() => {
    const result = {};
    const N = chain.length;
    chain.forEach((step, i) => {
      const t = i / Math.max(1, N - 1);
      const y = 30 - t * 60; // top to bottom
      const x = Math.sin(i * 1.3) * 6;
      const z = Math.cos(i * 0.8) * 4;
      result[step.id] = [x, y, z];
    });
    return result;
  }, [chain]);

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
      timer.current = setTimeout(go, 550);
    };
    setTimeout(go, 100);
  }, [chain.length]);

  return (
    <div className="px-6 py-6">
      <div className="mb-3">
        <h3 className="font-serif text-2xl font-bold tracking-tight">Live Transaction Lineage</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a transaction and watch it flow through the rule chain in 3D. Drag to orbit, scroll to zoom.
        </p>
      </div>

      {/* Inputs */}
      <div className="mb-4 rounded-2xl border border-white/15 bg-black/5 p-4 backdrop-blur-xl">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Transaction Inputs
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
              <Input className="h-8 font-mono text-xs" value={txn[f.k]}
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
      </div>

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

      {/* 3D Scene */}
      <div className="relative h-[600px] overflow-hidden rounded-2xl border border-white/15">
        <Scene cameraPosition={[35, 0, 35]} enableStars={true}>
          {chain.slice(0, -1).map((step, i) => {
            const f = positions[step.id];
            const t = positions[chain[i + 1].id];
            if (!f || !t) return null;
            const visited = i < flowStep;
            return (
              <Edge
                key={`e-${i}`}
                from={f}
                to={t}
                color={visited ? '#fbbf24' : '#6366f1'}
                highlighted={visited}
                radius={0.08}
              />
            );
          })}
          {chain.map((step, i) => {
            const pos = positions[step.id];
            if (!pos) return null;
            const visible = i <= flowStep;
            return (
              <GlassNode
                key={step.id}
                position={pos}
                radius={2.2}
                color={visible ? ST_COLORS[step.st] : '#475569'}
                label={step.id}
                sublabel={step.rule}
                selected={selected?.id === step.id}
                onClick={() => setSelected(step)}
              />
            );
          })}
        </Scene>

        {/* Outcome overlay */}
        {flowStep >= chain.length - 1 && flowStep >= 0 && (() => {
          const last = chain[chain.length - 1];
          const outcome =
            last.st === 'critical' ? 'HARD BLOCK — Account frozen' :
            last.st === 'fail' ? `DECLINED — ${last.action}` :
            last.st === 'flag' ? 'SOFT DECLINE — Manual review' :
            'APPROVED — Code 00';
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-2xl border border-white/20 bg-black/60 px-6 py-3 text-center backdrop-blur-2xl"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Decision Outcome
              </div>
              <div className="mt-1 text-sm font-bold text-white">{outcome}</div>
            </motion.div>
          );
        })()}

        {/* Detail panel overlay */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className="absolute right-4 top-4 w-[360px] max-h-[560px] overflow-auto rounded-2xl border border-white/15 bg-black/50 p-5 backdrop-blur-2xl"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <span className="rounded bg-accent/20 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                    {selected.id}
                  </span>
                  <h4 className="mt-2 font-serif text-lg font-bold text-white">{selected.rule}</h4>
                  <div className="font-mono text-[10px] text-white/50">{selected.file}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/60 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div
                className="mb-3 rounded-md border px-2 py-1.5 text-xs"
                style={{
                  background: ST_COLORS[selected.st] + '15',
                  borderColor: ST_COLORS[selected.st] + '40',
                  color: ST_COLORS[selected.st],
                }}
              >
                {selected.action}
              </div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Source TAL</div>
              <CodeBlock code={selected.tal} className="mb-3" />
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">Target Java</div>
              <CodeBlock code={selected.java} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
