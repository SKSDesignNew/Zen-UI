import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, RotateCcw, X, Lock, Link2, ShieldCheck, Check, CheckCircle2, XCircle,
  AlertTriangle, CreditCard, Flag, Globe, Activity, ChevronRight, Hash,
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
// ─── D+L+T proof data (real TAL from PMTAPPR.tal / PMTEFT.tal) ───────────
const DLT_PROOFS = {
  D: {
    color: '#fbbf24',
    title: 'Run It Twice. Watch.',
    talSource: `INT PROC CHECK^PAYMENT^AUTHORITY(REQ, AUTH^REC);
  CASE REQ.PAYMENT^TYPE OF
  BEGIN
    PMT^TYPE^MEDICAL    -> LIMIT := AUTH^REC.MEDICAL^LIMIT;
    PMT^TYPE^INDEMNITY  -> LIMIT := AUTH^REC.INDEMNITY^LIMIT;
    PMT^TYPE^LEGAL      -> LIMIT := AUTH^REC.LEGAL^LIMIT;
    PMT^TYPE^SETTLEMENT -> LIMIT := AUTH^REC.SETTLEMENT^LIMIT;
    OTHERWISE           -> LIMIT := AUTH^REC.SINGLE^PMT^LIMIT;
  END;
  IF REQ.PAYMENT^AMOUNT <= LIMIT AND
     REQ.PAYMENT^AMOUNT <= AUTH^REC.SINGLE^PMT^LIMIT THEN
    RETURN 1
  ELSE RETURN 0;`,
    llmRun1: `public boolean check(PaymentReq req, AuthRecord auth) {
  BigDecimal limit;
  switch (req.getType()) {
    case MEDICAL:    limit = auth.getMedicalLimit();    break;
    case INDEMNITY:  limit = auth.getIndemnityLimit();  break;
    case LEGAL:      limit = auth.getLegalLimit();      break;
    case SETTLEMENT: limit = auth.getSettlementLimit(); break;
    default:         limit = auth.getSinglePmtLimit();
  }
  return req.getAmount().compareTo(limit) <= 0
      && req.getAmount().compareTo(auth.getSinglePmtLimit()) <= 0;
}`,
    llmRun2: `public boolean checkAuth(Request request, AuthorityRec rec) {
  BigDecimal limit = getApplicableLimit(request, rec);
  return request.getAmount().compareTo(limit) <= 0;
}
// ⚠ MISSING: AND check against SINGLE^PMT^LIMIT was dropped`,
    llmDiffs: [
      { label: 'Method name',    run1: 'check',                   run2: 'checkAuth' },
      { label: 'Param types',    run1: 'PaymentReq, AuthRecord',  run2: 'Request, AuthorityRec' },
      { label: 'Lines of code',  run1: '14',                       run2: '8' },
      { label: 'AND check',      run1: '✓ Present',                run2: '✗ MISSING' },
    ],
    zenRun: `public boolean checkPaymentAuthority(
    PaymentApprovalReq req, PaymentAuthRec auth) {
  BigDecimal limit;
  switch (req.getPaymentType()) {
    case MEDICAL:    limit = auth.getMedicalLimit();    break;
    case INDEMNITY:  limit = auth.getIndemnityLimit();  break;
    case LEGAL:      limit = auth.getLegalLimit();      break;
    case SETTLEMENT: limit = auth.getSettlementLimit(); break;
    default:         limit = auth.getSinglePmtLimit();
  }
  return req.getPaymentAmount().compareTo(limit) <= 0
      && req.getPaymentAmount().compareTo(
         auth.getSinglePmtLimit()) <= 0;
}`,
    point:
      'The LLM produced different method names, different parameter types, and Run 2 dropped a critical business rule (the AND check against SINGLE^PMT^LIMIT). ZenPlus produced identical output both times because it parses the AST, not the vibes.',
  },
  L: {
    color: '#10b981',
    title: 'Ask Where It Came From.',
    javaCode: `public boolean validateRoutingNumber(String rtn) {
  int[] d = rtn.chars().map(c -> c - '0').toArray();
  int checksum = 3 * (d[0] + d[3] + d[6])
               + 7 * (d[1] + d[4] + d[7])
               +     (d[2] + d[5] + d[8]);
  return checksum % 10 == 0;
}`,
    llmAnswer:
      '"This method validates ABA routing numbers using the standard checksum algorithm. It was likely generated from a legacy validation routine."',
    llmMissing: [
      'Source file',
      'Line number',
      'Original routine',
      'Audit hash',
      'Conversion date',
    ],
    zenMeta: [
      { label: 'Source',      value: 'PMTEFT.tal' },
      { label: 'Lines',       value: '42–58' },
      { label: 'Routine',     value: 'VALIDATE^ROUTING^NUMBER' },
      { label: 'Rule',        value: 'R-PMT-007' },
      { label: 'Domain',      value: 'Settlement' },
      { label: 'Regulatory',  value: 'NACHA Operating Rules' },
      { label: 'Called by',   value: 'ADD^PAYMENT^TO^BATCH' },
      { label: 'SHA',         value: '7c4a2e1f' },
      { label: 'Converted',   value: '2025-03-15T09:41:22Z' },
      { label: 'Approved',    value: 'compliance-review-agent' },
    ],
    talSource: `INT PROC VALIDATE^ROUTING^NUMBER(RTN);
  STRING .RTN[0:8];
BEGIN
  INT D1,D2,D3,D4,D5,D6,D7,D8,D9;
  INT CHECKSUM;
  D1:=RTN[0]-"0"; D2:=RTN[1]-"0"; D3:=RTN[2]-"0";
  D4:=RTN[3]-"0"; D5:=RTN[4]-"0"; D6:=RTN[5]-"0";
  D7:=RTN[6]-"0"; D8:=RTN[7]-"0"; D9:=RTN[8]-"0";
  CHECKSUM := 3*(D1+D4+D7) + 7*(D2+D5+D8) + (D3+D6+D9);
  IF CHECKSUM - ((CHECKSUM/10)*10) = 0 THEN RETURN 1;
  RETURN 0;
END;`,
    point:
      "When a regulator asks 'where did this code come from?', the LLM says 'likely from a legacy routine.' ZenPlus says 'PMTEFT.tal, line 42, VALIDATE^ROUTING^NUMBER, SHA 7c4a2e1f.' One is a guess. The other is evidence.",
  },
  T: {
    color: '#3b82f6',
    title: 'Why Was This Payment Held?',
    scenario: '$12,500 payment to Dr. Smith for claim WC-2024-00847',
    llmAudit:
      "I'll process the payment. The amount of $12,500 appears to be within normal parameters. However, I notice there may be some lien considerations. Let me check… Based on the available information, this payment should be held for review due to potential lien obligations.",
    steps: [
      { id: 'R-PMT-001', name: 'Auth Check', result: 'pass', detail: 'User JSMITH has $25K medical authority' },
      { id: 'R-PMT-002', name: 'Duplicate',  result: 'pass', detail: 'No matching claim+provider+date in 30-day window' },
      { id: 'R-PMT-003', name: 'Bill Review', result: 'pass', detail: 'MBR approved, allowed amount $12,500' },
      { id: 'R-PMT-004', name: 'Indemnity',  result: 'skip', detail: 'N/A — medical payment, not indemnity' },
      { id: 'R-PMT-005', name: 'Lien Check', result: 'hold', detail: 'IRS lien found: $3,200 at 25.6% of gross. Net: $9,300' },
    ],
    lienDetail: {
      type: 'IRS (LIEN^TYPE = 2)',
      amount: '$3,200',
      pct: '25.6%',
      net: '$9,300',
      source: 'PMTAPPR.TAL:CHECK^LIENS line 180',
    },
    hashes: ['a3f8c2', '7b2d4f', 'c8e1a3', 'd4e9f1', '2b7c8a'],
    badges: ['Replayable', 'Immutable', 'Auditable', 'Deterministic'],
    point:
      "The LLM gives you a conversation. ZenPlus gives you a chain of evidence: 5 rules evaluated in sequence, each with source file, line number, and cryptographic hash. The chain is immutable — if anyone changes one link, the entire chain invalidates. That's not a feature. That's a legal requirement.",
  },
};

function ZenPlusPromise() {
  const [activePillar, setActivePillar] = useState(null);

  const pillars = [
    {
      key: 'D', Icon: Lock, title: 'D+', subtitle: 'DETERMINISTIC',
      tagline: 'Same input = Same output. Every time.',
      proof: (
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
              <Check className="h-2.5 w-2.5" />
              Run {n}
            </div>
          ))}
        </div>
      ),
      llm: 'LLM: 3 runs, 3 different outputs',
    },
    {
      key: 'L', Icon: Link2, title: 'L+', subtitle: 'LINEAGE',
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
      key: 'T', Icon: ShieldCheck, title: 'T+', subtitle: 'TRACEABLE',
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
        {activePillar && (
          <button
            onClick={() => setActivePillar(null)}
            className="text-[10px] font-semibold uppercase tracking-widest text-white/50 transition-colors hover:text-white"
          >
            close ✕
          </button>
        )}
      </div>

      {/* Three pillar cards */}
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
            const isActive = activePillar === p.key;
            const proofColor = DLT_PROOFS[p.key].color;
            return (
              <button
                key={p.key}
                onClick={() => setActivePillar(isActive ? null : p.key)}
                className={cn(
                  'group relative rounded-xl border-2 p-5 text-left backdrop-blur-sm transition-all duration-300',
                  isActive
                    ? 'scale-[1.02] bg-white/[0.08]'
                    : 'border-white/15 bg-white/[0.04] hover:scale-[1.02] hover:bg-white/[0.08]'
                )}
                style={
                  isActive
                    ? { borderColor: proofColor, boxShadow: `0 0 24px ${proofColor}40` }
                    : undefined
                }
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
                    style={{ background: `${proofColor}26`, color: proofColor }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-serif text-2xl font-bold" style={{ color: proofColor }}>
                      {p.title}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                      {p.subtitle}
                    </div>
                  </div>
                </div>
                <p className="mb-3 text-sm font-semibold text-white">{p.tagline}</p>
                <div className="mb-3 rounded-lg border border-white/10 bg-black/30 p-2.5">
                  {p.proof}
                </div>
                <div className="mb-2 text-[10px] italic text-white/40">{p.llm}</div>

                {/* Hover hint + active chevron */}
                <div
                  className={cn(
                    'flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest transition-opacity',
                    isActive
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  )}
                  style={{ color: proofColor }}
                >
                  {isActive ? '✓ proof open below' : 'click to see proof →'}
                </div>
                {isActive && (
                  <div
                    className="absolute -bottom-3 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 50%, hsl(var(--card)) 50%)',
                      borderRight: `2px solid ${proofColor}`,
                      borderBottom: `2px solid ${proofColor}`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Proof panel slides open below */}
      <AnimatePresence>
        {activePillar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-6">
              {activePillar === 'D' && <DProof />}
              {activePillar === 'L' && <LProof />}
              {activePillar === 'T' && <TProof />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes dashFlow {
          to { stroke-dashoffset: -10; }
        }
      `}</style>
    </section>
  );
}

// ─── D+ Proof: Run It Twice. Watch. ───────────────────────────────────────
function DProof() {
  const d = DLT_PROOFS.D;
  return (
    <div
      className="rounded-2xl border-l-4 bg-black/40 p-5 backdrop-blur-sm"
      style={{ borderLeftColor: d.color }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: d.color }}>
            D+ Proof
          </div>
          <h3 className="font-serif text-lg font-bold text-white">{d.title}</h3>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-white/60">
          Source TAL · PMTAPPR.tal · CHECK^PAYMENT^AUTHORITY (never changes)
        </div>
        <pre className="overflow-auto rounded-lg border border-white/15 bg-black/60 p-3 font-mono text-[10px] leading-snug text-white/85">
          <code>{d.talSource}</code>
        </pre>
      </div>

      {/* LLM runs */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <XCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
            LLM: same input → different output
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <RunCard kind="bad" label="LLM Run 1">
            <pre className="font-mono text-[10px] leading-snug">{d.llmRun1}</pre>
          </RunCard>
          <RunCard kind="bad" label="LLM Run 2">
            <pre className="font-mono text-[10px] leading-snug">{d.llmRun2}</pre>
          </RunCard>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          {d.llmDiffs.map((diff) => (
            <div
              key={diff.label}
              className="rounded border border-red-500/30 bg-red-500/5 px-2 py-1"
            >
              <span className="text-red-300/70">{diff.label}: </span>
              <span className="font-mono text-red-300">{diff.run1}</span>
              <span className="text-red-300/40"> ≠ </span>
              <span className="font-mono text-red-300">{diff.run2}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ZenPlus runs */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            ZenPlus: same input → identical output, every run
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <RunCard kind="good" label="ZenPlus Run 1">
            <pre className="font-mono text-[10px] leading-snug">{d.zenRun}</pre>
          </RunCard>
          <RunCard kind="good" label="ZenPlus Run 2">
            <pre className="font-mono text-[10px] leading-snug">{d.zenRun}</pre>
          </RunCard>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-300">
          <Check className="h-3.5 w-3.5" />
          IDENTICAL · character-for-character · both AND-checks preserved
        </div>
      </div>

      <ThePoint color={d.color}>{d.point}</ThePoint>
    </div>
  );
}

// ─── L+ Proof: Ask Where It Came From. ────────────────────────────────────
function LProof() {
  const l = DLT_PROOFS.L;
  return (
    <div
      className="rounded-2xl border-l-4 bg-black/40 p-5 backdrop-blur-sm"
      style={{ borderLeftColor: l.color }}
    >
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: l.color }}>
          L+ Proof
        </div>
        <h3 className="font-serif text-lg font-bold text-white">{l.title}</h3>
        <p className="mt-1 text-xs text-white/60">
          This Java method exists in production. Where did it come from?
        </p>
      </div>

      <pre className="mb-4 overflow-auto rounded-lg border border-white/15 bg-black/60 p-3 font-mono text-[10px] leading-snug text-white/85">
        <code>{l.javaCode}</code>
      </pre>

      <div className="grid gap-3 md:grid-cols-2">
        {/* LLM */}
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
              LLM: where did this come from?
            </span>
          </div>
          <p className="mb-3 rounded border border-red-500/20 bg-black/30 p-2 text-[11px] italic leading-relaxed text-white/70">
            🤖 {l.llmAnswer}
          </p>
          <div className="space-y-1">
            {l.llmMissing.map((m) => (
              <div key={m} className="flex items-center gap-2 text-[10px] text-red-300">
                <XCircle className="h-3 w-3 flex-shrink-0" />
                <span>{m}: </span>
                <span className="font-mono italic text-red-300/70">unknown</span>
              </div>
            ))}
          </div>
        </div>

        {/* ZenPlus */}
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              ZenPlus: where did this come from?
            </span>
          </div>
          <div className="mb-3 space-y-1">
            {l.zenMeta.map((m) => (
              <div key={m.label} className="flex items-center gap-2 text-[10px]">
                <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-emerald-400" />
                <span className="w-20 text-emerald-300/70">{m.label}</span>
                <span className="font-mono text-emerald-200">{m.value}</span>
              </div>
            ))}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
            Original TAL · embedded
          </div>
          <pre className="mt-1 overflow-auto rounded border border-emerald-500/20 bg-black/40 p-2 font-mono text-[9px] leading-snug text-emerald-100/85">
            <code>{l.talSource}</code>
          </pre>
        </div>
      </div>

      <ThePoint color={l.color}>{l.point}</ThePoint>
    </div>
  );
}

// ─── T+ Proof: Why Was This Payment Held? ────────────────────────────────
function TProof() {
  const t = DLT_PROOFS.T;
  const stepColor = (r) =>
    r === 'pass' ? '#10b981' : r === 'hold' ? '#f59e0b' : r === 'skip' ? '#94a3b8' : '#ef4444';
  return (
    <div
      className="rounded-2xl border-l-4 bg-black/40 p-5 backdrop-blur-sm"
      style={{ borderLeftColor: t.color }}
    >
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.color }}>
          T+ Proof
        </div>
        <h3 className="font-serif text-lg font-bold text-white">{t.title}</h3>
        <p className="mt-1 text-xs text-white/60">{t.scenario} was HELD. Why?</p>
      </div>

      {/* LLM audit */}
      <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <XCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
            LLM Audit Trail
          </span>
        </div>
        <div className="rounded border border-red-500/20 bg-black/30 p-3 font-mono text-[10px] italic leading-relaxed text-white/65">
          <span className="text-white/40">User: </span>
          Process payment for claim WC-2024-00847
          <br />
          <span className="text-white/40">Assistant: </span>
          {t.llmAudit}
        </div>
        <div className="mt-2 space-y-1">
          {[
            'Is this auditable? Can you prove it wasn\'t edited?',
            'Can you replay this decision with different inputs?',
            'Will this produce the same result tomorrow?',
          ].map((q, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px] text-red-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ZenPlus audit chain */}
      <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            ZenPlus Audit Chain — 5 rules in sequence
          </span>
        </div>

        {/* Pipeline of 5 steps */}
        <div className="mb-3 grid grid-cols-5 gap-1.5">
          {t.steps.map((s, i) => {
            const c = stepColor(s.result);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded border bg-black/40 p-2 text-center"
                style={{ borderColor: `${c}80` }}
              >
                <div className="font-mono text-[8px] text-white/50">{s.id}</div>
                <div className="text-[10px] font-bold text-white">{s.name}</div>
                <div
                  className="mt-1 text-[9px] font-bold uppercase"
                  style={{ color: c }}
                >
                  {s.result === 'pass' && '✓ pass'}
                  {s.result === 'hold' && '⚠ hold'}
                  {s.result === 'skip' && '— skip'}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Lien detail */}
        <div className="mb-3 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[10px]">
          <div className="mb-1 flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            R-PMT-005: Lien found
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-amber-100/80">
            <span>Type: {t.lienDetail.type}</span>
            <span>Amount: {t.lienDetail.amount}</span>
            <span>Deduction: {t.lienDetail.pct}</span>
            <span>Net payment: {t.lienDetail.net}</span>
            <span className="col-span-2 text-amber-300/60">Source: {t.lienDetail.source}</span>
          </div>
        </div>

        {/* Hash chain */}
        <div className="mb-3">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400">
            Cryptographic Hash Chain
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {t.hashes.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="rounded border border-emerald-500/30 bg-black/40 px-2 py-1 font-mono text-[10px] text-emerald-300">
                  [{h}]
                </div>
                {i < t.hashes.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-emerald-500/60" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[9px] italic text-white/50">
            Each hash includes the previous. Tamper any link → entire chain invalidates.
          </p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {t.badges.map((b) => (
            <span
              key={b}
              className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300"
            >
              <Check className="h-2.5 w-2.5" />
              {b}
            </span>
          ))}
        </div>
      </div>

      <ThePoint color={t.color}>{t.point}</ThePoint>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────
function RunCard({ kind, label, children }) {
  const isBad = kind === 'bad';
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isBad ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
      )}
    >
      <div
        className={cn(
          'mb-1 text-[9px] font-bold uppercase tracking-widest',
          isBad ? 'text-red-400' : 'text-emerald-400'
        )}
      >
        {label}
      </div>
      <div className={cn('overflow-auto', isBad ? 'text-red-100/85' : 'text-emerald-100/85')}>
        {children}
      </div>
    </div>
  );
}

function ThePoint({ color, children }) {
  return (
    <div
      className="mt-4 rounded-lg border-l-4 bg-white/[0.04] p-3"
      style={{ borderLeftColor: color }}
    >
      <div className="mb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
        The Point
      </div>
      <p className="text-xs leading-relaxed text-white/85">{children}</p>
    </div>
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
