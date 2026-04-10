import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, RotateCcw, X, Lock, Link2, ShieldCheck, Check, AlertTriangle,
  CreditCard, Flag, Globe, Activity, ChevronRight, Hash,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

// ─── Status colors / labels ───────────────────────────────────────────────
const ST_COLORS = {
  pass: '#10b981', flag: '#f59e0b', fail: '#ef4444', info: '#3b82f6', critical: '#991b1b',
};
const ST_LABELS = {
  pass: 'PASS', flag: 'FLAGGED', fail: 'DECLINED', info: 'APPLIED', critical: 'BLOCKED',
};
const ST_BG = {
  pass: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  flag: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  fail: 'bg-red-500/15 text-red-600 border-red-500/30',
  info: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  critical: 'bg-red-900/15 text-red-900 border-red-900/30',
};

// ─── Preset scenarios ─────────────────────────────────────────────────────
const PRESETS = [
  { k: 'normal', l: 'Normal',       sub: '$450 · US · vel 3',       color: '#10b981',
    v: { amount: 450,    vel: 3,  country: 'US', watchlist: false, balance: 1200, limit: 5000 } },
  { k: 'velocity', l: 'Velocity Hit', sub: '$2,847 · CA · vel 18',  color: '#f59e0b',
    v: { amount: 2847.5, vel: 18, country: 'CA', watchlist: false, balance: 1200, limit: 5000 } },
  { k: 'overlimit', l: 'Over Limit',  sub: '$4,500 · US · bal $2K', color: '#f97316',
    v: { amount: 4500,   vel: 5,  country: 'US', watchlist: false, balance: 2000, limit: 5000 } },
  { k: 'aml', l: 'AML Block',         sub: '$15K · US · watchlist', color: '#ef4444',
    v: { amount: 15000,  vel: 2,  country: 'US', watchlist: true,  balance: 1200, limit: 20000 } },
];

// ─── Build the rule chain from a transaction ──────────────────────────────
// (logic preserved verbatim from the previous version, with extra metadata
//  added per rule for the trace chain panel)
function buildChain(txn) {
  const chain = [];
  const v = txn.vel;
  const amt = txn.amount;
  const velOk = v <= 15;
  const expOk = txn.expiry > '04/2026';
  const statusOk = txn.status === 'ACTIVE';
  const creditOk = txn.balance + amt <= txn.limit;

  chain.push({
    id: 'R001', rule: 'PAN Format', short: 'PAN', file: 'PANVALID.TAL', lines: '12–38', routine: 'CHK^PAN^FORMAT',
    domain: 'Validation', crit: 'LOW', regulation: 'PCI-DSS Req. 3',
    action: txn.pan.length === 16 || txn.pan.length === 19 ? `PAN ${txn.pan.slice(0, 6)}*** validated` : `Invalid length ${txn.pan.length}`,
    st: txn.pan.length === 16 || txn.pan.length === 19 ? 'pass' : 'fail',
    tal: 'IF PAN^LENGTH <> 16 AND PAN^LENGTH <> 19 THEN\n  CALL SET^ERROR("14")',
    java: 'if (pan.length() != 16 && pan.length() != 19)\n  throw new InputRejectedException();',
    vars: [
      { tal: 'PAN^LENGTH', java: 'pan.length()' },
      { tal: 'ERR^CODE', java: 'errorCode' },
    ],
  });
  if (chain[chain.length - 1].st === 'fail') return chain;

  chain.push({
    id: 'R002', rule: 'Luhn Checksum', short: 'Luhn', file: 'PANVALID.TAL', lines: '42–78', routine: 'LUHN^CHECK',
    domain: 'Validation', crit: 'HIGH', regulation: 'ISO/IEC 7812',
    action: 'Mod-10 checksum passed', st: 'pass',
    tal: 'IF SUM MOD 10 <> 0 THEN\n  DECLINE("14")',
    java: 'if (sum % 10 != 0) decline("14");',
    vars: [
      { tal: 'SUM', java: 'sum' },
      { tal: 'CHECKSUM', java: 'checksum' },
    ],
  });

  chain.push({
    id: 'R003', rule: 'BIN Lookup', short: 'BIN', file: 'AUTHPROC.TAL', lines: '45–89', routine: 'VALIDATE^BIN^RANGE',
    domain: 'Authorization', crit: 'HIGH', regulation: 'ISO 8583',
    action: `BIN ${txn.pan.slice(0, 6)} → VISA-${txn.country}`, st: 'pass',
    tal: 'SCAN BIN^TABLE WHILE STATUS = "A"\n  IF CARD^BIN >= LOW AND <= HIGH THEN FOUND := 1',
    java: 'binTable.stream().filter(BinEntry::isActive)\n  .filter(b -> bin >= b.low && bin <= b.high).findFirst();',
    vars: [
      { tal: 'CARD^BIN', java: 'cardBin' },
      { tal: 'BIN^FOUND', java: 'binEntry' },
    ],
  });

  chain.push({
    id: 'R004', rule: 'Card Status', short: 'Status', file: 'AUTHPROC.TAL', lines: '142–178', routine: 'CHECK^CARD^STATUS',
    domain: 'Authorization', crit: 'HIGH', regulation: 'PCI-DSS Req. 8',
    action: statusOk ? `${txn.status} — proceed` : `${txn.status} — DECLINED 05`,
    st: statusOk ? 'pass' : 'fail',
    tal: 'IF CARD^STATUS <> "ACTIVE" THEN\n  CALL DECLINE^TRANSACTION("05")',
    java: 'if (!card.getStatus().equals(ACTIVE))\n  return declineTransaction("05");',
    vars: [
      { tal: 'CARD^STATUS', java: 'card.getStatus()' },
      { tal: 'RESP^CODE', java: 'responseCode' },
    ],
  });
  if (!statusOk) return chain;

  chain.push({
    id: 'R005', rule: 'Expiry', short: 'Exp', file: 'AUTHPROC.TAL', lines: '92–110', routine: 'CHECK^EXPIRY',
    domain: 'Authorization', crit: 'MEDIUM', regulation: 'ISO/IEC 7813',
    action: expOk ? `${txn.expiry} valid` : 'EXPIRED — code 54',
    st: expOk ? 'pass' : 'fail',
    tal: 'IF CARD^EXP^DATE < CURRENT^DATE THEN\n  CALL DECLINE^TRANSACTION("54")',
    java: 'if (exp.isBefore(LocalDate.now()))\n  return declineTransaction("54");',
    vars: [
      { tal: 'CARD^EXP^DATE', java: 'card.getExpiryDate()' },
      { tal: 'CURRENT^DATE', java: 'LocalDate.now()' },
    ],
  });
  if (!expOk) return chain;

  chain.push({
    id: 'R006', rule: 'Velocity Limit', short: 'Vel', file: 'FRAUDCHK.TAL', lines: '201–267', routine: 'CHECK^VELOCITY',
    domain: 'Fraud', crit: 'HIGH', regulation: 'BSA/AML 31 CFR 1010.311',
    action: velOk ? `${v}/15 — within limits` : `${v}/15 EXCEEDED → review`,
    st: velOk ? 'pass' : 'flag',
    tal: 'IF TXN^COUNT^24HR > VELOCITY^LIMIT THEN\n  CALL FLAG^SUSPICIOUS^ACTIVITY(ACCT^NUM, ALERT^LEVEL)',
    java: 'if (txnCount24Hr > velocityLimit)\n  flagSuspiciousActivity(acctNum, alertLevel);',
    vars: [
      { tal: 'TXN^COUNT^24HR', java: 'txnCount24Hr' },
      { tal: 'VELOCITY^LIMIT', java: 'velocityLimit' },
      { tal: 'ALERT^LEVEL', java: 'alertLevel' },
    ],
  });

  chain.push({
    id: 'R007', rule: 'Geo-Risk', short: 'Geo', file: 'FRAUDCHK.TAL', lines: '310–358', routine: 'CALC^GEO^RISK',
    domain: 'Fraud', crit: 'MEDIUM', regulation: 'OFAC sanctions',
    action: txn.country !== 'US' ? `Cross-border (${txn.country}) +40` : 'Domestic',
    st: txn.country !== 'US' ? 'info' : 'pass',
    tal: 'IF DISTANCE > IMPOSSIBLE^TRAVEL THEN\n  GEO^RISK := GEO^RISK + 40',
    java: 'if (dist > IMPOSSIBLE_TRAVEL)\n  geoRiskScore += 40;',
    vars: [
      { tal: 'DISTANCE', java: 'dist' },
      { tal: 'GEO^RISK', java: 'geoRiskScore' },
    ],
  });

  chain.push({
    id: 'R008', rule: 'Credit Limit', short: 'Credit', file: 'CREDITAUTH.TAL', lines: '88–145', routine: 'AUTH^CREDIT^LIMIT',
    domain: 'Credit', crit: 'HIGH', regulation: 'Reg Z',
    action: creditOk
      ? `$${(txn.balance + amt).toLocaleString()} < $${txn.limit.toLocaleString()}`
      : `$${(txn.balance + amt).toLocaleString()} OVERLIMIT`,
    st: creditOk ? 'pass' : 'flag',
    tal: 'IF (BALANCE + TXN^AMT) > CREDIT^LIMIT THEN\n  CALL DECLINE("51")',
    java: 'if (balance.add(txnAmt).compareTo(limit) > 0)\n  return decline("51");',
    vars: [
      { tal: 'BALANCE', java: 'balance' },
      { tal: 'TXN^AMT', java: 'txnAmt' },
      { tal: 'CREDIT^LIMIT', java: 'limit' },
    ],
  });

  chain.push({
    id: 'R012', rule: 'AML/CTR', short: 'AML', file: 'AML-Policy', lines: '§3.1–§3.4', routine: 'AML^SCREEN',
    domain: 'Compliance', crit: 'HIGH', regulation: 'BSA 31 USC 5313',
    action: txn.watchlist ? 'WATCHLIST → BLOCKED' : amt > 10000 ? 'CTR filed' : 'Below threshold',
    st: txn.watchlist ? 'critical' : amt > 10000 ? 'info' : 'pass',
    tal: 'IF WATCHLIST^MATCH THEN\n  CALL BLOCK^ESCALATE',
    java: 'if (watchlistMatch)\n  blockAndEscalate(txn);',
    vars: [
      { tal: 'WATCHLIST^MATCH', java: 'watchlistMatch' },
      { tal: 'TXN^AMOUNT', java: 'txnAmt' },
    ],
  });
  if (txn.watchlist) return chain;

  chain.push({
    id: 'R013', rule: 'Auth Response', short: 'Resp', file: 'AUTHRESP.TAL', lines: '10–55', routine: 'BUILD^AUTH^RESP',
    domain: 'Authorization', crit: 'HIGH', regulation: 'ISO 8583',
    action: `Code ${velOk && creditOk ? '00 APPROVED' : '59 REVIEW'}`,
    st: velOk && creditOk ? 'pass' : 'flag',
    tal: 'RESP^MSG.CODE := AUTH^RESULT^CODE\nCALL SEND^RESPONSE(RESP^MSG)',
    java: 'AuthResponse resp = AuthResponse.builder()\n  .code(authResultCode).build();\nreturn sendResponse(resp);',
    vars: [
      { tal: 'AUTH^RESULT^CODE', java: 'authResultCode' },
      { tal: 'RESP^MSG', java: 'resp' },
    ],
  });

  return chain;
}

// ─── Section 1: The Zen+ Promise ──────────────────────────────────────────
function ZenPlusPromise() {
  const pillars = [
    {
      Icon: Lock,
      title: 'D+',
      subtitle: 'DETERMINISTIC',
      tagline: 'Same input = Same output. Every time.',
      proof: (
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300"
            >
              <Check className="h-2.5 w-2.5" />
              Run {n}
            </div>
          ))}
        </div>
      ),
      llm: 'LLM: 3 runs, 3 different outputs',
    },
    {
      Icon: Link2,
      title: 'L+',
      subtitle: 'LINEAGE',
      tagline: 'Every decision links back to source code.',
      proof: (
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-white/85">
          <span className="rounded bg-white/5 px-1.5 py-0.5">FRAUDCHK.TAL:201</span>
          <ChevronRight className="h-3 w-3 text-amber-300" />
          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-amber-300">R006</span>
          <ChevronRight className="h-3 w-3 text-amber-300" />
          <span className="rounded bg-white/5 px-1.5 py-0.5">VelocityCheckService.java</span>
        </div>
      ),
      llm: 'LLM: "Based on the general pattern…"',
    },
    {
      Icon: ShieldCheck,
      title: 'T+',
      subtitle: 'TRACEABLE',
      tagline: 'Every output links forward to audit.',
      proof: (
        <div className="flex items-center gap-2 font-mono text-[10px] text-white/85">
          <Hash className="h-3 w-3 text-amber-300" />
          <span className="rounded bg-white/5 px-1.5 py-0.5">SHA: a3f8c2e1</span>
          <span className="text-white/40">·</span>
          <span className="text-emerald-300">Immutable</span>
          <span className="text-white/40">·</span>
          <span className="text-white/70">Regulator-ready</span>
        </div>
      ),
      llm: 'LLM: Chat log is your audit trail',
    },
  ];

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0e1a] via-[#0f1424] to-[#0a0e1a] p-6 text-white shadow-xl">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <Badge variant="accent" className="mb-2 text-[10px] uppercase tracking-widest">
            The Zen+ Promise
          </Badge>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-white">
            D + L + T = the governance layer
          </h2>
          <p className="mt-1 text-xs text-white/60">
            Opus 4.6 is the engine. ZenPlus is the chassis, the brakes, and the audit trail.
          </p>
        </div>
      </div>

      {/* Three pillars connected by SVG dashed lines */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 10"
        >
          <line
            x1="22" y1="5" x2="44" y2="5"
            stroke="rgba(251,191,36,0.4)" strokeWidth="0.4"
            strokeDasharray="1.5 1"
            style={{ animation: 'dashFlow 3s linear infinite' }}
          />
          <line
            x1="56" y1="5" x2="78" y2="5"
            stroke="rgba(251,191,36,0.4)" strokeWidth="0.4"
            strokeDasharray="1.5 1"
            style={{ animation: 'dashFlow 3s linear infinite' }}
          />
        </svg>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {pillars.map((p) => {
            const Icon = p.Icon;
            return (
              <div
                key={p.title}
                className="relative rounded-xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-serif text-2xl font-bold text-amber-300">{p.title}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                      {p.subtitle}
                    </div>
                  </div>
                </div>
                <p className="mb-3 text-sm font-semibold text-white">{p.tagline}</p>
                <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-2.5">
                  {p.proof}
                </div>
                <div className="text-[10px] italic text-white/40">{p.llm}</div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes dashFlow {
          to { stroke-dashoffset: -10; }
        }
      `}</style>
    </section>
  );
}

// ─── Section 2: Horizontal Animated Pipeline ──────────────────────────────
function PipelineFlow({ chain, flowStep, runAll, step, reset, onSelectGate, selectedId }) {
  // Compute layout: gates in a horizontal row, wrapping if >7
  const GATE_W = 90;
  const GATE_H = 70;
  const GATE_GAP = 36;
  const COLS_PER_ROW = 7;
  const totalRows = Math.ceil(chain.length / COLS_PER_ROW);
  const ROW_H = GATE_H + 70;
  const padX = 24;
  const padY = 24;
  const SVG_W = padX * 2 + COLS_PER_ROW * GATE_W + (COLS_PER_ROW - 1) * GATE_GAP;
  const SVG_H = padY * 2 + totalRows * ROW_H;

  const positions = chain.map((step, i) => {
    const row = Math.floor(i / COLS_PER_ROW);
    const col = i % COLS_PER_ROW;
    return {
      x: padX + col * (GATE_W + GATE_GAP),
      y: padY + row * ROW_H,
      row,
      col,
    };
  });

  // Animated dot position — interpolate between gates as flowStep advances
  const dotPos = useMemo(() => {
    if (flowStep < 0 || flowStep >= chain.length) return null;
    const p = positions[flowStep];
    return { x: p.x + GATE_W / 2, y: p.y + GATE_H / 2 };
  }, [flowStep, positions]);

  return (
    <Card className="mb-6 overflow-hidden">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Rule Pipeline · Live
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-mono font-bold text-foreground">
              {Math.min(Math.max(flowStep + 1, 0), chain.length)}
            </span>
            {' / '}{chain.length} gates
          </div>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="block w-full" style={{ minHeight: SVG_H, maxWidth: '100%' }}>
            <defs>
              <marker
                id="pipe-arrow"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--muted-foreground))" />
              </marker>
            </defs>

            {/* Pipe segments connecting gates */}
            {positions.map((p, i) => {
              if (i === chain.length - 1) return null;
              const next = positions[i + 1];
              const reached = i < flowStep;
              if (next.row !== p.row) {
                // Wraps to the next row — draw an L-shaped connector
                const x1 = p.x + GATE_W;
                const y1 = p.y + GATE_H / 2;
                const x2 = next.x;
                const y2 = next.y + GATE_H / 2;
                const midY = (y1 + y2) / 2;
                return (
                  <path
                    key={`pipe-${i}`}
                    d={`M ${x1} ${y1} L ${x1 + 8} ${y1} L ${x1 + 8} ${midY} L ${x2 - 8} ${midY} L ${x2 - 8} ${y2} L ${x2} ${y2}`}
                    stroke={reached ? '#fbbf24' : 'hsl(var(--border))'}
                    strokeWidth={reached ? 2.5 : 1.5}
                    fill="none"
                    style={{ transition: 'all 0.2s' }}
                  />
                );
              }
              return (
                <line
                  key={`pipe-${i}`}
                  x1={p.x + GATE_W}
                  y1={p.y + GATE_H / 2}
                  x2={next.x}
                  y2={next.y + GATE_H / 2}
                  stroke={reached ? '#fbbf24' : 'hsl(var(--border))'}
                  strokeWidth={reached ? 2.5 : 1.5}
                  style={{ transition: 'all 0.2s' }}
                />
              );
            })}

            {/* Gates */}
            {chain.map((step, i) => {
              const p = positions[i];
              const reached = i <= flowStep;
              const color = reached ? ST_COLORS[step.st] : 'hsl(var(--muted-foreground))';
              const isSelected = selectedId === step.id;
              const isFlagged = reached && (step.st === 'flag' || step.st === 'fail' || step.st === 'critical');

              return (
                <g
                  key={step.id}
                  transform={`translate(${p.x}, ${p.y})`}
                  style={{ cursor: reached ? 'pointer' : 'default' }}
                  onClick={() => reached && onSelectGate(step)}
                >
                  {isSelected && (
                    <rect
                      x={-4}
                      y={-4}
                      width={GATE_W + 8}
                      height={GATE_H + 8}
                      rx={12}
                      fill="none"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      style={{ animation: 'dashFlow 1.5s linear infinite' }}
                    />
                  )}
                  <rect
                    x={0}
                    y={0}
                    width={GATE_W}
                    height={GATE_H}
                    rx={10}
                    fill="hsl(var(--card))"
                  />
                  <rect
                    x={0}
                    y={0}
                    width={GATE_W}
                    height={GATE_H}
                    rx={10}
                    fill={color}
                    fillOpacity={reached ? 0.18 : 0.04}
                  />
                  <rect
                    x={0}
                    y={0}
                    width={GATE_W}
                    height={GATE_H}
                    rx={10}
                    fill="none"
                    stroke={color}
                    strokeWidth={reached ? 2 : 1.4}
                  />
                  <text
                    x={GATE_W / 2}
                    y={26}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={11}
                    fontWeight={800}
                    fill={color}
                  >
                    {step.id}
                  </text>
                  <text
                    x={GATE_W / 2}
                    y={42}
                    textAnchor="middle"
                    fontFamily="DM Sans, sans-serif"
                    fontSize={10}
                    fontWeight={600}
                    fill="hsl(var(--foreground))"
                  >
                    {step.short}
                  </text>
                  {reached && (
                    <text
                      x={GATE_W / 2}
                      y={58}
                      textAnchor="middle"
                      fontFamily="DM Sans, sans-serif"
                      fontSize={8}
                      fontWeight={700}
                      fill={color}
                    >
                      {ST_LABELS[step.st]}
                    </text>
                  )}
                  {/* Outcome badge below the gate */}
                  {isFlagged && (
                    <g transform={`translate(${GATE_W / 2}, ${GATE_H + 18})`}>
                      <line
                        x1={0}
                        y1={-12}
                        x2={0}
                        y2={-2}
                        stroke={color}
                        strokeWidth={2}
                      />
                      <circle r={3} fill={color} />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Animated dot moving through the pipe */}
            <AnimatePresence>
              {dotPos && (
                <motion.circle
                  key={`dot-${flowStep}`}
                  cx={dotPos.x}
                  cy={dotPos.y}
                  r={7}
                  fill="hsl(var(--accent))"
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 20 }}
                />
              )}
            </AnimatePresence>
          </svg>
        </div>

        {/* Controls */}
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={runAll} variant="accent" size="sm">
            <Play className="h-3.5 w-3.5" />
            Run Flow
          </Button>
          <Button onClick={step} variant="outline" size="sm" disabled={flowStep >= chain.length - 1}>
            <ChevronRight className="h-3.5 w-3.5" />
            Step
          </Button>
          <Button onClick={reset} variant="outline" size="sm">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <div className="ml-auto text-[11px] italic text-muted-foreground">
            Click any completed gate to inspect its trace chain
          </div>
        </div>

        {/* Final outcome banner when done */}
        <AnimatePresence>
          {flowStep >= chain.length - 1 && flowStep >= 0 && (() => {
            const last = chain[chain.length - 1];
            const outcome =
              last.st === 'critical' ? 'HARD BLOCK · Account frozen' :
              last.st === 'fail' ? `DECLINED · ${last.action}` :
              last.st === 'flag' ? 'SOFT DECLINE · Manual review' :
              'APPROVED · Code 00';
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'mt-3 rounded-lg border px-4 py-2.5 text-center',
                  ST_BG[last.st]
                )}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                  Decision Outcome
                </div>
                <div className="mt-0.5 text-sm font-bold">{outcome}</div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ─── Section 3: Trace Chain Panel (Source TAL ↔ Rule ↔ Target Java) ──────
function TraceChainPanel({ step }) {
  const [hoveredVar, setHoveredVar] = useState(null);

  // Generate deterministic-looking hashes from the rule id so they stay
  // stable across re-renders for the same rule.
  const hashes = useMemo(() => {
    const seed = step.id.charCodeAt(1) * 13 + step.id.charCodeAt(2) * 7 + step.id.charCodeAt(3);
    const hex = (n) => Math.abs(Math.sin(seed * n) * 16777215).toString(16).slice(0, 8).padEnd(8, '0');
    return [
      { hash: hex(1), label: 'Source extracted', actor: 'TAL Parser', when: 't+0ms' },
      { hash: hex(2), label: 'Rule classified',  actor: 'AST Analyzer', when: 't+12ms' },
      { hash: hex(3), label: 'Target generated', actor: 'AI Synthesizer', when: 't+340ms' },
      { hash: hex(4), label: 'Test validated',   actor: 'Reconciler', when: 't+580ms' },
    ];
  }, [step.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border bg-muted/30 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Bidirectional Trace · {step.id}
          </div>
          <h3 className="mt-1 font-serif text-lg font-bold">{step.rule}</h3>
        </div>
        <Badge
          className={cn('border text-[10px]', ST_BG[step.st])}
        >
          {ST_LABELS[step.st]}
        </Badge>
      </div>

      {/* 3-column layout */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* SOURCE TAL */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Source TAL
            </div>
            <div className="mb-1 font-mono text-xs font-bold text-foreground">{step.file}</div>
            <div className="mb-3 font-mono text-[10px] text-muted-foreground">
              Lines {step.lines} · {step.routine}
            </div>
            <CodeBlock code={step.tal} className="mb-3 max-h-[120px]" />
            <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Tracked Variables
            </div>
            <div className="space-y-1">
              {step.vars.map((v, i) => {
                const color = `hsl(${(i * 80) % 360} 70% 50%)`;
                const isActive = hoveredVar === i;
                return (
                  <button
                    key={v.tal}
                    onMouseEnter={() => setHoveredVar(i)}
                    onMouseLeave={() => setHoveredVar(null)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded border px-2 py-1 text-left font-mono text-[10px] transition-all',
                      isActive ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/50'
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    <span className="text-foreground">{v.tal}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* RULE (center) */}
        <Card className="relative border-accent/40 bg-accent/5">
          <CardContent className="p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-accent">
              Rule {step.id}
            </div>
            <div className="mb-3 font-serif text-base font-bold">{step.rule}</div>
            <div className="space-y-2 text-xs">
              <Row label="Domain" value={step.domain} />
              <Row label="Criticality" value={step.crit} valueClass="font-bold" />
              <Row label="Type" value="Code" />
              <Row label="Decision" value={step.action} valueClass="text-foreground" />
            </div>
            <div className="mt-3 rounded-md border border-border bg-card p-2.5">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Regulatory
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-foreground">{step.regulation}</div>
            </div>

            {/* SVG variable connectors — only on lg screens */}
            <svg
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {step.vars.map((v, i) => {
                const color = `hsl(${(i * 80) % 360} 70% 50%)`;
                const y = 70 + i * 10;
                const isActive = hoveredVar === i;
                return (
                  <g key={i}>
                    <line
                      x1="-30" y1={y} x2="0" y2={y}
                      stroke={color}
                      strokeWidth={isActive ? 1.5 : 0.6}
                      strokeDasharray="2 1.5"
                      opacity={isActive ? 1 : 0.5}
                      style={{
                        animation: isActive ? 'dashFlow 1.2s linear infinite' : undefined,
                      }}
                    />
                    <line
                      x1="100" y1={y} x2="130" y2={y}
                      stroke={color}
                      strokeWidth={isActive ? 1.5 : 0.6}
                      strokeDasharray="2 1.5"
                      opacity={isActive ? 1 : 0.5}
                      style={{
                        animation: isActive ? 'dashFlow 1.2s linear infinite' : undefined,
                      }}
                    />
                  </g>
                );
              })}
            </svg>
          </CardContent>
        </Card>

        {/* TARGET JAVA */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              Target Java
            </div>
            <div className="mb-1 font-mono text-xs font-bold text-foreground">
              {step.file.replace('.TAL', 'Service.java').replace('-Policy', 'Service.java')}
            </div>
            <div className="mb-3 font-mono text-[10px] text-muted-foreground">
              Spring Boot · Java 17
            </div>
            <CodeBlock code={step.java} className="mb-3 max-h-[120px]" />
            <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Tracked Variables
            </div>
            <div className="space-y-1">
              {step.vars.map((v, i) => {
                const color = `hsl(${(i * 80) % 360} 70% 50%)`;
                const isActive = hoveredVar === i;
                return (
                  <button
                    key={v.java}
                    onMouseEnter={() => setHoveredVar(i)}
                    onMouseLeave={() => setHoveredVar(null)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded border px-2 py-1 text-left font-mono text-[10px] transition-all',
                      isActive ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/50'
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    <span className="text-foreground">{v.java}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit hash chain */}
      <div className="mt-5 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Hash className="h-3.5 w-3.5 text-accent" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Audit Chain
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {hashes.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="rounded-md border border-accent/30 bg-accent/5 px-2.5 py-2 text-center"
                title={`${h.actor} · ${h.when}`}
              >
                <div className="font-mono text-[11px] font-bold text-accent">[{h.hash}]</div>
                <div className="mt-0.5 text-[9px] text-muted-foreground">{h.label}</div>
              </div>
              {i < hashes.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Each hash links to the previous. Tamper-evident. Immutable. If any link
          breaks, the entire chain is invalidated and the regulator is alerted.
        </p>
      </div>
    </motion.div>
  );
}

function Row({ label, value, valueClass }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-xs', valueClass)}>{value}</span>
    </div>
  );
}

// ─── Top-level LineageTab ────────────────────────────────────────────────
export function LineageTab() {
  const [txn, setTxn] = useState({
    pan: '4532015112830366', amount: 2847.5, mcc: '5411', country: 'CA',
    vel: 18, expiry: '08/2027', status: 'ACTIVE', balance: 1200, limit: 5000, watchlist: false,
  });
  const [flowStep, setFlowStep] = useState(-1);
  const [selected, setSelected] = useState(null);
  const [activePreset, setActivePreset] = useState('velocity');
  const timer = useRef(null);

  const chain = useMemo(() => buildChain(txn), [txn]);

  // Reset selection if it points at a step that's not in the new chain
  useEffect(() => {
    if (selected && !chain.find((c) => c.id === selected.id)) setSelected(null);
  }, [chain, selected]);

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
      timer.current = setTimeout(go, 480);
    };
    setTimeout(go, 100);
  }, [chain.length]);
  const stepOnce = () => {
    if (flowStep < chain.length - 1) setFlowStep(flowStep + 1);
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.k);
    setTxn({ ...txn, ...preset.v });
    reset();
  };

  return (
    <div className="px-6 py-6">
      {/* Title */}
      <div className="mb-5">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Live Transaction Lineage</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Pick a scenario, run the flow, then click any gate to see the bidirectional
          trace from source TAL to target Java with the immutable audit chain.
        </p>
      </div>

      {/* SECTION 1 — The Zen+ Promise */}
      <ZenPlusPromise />

      {/* Transaction input + scenario presets */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-accent" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Transaction
            </div>
            <div className="ml-auto flex gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="font-mono">
                ${Number(txn.amount).toLocaleString()}
              </Badge>
              <Badge variant="outline" className="gap-1 font-mono">
                <Globe className="h-2.5 w-2.5" />
                {txn.country}
              </Badge>
              <Badge variant="outline" className="gap-1 font-mono">
                <Activity className="h-2.5 w-2.5" />
                vel {txn.vel}
              </Badge>
              {txn.watchlist && (
                <Badge variant="destructive" className="gap-1 font-mono">
                  <Flag className="h-2.5 w-2.5" />
                  watchlist
                </Badge>
              )}
            </div>
          </div>

          {/* Preset cards */}
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {PRESETS.map((p) => {
              const active = activePreset === p.k;
              return (
                <button
                  key={p.k}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-all',
                    active ? 'shadow-md' : 'opacity-80 hover:opacity-100'
                  )}
                  style={{ borderColor: active ? p.color : 'hsl(var(--border))' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-xs font-bold">{p.l}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">{p.sub}</div>
                </button>
              );
            })}
          </div>

          {/* Editable inputs (compact, collapsible feel) */}
          <details className="text-xs">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
              Edit raw fields
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
              {[
                { k: 'pan', l: 'PAN' }, { k: 'amount', l: 'Amount' },
                { k: 'mcc', l: 'MCC' }, { k: 'country', l: 'Country' },
                { k: 'vel', l: 'Velocity' }, { k: 'limit', l: 'Limit' },
                { k: 'balance', l: 'Balance' },
              ].map((f) => (
                <div key={f.k}>
                  <label className="mb-1 block text-[9px] uppercase tracking-wider text-muted-foreground">
                    {f.l}
                  </label>
                  <Input
                    className="h-7 font-mono text-[10px]"
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
          </details>
        </CardContent>
      </Card>

      {/* SECTION 2 — Horizontal Pipeline */}
      <PipelineFlow
        chain={chain}
        flowStep={flowStep}
        runAll={runAll}
        step={stepOnce}
        reset={reset}
        onSelectGate={setSelected}
        selectedId={selected?.id}
      />

      {/* SECTION 3 — Bidirectional Trace Chain */}
      <AnimatePresence>
        {selected && <TraceChainPanel key={selected.id} step={selected} />}
      </AnimatePresence>

      {!selected && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Trace Chain
          </div>
          <p className="text-sm text-muted-foreground">
            Run the flow above, then click any completed gate to see its source TAL,
            rule metadata, target Java, and audit chain.
          </p>
        </div>
      )}
    </div>
  );
}
