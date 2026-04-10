import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, FastForward, Check, Lock, Link2, ShieldCheck, ChevronRight,
  ChevronDown, FileText, Code2, Cpu, Hash, Folder, FolderOpen, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ════════════════════════════════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════════════════════════════════

const FINAL = { lines: 1_000_000, rules: 2000, deps: 4832, xrefs: 312 };
const SCAN_MS = 8000;

const REAL_FILES = [
  { name: 'PMTPROC.tal',    lines: 195, procs: 5,  rules: 3, xrefs: 2 },
  { name: 'PMTAPPR.tal',    lines: 520, procs: 8,  rules: 6, xrefs: 1 },
  { name: 'PMTEFT.tal',     lines: 540, procs: 12, rules: 4, xrefs: 1 },
  { name: 'FNOLPROC.tal',   lines: 390, procs: 9,  rules: 4, xrefs: 1 },
  { name: 'CLMSETUP.tal',   lines: 410, procs: 7,  rules: 3, xrefs: 2 },
  { name: 'CLMPROC.tal',    lines: 130, procs: 4,  rules: 2, xrefs: 1 },
  { name: 'CLMDIARY.tal',   lines: 420, procs: 6,  rules: 2, xrefs: 0 },
  { name: 'MEDBILL.tal',    lines: 460, procs: 8,  rules: 5, xrefs: 2 },
  { name: 'RSVRCALC.tal',   lines: 470, procs: 7,  rules: 4, xrefs: 1 },
  { name: 'RSVRHIST.tal',   lines: 480, procs: 6,  rules: 3, xrefs: 0 },
  { name: 'WCBENCALC.tal',  lines: 550, procs: 9,  rules: 5, xrefs: 1 },
  { name: 'WCCOMP.tal',     lines: 580, procs: 11, rules: 6, xrefs: 2 },
  { name: 'WCEXMOD.tal',    lines: 450, procs: 7,  rules: 4, xrefs: 1 },
  { name: 'WCJURIS.tal',    lines: 530, procs: 10, rules: 7, xrefs: 3 },
  { name: 'WCLEGAL.tal',    lines: 500, procs: 8,  rules: 4, xrefs: 1 },
  { name: 'WCPHARM.tal',    lines: 520, procs: 9,  rules: 5, xrefs: 2 },
  { name: 'WCPPDRATE.tal',  lines: 540, procs: 8,  rules: 4, xrefs: 1 },
  { name: 'WCSIU.tal',      lines: 490, procs: 7,  rules: 5, xrefs: 2 },
  { name: 'WCWAGE.tal',     lines: 500, procs: 8,  rules: 4, xrefs: 1 },
  { name: 'POLMAINT.tal',   lines: 170, procs: 4,  rules: 2, xrefs: 0 },
];

const TIERS = [
  { key: 'critical', label: 'CRITICAL', count: 14,    color: '#8b1a1a', tagline: 'Change = production incident' },
  { key: 'high',     label: 'HIGH',     count: 186,   color: '#c45c3e', tagline: 'Regulatory compliance at stake' },
  { key: 'medium',   label: 'MEDIUM',   count: 623,   color: '#d97706', tagline: 'Core business logic' },
  { key: 'low',      label: 'LOW',      count: 1177,  color: '#94a3b8', tagline: 'Utilities, formatting, logs' },
];

const CRITICAL_RULES = [
  { id: 'R-PMT-001', name: 'Payment Authority Check',     domain: 'Authorization', source: 'PMTAPPR.TAL:CHECK^PAYMENT^AUTHORITY', reg: 'SOX Section 302',          english: 'Each user has dollar limits by payment type. Exceed = escalation required.',          java: 'PaymentAuthorityService.checkAuthority()',     file: 'PMTAPPR.tal',  routine: 'CHECK^PAYMENT^AUTHORITY',   cls: 'PaymentAuthorityService',     pkg: 'com.zenplus.payment' },
  { id: 'R-PMT-002', name: 'Duplicate Payment Detection', domain: 'Fraud',         source: 'PMTAPPR.TAL:CHECK^DUPLICATE^PAYMENT', reg: 'OIG Fraud Prevention',     english: 'Same provider + same date + same amount within 30 days = hold as duplicate.',         java: 'DuplicateDetectionService.checkDuplicate()',    file: 'PMTAPPR.tal',  routine: 'CHECK^DUPLICATE^PAYMENT',  cls: 'DuplicateDetectionService',   pkg: 'com.zenplus.payment' },
  { id: 'R-PMT-003', name: 'Medical Bill Review Gate',    domain: 'Compliance',    source: 'PMTAPPR.TAL:CHECK^MEDICAL^BILL^REVIEW', reg: 'State WC Fee Schedule',  english: 'Medical bills must be reviewed before payment. Reduced = pay allowed amount.',         java: 'MedicalBillReviewService.checkReview()',        file: 'PMTAPPR.tal',  routine: 'CHECK^MEDICAL^BILL^REVIEW', cls: 'MedicalBillReviewService',    pkg: 'com.zenplus.payment' },
  { id: 'R-PMT-004', name: 'Indemnity Schedule Validation', domain: 'Benefits',    source: 'PMTAPPR.TAL:CHECK^INDEMNITY^SCHEDULE', reg: 'State WC Benefit Regs',   english: 'Indemnity payments must match approved schedule dates and weekly rate.',              java: 'IndemnityScheduleService.validate()',           file: 'PMTAPPR.tal',  routine: 'CHECK^INDEMNITY^SCHEDULE',  cls: 'IndemnityScheduleService',    pkg: 'com.zenplus.payment' },
  { id: 'R-PMT-005', name: 'Lien & Garnishment Check',    domain: 'Compliance',    source: 'PMTAPPR.TAL:CHECK^LIENS',          reg: 'MSPRA — 42 USC 1395y',     english: 'Check for IRS, child support, attorney, Medicare liens. Deduct before payment.',     java: 'LienCheckService.checkLiens()',                 file: 'PMTAPPR.tal',  routine: 'CHECK^LIENS',               cls: 'LienCheckService',            pkg: 'com.zenplus.payment' },
  { id: 'R-PMT-006', name: '1099 Tax Tracking',           domain: 'Compliance',    source: 'PMTAPPR.TAL:UPDATE^1099^TRACKING', reg: 'IRS — 26 USC 6041',         english: 'Accumulate payments by payee TIN. Over $600 = flag for 1099 filing.',                  java: 'Tax1099TrackingService.update()',               file: 'PMTAPPR.tal',  routine: 'UPDATE^1099^TRACKING',      cls: 'Tax1099TrackingService',      pkg: 'com.zenplus.payment' },
  { id: 'R-PMT-007', name: 'ABA Routing Validation',      domain: 'Settlement',    source: 'PMTEFT.TAL:VALIDATE^ROUTING^NUMBER', reg: 'NACHA Operating Rules',   english: 'Validate 9-digit routing number using weighted checksum before any EFT.',             java: 'RoutingValidator.validateRoutingNumber()',      file: 'PMTEFT.tal',   routine: 'VALIDATE^ROUTING^NUMBER',   cls: 'RoutingValidator',            pkg: 'com.zenplus.eft' },
  { id: 'R-PMT-008', name: 'Prenote Verification',        domain: 'Risk',          source: 'PMTEFT.TAL:ADD^PAYMENT^TO^BATCH', reg: 'NACHA Prenote Rules',         english: 'New accounts must complete zero-dollar prenote before receiving live payments.',      java: 'PrenoteVerificationService.checkPrenote()',     file: 'PMTEFT.tal',   routine: 'ADD^PAYMENT^TO^BATCH',      cls: 'PrenoteVerificationService',  pkg: 'com.zenplus.eft' },
  { id: 'R-PMT-009', name: 'Dual Approval Release',       domain: 'Authorization', source: 'PMTEFT.TAL:RELEASE^BATCH',         reg: 'SOX — Segregation of Duties', english: 'EFT batches need 2 different approvers. Same person cannot approve twice.',          java: 'BatchReleaseService.releaseBatch()',            file: 'PMTEFT.tal',   routine: 'RELEASE^BATCH',             cls: 'BatchReleaseService',         pkg: 'com.zenplus.eft' },
  { id: 'R-PMT-010', name: 'ACH Return Suspension',       domain: 'Risk',          source: 'PMTEFT.TAL:PROCESS^RETURN',        reg: 'NACHA Return Threshold',     english: '3+ ACH returns = suspend EFT for that account, route to check.',                       java: 'AchReturnService.processReturn()',              file: 'PMTEFT.tal',   routine: 'PROCESS^RETURN',            cls: 'AchReturnService',            pkg: 'com.zenplus.eft' },
  { id: 'R-FNOL-001', name: 'Duplicate FNOL Detection',   domain: 'Fraud',         source: 'FNOLPROC.TAL:CHECK^DUPLICATE',     reg: 'NCCI Standards',             english: 'Same SSN + same injury date + same employer = duplicate claim.',                       java: 'FnolDuplicateService.checkDuplicate()',         file: 'FNOLPROC.tal', routine: 'CHECK^DUPLICATE',           cls: 'FnolDuplicateService',        pkg: 'com.zenplus.claims' },
  { id: 'R-FNOL-002', name: 'Injury Classification',      domain: 'Risk',          source: 'FNOLPROC.TAL:CLASSIFY^INJURY',     reg: 'OSHA 29 CFR 1904',           english: 'Classify injury: Medical Only, Lost Time, Permanent, Occupational, Fatality.',         java: 'InjuryClassificationService.classify()',        file: 'FNOLPROC.tal', routine: 'CLASSIFY^INJURY',           cls: 'InjuryClassificationService', pkg: 'com.zenplus.claims' },
  { id: 'R-FNOL-003', name: 'Adjuster Auto-Assignment',   domain: 'Operations',    source: 'FNOLPROC.TAL:FIND^ADJUSTER',       reg: 'NAIIA Standards',            english: 'Assign adjuster with lowest caseload in matching jurisdiction and team.',              java: 'AdjusterAssignmentService.findAdjuster()',      file: 'FNOLPROC.tal', routine: 'FIND^ADJUSTER',             cls: 'AdjusterAssignmentService',   pkg: 'com.zenplus.claims' },
  { id: 'R-FNOL-004', name: 'Jurisdiction Reserve Adj.',  domain: 'Risk',          source: 'FNOLPROC.TAL:GET^INITIAL^RESERVE', reg: 'Actuarial Reserve Standards', english: 'CA/NY/FL get +25% reserve. IL/PA/NJ get +20%. Based on state cost indices.',          java: 'ReserveCalculationService.getInitialReserve()', file: 'FNOLPROC.tal', routine: 'GET^INITIAL^RESERVE',       cls: 'ReserveCalculationService',   pkg: 'com.zenplus.claims' },
];

const DOMAIN_BARS = [
  { domain: 'Payments',     count: 412, pct: 20.6, color: '#4a7fb5' },
  { domain: 'Claims',       count: 347, pct: 17.4, color: '#7b6aab' },
  { domain: 'Fraud',        count: 298, pct: 14.9, color: '#c45c3e' },
  { domain: 'Compliance',   count: 243, pct: 12.2, color: '#2d8659' },
  { domain: 'Workers Comp', count: 189, pct: 9.5,  color: '#8b6914' },
  { domain: 'Reserve',      count: 158, pct: 7.9,  color: '#5c6bc0' },
  { domain: 'Legal',        count: 134, pct: 6.7,  color: '#455a64' },
  { domain: 'Settlement',   count: 98,  pct: 4.9,  color: '#00897b' },
  { domain: 'Operations',   count: 73,  pct: 3.7,  color: '#6d4c41' },
  { domain: 'Pharmacy',     count: 48,  pct: 2.4,  color: '#7b1fa2' },
];

// Source tree for Panel 1
const SOURCE_TREE = [
  { file: 'PMTPROC.tal',    lines: 195, routines: ['CREATE^PAYMENT', 'PROCESS^CHECK^BATCH', 'VOID^PAYMENT', 'RECONCILE^PAYMENTS', 'MAIN'] },
  { file: 'PMTAPPR.tal',    lines: 520, routines: ['CHECK^PAYMENT^AUTHORITY', 'CHECK^DUPLICATE^PAYMENT', 'CHECK^MEDICAL^BILL^REVIEW', 'CHECK^INDEMNITY^SCHEDULE', 'CHECK^LIENS', 'UPDATE^1099^TRACKING', 'PROCESS^PAYMENT^APPROVAL', 'PMTAPPR'] },
  { file: 'PMTEFT.tal',     lines: 540, routines: ['VALIDATE^ROUTING^NUMBER', 'FORMAT^FILE^HEADER', 'FORMAT^BATCH^HEADER', 'CREATE^BATCH', 'ADD^PAYMENT^TO^BATCH', 'RELEASE^BATCH', 'GENERATE^NACHA^FILE', 'PROCESS^RETURN'] },
  { file: 'FNOLPROC.tal',   lines: 390, routines: ['CHECK^DUPLICATE', 'CLASSIFY^INJURY', 'FIND^ADJUSTER', 'CREATE^DIARY', 'GET^INITIAL^RESERVE', 'PROCESS^FNOL', 'MAIN'] },
  { file: 'CLMSETUP.tal',   lines: 410, routines: [] },
  { file: 'CLMPROC.tal',    lines: 130, routines: [] },
  { file: 'CLMDIARY.tal',   lines: 420, routines: [] },
  { file: 'MEDBILL.tal',    lines: 460, routines: [] },
  { file: 'RSVRCALC.tal',   lines: 470, routines: [] },
  { file: 'RSVRHIST.tal',   lines: 480, routines: [] },
  { file: 'WCBENCALC.tal',  lines: 550, routines: [] },
  { file: 'WCCOMP.tal',     lines: 580, routines: [] },
  { file: 'WCJURIS.tal',    lines: 530, routines: [] },
  { file: 'WCLEGAL.tal',    lines: 500, routines: [] },
  { file: 'WCPHARM.tal',    lines: 520, routines: [] },
  { file: 'WCSIU.tal',      lines: 490, routines: [] },
];

const TARGET_TREE = [
  { pkg: 'com.zenplus.payment', classes: [
    { name: 'PaymentAuthorityService',     methods: ['checkAuthority()'], ruleId: 'R-PMT-001' },
    { name: 'DuplicateDetectionService',   methods: ['checkDuplicate()'], ruleId: 'R-PMT-002' },
    { name: 'MedicalBillReviewService',    methods: ['checkReview()'],    ruleId: 'R-PMT-003' },
    { name: 'IndemnityScheduleService',    methods: ['validate()'],       ruleId: 'R-PMT-004' },
    { name: 'LienCheckService',            methods: ['checkLiens()'],     ruleId: 'R-PMT-005' },
    { name: 'Tax1099TrackingService',      methods: ['update()'],         ruleId: 'R-PMT-006' },
  ]},
  { pkg: 'com.zenplus.eft', classes: [
    { name: 'RoutingValidator',            methods: ['validateRoutingNumber()'], ruleId: 'R-PMT-007' },
    { name: 'PrenoteVerificationService',  methods: ['checkPrenote()'],          ruleId: 'R-PMT-008' },
    { name: 'BatchReleaseService',         methods: ['releaseBatch()'],          ruleId: 'R-PMT-009' },
    { name: 'AchReturnService',            methods: ['processReturn()'],         ruleId: 'R-PMT-010' },
  ]},
  { pkg: 'com.zenplus.claims', classes: [
    { name: 'FnolDuplicateService',        methods: ['checkDuplicate()'], ruleId: 'R-FNOL-001' },
    { name: 'InjuryClassificationService', methods: ['classify()'],       ruleId: 'R-FNOL-002' },
    { name: 'AdjusterAssignmentService',   methods: ['findAdjuster()'],   ruleId: 'R-FNOL-003' },
    { name: 'ReserveCalculationService',   methods: ['getInitialReserve()'], ruleId: 'R-FNOL-004' },
  ]},
];

// ════════════════════════════════════════════════════════════════════════
// TOP-LEVEL TAB
// ════════════════════════════════════════════════════════════════════════

export function ZPlusResultsTab() {
  const act2Ref = useRef(null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <Badge variant="accent" className="mb-2 text-[10px] uppercase tracking-widest">
          Z+ Results
        </Badge>
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          The scan, the discovery, the navigator
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Three connected acts. Watch ZenPlus ingest a million lines of TAL, see what
          it found organized by risk, then navigate the full Source ↔ Rule ↔ Java tree
          with D+L+T at every step.
        </p>
      </div>

      <ActOneScan onComplete={() => setTimeout(() => act2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600)} />

      <div ref={act2Ref}>
        <ActTwoDiscovery />
      </div>

      <ActThreeNavigator />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ACT 1 — The Scan
// ════════════════════════════════════════════════════════════════════════

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function ActOneScan({ onComplete }) {
  const [phase, setPhase] = useState('ready'); // ready, scanning, complete
  const [counters, setCounters] = useState({ lines: 0, rules: 0, deps: 0, xrefs: 0 });
  const [progress, setProgress] = useState(0);
  const [feedIdx, setFeedIdx] = useState(0);
  const rafRef = useRef(null);

  const start = () => {
    setPhase('scanning');
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / SCAN_MS);
      const e = easeInOutCubic(t);
      setProgress(t * 100);
      setCounters({
        lines: Math.round(e * FINAL.lines),
        rules: Math.round(e * FINAL.rules),
        deps: Math.round(e * FINAL.deps),
        xrefs: Math.round(e * FINAL.xrefs),
      });
      setFeedIdx(Math.floor(e * REAL_FILES.length));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase('complete');
        onComplete?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const skip = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(100);
    setCounters({ ...FINAL });
    setFeedIdx(REAL_FILES.length);
    setPhase('complete');
    onComplete?.();
  };

  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  const currentFile = phase === 'scanning' && feedIdx < REAL_FILES.length
    ? REAL_FILES[feedIdx]
    : null;
  const completed = REAL_FILES.slice(0, feedIdx);

  return (
    <section className="mb-12 overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-2xl">
      <div className="border-b border-primary-foreground/10 px-6 py-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-accent">
          Act 1 · The Scan
        </div>
        <div className="mt-1 font-serif text-xl font-bold">The Codebase</div>
        <div className="text-xs text-primary-foreground/60">
          Workers' Compensation TPA — HPE NonStop (TAL) · 1,200 TAL files across 20 Pathway server classes
        </div>
      </div>

      <div className="p-6">
        {/* Progress bar */}
        <div className="mb-5">
          <div className="mb-1 flex items-center justify-between text-[10px] font-mono">
            <span className="text-primary-foreground/60">
              {phase === 'scanning' && currentFile ? `Scanning: ${currentFile.name}` : phase === 'complete' ? 'Scan complete' : 'Ready to scan'}
            </span>
            <span className="text-accent">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/10">
            <motion.div
              className="h-full bg-accent"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        {/* Counters */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <CounterCard Icon={FileText} value={counters.lines} label="Lines Scanned" />
          <CounterCard Icon={Code2}    value={counters.rules} label="Rules Found" />
          <CounterCard Icon={Link2}    value={counters.deps}  label="Dependencies" />
          <CounterCard Icon={Cpu}      value={counters.xrefs} label="Cross-File XREFs" />
        </div>

        {/* File feed */}
        <div className="mb-5 rounded-lg border border-primary-foreground/10 bg-primary-foreground/[0.03] p-3">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-primary-foreground/50">
            Live File Feed
          </div>
          <div className="max-h-[220px] space-y-0.5 overflow-y-auto font-mono text-[10px]">
            {completed.slice(-12).map((f) => (
              <FileRow key={f.name} file={f} state="done" />
            ))}
            {currentFile && <FileRow file={currentFile} state="active" />}
            {phase === 'ready' && (
              <div className="text-primary-foreground/40">
                Click "Run Scan" to start ingesting TAL files…
              </div>
            )}
            {phase !== 'ready' && feedIdx < REAL_FILES.length - 1 && (
              <div className="pt-1 text-primary-foreground/30">
                …{1200 - feedIdx} more files queued
              </div>
            )}
          </div>
        </div>

        {/* Controls or completion banner */}
        {phase !== 'complete' ? (
          <div className="flex items-center gap-2">
            <Button
              onClick={start}
              disabled={phase === 'scanning'}
              variant="accent"
              size="sm"
            >
              {phase === 'scanning' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Run Scan
                </>
              )}
            </Button>
            <Button onClick={skip} variant="outline" size="sm">
              <FastForward className="h-3.5 w-3.5" />
              Skip to Results
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-success/40 bg-success/10 p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-success">
              <Check className="h-4 w-4" />
              SCAN COMPLETE
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3 font-mono text-[11px] text-primary-foreground/85 md:grid-cols-4">
              <div>{FINAL.lines.toLocaleString()} lines</div>
              <div>{FINAL.rules.toLocaleString()} rules</div>
              <div>{FINAL.deps.toLocaleString()} deps</div>
              <div>{FINAL.xrefs} XREFs</div>
            </div>
            <div className="space-y-1 text-[11px] text-primary-foreground/70">
              <PromiseLine Icon={Lock}        label="D+" text="Every rule extracted deterministically from AST parse" />
              <PromiseLine Icon={Link2}       label="L+" text="Every rule linked to source file, line, and routine" />
              <PromiseLine Icon={ShieldCheck} label="T+" text="Every extraction logged with SHA hash in audit trail" />
            </div>
            <div className="mt-3 text-center text-[11px] italic text-accent">
              Scroll down to explore what we found ↓
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function CounterCard({ Icon, value, label }) {
  return (
    <div className="rounded-lg border border-primary-foreground/10 bg-primary-foreground/[0.04] p-3">
      <Icon className="mb-2 h-4 w-4 text-accent" />
      <div className="font-serif text-2xl font-bold tabular-nums text-primary-foreground">
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-primary-foreground/50">{label}</div>
    </div>
  );
}

function FileRow({ file, state }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded px-1.5 py-0.5',
        state === 'done' && 'text-success/80',
        state === 'active' && 'bg-accent/10 text-accent'
      )}
    >
      {state === 'done' ? (
        <Check className="h-3 w-3 flex-shrink-0" />
      ) : (
        <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
      )}
      <span className="w-32 truncate">{file.name}</span>
      <span className="w-12 text-right text-primary-foreground/40">{file.lines} ln</span>
      {state === 'done' && (
        <>
          <span className="text-primary-foreground/40">{file.procs} PROCs</span>
          <span className="text-primary-foreground/40">{file.rules} rules</span>
          <span className="text-primary-foreground/40">{file.xrefs} XREFs</span>
        </>
      )}
      {state === 'active' && <span>scanning…</span>}
    </div>
  );
}

function PromiseLine({ Icon, label, text }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-serif text-xs font-bold text-accent">{label}</span>
      <Icon className="h-3 w-3 text-accent" />
      <span>{text}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ACT 2 — The Discovery
// ════════════════════════════════════════════════════════════════════════

function ActTwoDiscovery() {
  const [tier, setTier] = useState('critical'); // open by default
  const [domain, setDomain] = useState(null);

  const filteredCritical = useMemo(() => {
    if (!domain) return CRITICAL_RULES;
    const map = {
      Payments: ['Authorization', 'Settlement'],
      Fraud: ['Fraud'],
      Compliance: ['Compliance'],
      Operations: ['Operations'],
      Risk: ['Risk'],
    };
    const allowedDomains = map[domain] || [];
    return CRITICAL_RULES.filter((r) => allowedDomains.includes(r.domain));
  }, [domain]);

  return (
    <section className="mb-12">
      <div className="mb-3">
        <Badge variant="accent" className="mb-2 text-[10px] uppercase tracking-widest">
          Act 2 · The Discovery
        </Badge>
        <h2 className="font-serif text-2xl font-bold tracking-tight">
          What we found — 2,000 rules by risk
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click any tier in the pyramid to see the rules in that risk band, or click a
          domain bar on the right to filter by business area.
        </p>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-5">
        {/* Pyramid (left) */}
        <Card className="md:col-span-3">
          <CardContent className="p-5">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Criticality Pyramid
            </div>
            <div className="space-y-1.5">
              {TIERS.map((t, i) => {
                const isActive = tier === t.key;
                const widthPct = 30 + i * 18; // 30, 48, 66, 84
                return (
                  <button
                    key={t.key}
                    onClick={() => setTier(isActive ? null : t.key)}
                    className={cn(
                      'mx-auto flex items-center justify-between rounded-lg border-2 px-4 py-2 text-left transition-all',
                      isActive ? 'shadow-md scale-[1.01]' : 'hover:scale-[1.01]'
                    )}
                    style={{
                      width: `${widthPct}%`,
                      borderColor: isActive ? t.color : 'hsl(var(--border))',
                      background: isActive ? `${t.color}12` : 'hsl(var(--card))',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: t.color }}
                      />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.color }}>
                        {t.label}
                      </span>
                      <span className="font-serif text-base font-bold">
                        {t.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="hidden text-[10px] italic text-muted-foreground sm:block">
                      {t.tagline}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Domain bars (right) */}
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Domain Distribution
            </div>
            <div className="space-y-1.5">
              {DOMAIN_BARS.map((d) => {
                const isActive = domain === d.domain;
                return (
                  <button
                    key={d.domain}
                    onClick={() => setDomain(isActive ? null : d.domain)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1 transition-colors',
                      isActive ? 'bg-accent/10' : 'hover:bg-muted/50'
                    )}
                  >
                    <span className="w-20 text-left text-[10px] font-semibold">{d.domain}</span>
                    <div className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded"
                        style={{ background: d.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(d.pct / 21) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.05 }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-[9px] text-muted-foreground">
                      {d.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected tier rule cards */}
      <AnimatePresence mode="wait">
        {tier && (
          <motion.div
            key={tier}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: TIERS.find((t) => t.key === tier).color }} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {TIERS.find((t) => t.key === tier).label} rules
              </span>
              {domain && (
                <Badge variant="accent" className="text-[9px]">
                  filtered: {domain}
                </Badge>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">
                showing {tier === 'critical' ? filteredCritical.length : 8} of {TIERS.find((t) => t.key === tier).count}
              </span>
            </div>
            {tier === 'critical' ? (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredCritical.map((r) => (
                  <CriticalRuleCard key={r.id} rule={r} />
                ))}
                {filteredCritical.length === 0 && (
                  <div className="col-span-2 rounded-lg border border-dashed bg-muted/30 p-6 text-center text-xs italic text-muted-foreground">
                    No critical rules in {domain}. Try clearing the domain filter.
                  </div>
                )}
              </div>
            ) : (
              <SampleRuleGrid tier={tier} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function CriticalRuleCard({ rule }) {
  return (
    <Card className="border-l-4 border-l-destructive">
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] font-bold text-accent">{rule.id}</div>
            <div className="font-serif text-sm font-bold">{rule.name}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="text-[9px]">
              {rule.domain}
            </Badge>
            <Badge variant="destructive" className="text-[9px]">
              CRITICAL
            </Badge>
          </div>
        </div>
        <p className="mb-3 text-xs italic leading-relaxed text-muted-foreground">
          "{rule.english}"
        </p>
        <div className="space-y-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-foreground">{rule.source}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-muted-foreground" />
            <span className="text-foreground">{rule.reg}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Code2 className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-foreground">{rule.java}</span>
          </div>
        </div>
        <div className="mt-3 flex gap-2 border-t pt-2">
          <DLTBadge label="D+" />
          <DLTBadge label="L+" />
          <DLTBadge label="T+" />
        </div>
      </CardContent>
    </Card>
  );
}

function DLTBadge({ label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[9px] font-bold text-success">
      <Check className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

const SAMPLES = {
  high: [
    { id: 'R-PMT-021', name: 'Wire Fraud Detection',     domain: 'Fraud',      eng: 'Cross-border wire > $25K with no prior history = manual review.' },
    { id: 'R-PMT-038', name: 'OFAC Sanctions Check',     domain: 'Compliance', eng: 'Every payee screened against OFAC SDN list before disbursement.' },
    { id: 'R-WC-014',  name: 'Subrogation Recovery',     domain: 'Recovery',   eng: 'Third-party liability triggers subrogation file within 90 days.' },
    { id: 'R-WC-027',  name: 'Average Weekly Wage',      domain: 'Benefits',   eng: 'AWW calculation uses 52-week lookback per state formula.' },
    { id: 'R-CLM-019', name: 'Cat Loss Threshold',       domain: 'Reserve',    eng: 'Loss > $250K triggers catastrophe reserve and senior review.' },
    { id: 'R-CLM-033', name: 'Litigation Reserve Bump',  domain: 'Legal',      eng: 'Attorney representation = +30% IBNR adjustment immediately.' },
    { id: 'R-EFT-008', name: 'NACHA Same Day Limit',     domain: 'Settlement', eng: 'Same-day ACH capped at $1M per entry. Split if larger.' },
    { id: 'R-MED-022', name: 'Provider Network Tier',    domain: 'Network',    eng: 'Out-of-network providers paid at UCR with PPO discount applied.' },
  ],
  medium: [
    { id: 'R-PMT-104', name: 'Check Stale Date',          domain: 'Operations', eng: 'Checks unclaimed > 180 days = void and reissue with confirmation.' },
    { id: 'R-PMT-122', name: 'Tax Withholding',           domain: 'Compliance', eng: 'Federal/state withholding applied per W-4 on file for claimant.' },
    { id: 'R-CLM-058', name: 'Diary Escalation',          domain: 'Operations', eng: 'No diary touch in 30 days = supervisor escalation flag.' },
    { id: 'R-CLM-077', name: 'Loss Run Generation',       domain: 'Reporting',  eng: 'Loss runs generated monthly per policy + on demand.' },
    { id: 'R-MED-051', name: 'Bill Type Mapping',         domain: 'Coding',     eng: 'CPT/HCPCS codes mapped to fee schedule by jurisdiction.' },
    { id: 'R-WC-068',  name: 'Return-to-Work Tracking',   domain: 'Benefits',   eng: 'TPD payment continues until full release or MMI declaration.' },
    { id: 'R-FNL-046', name: 'OSHA Recordable',           domain: 'Compliance', eng: 'Lost time + medical treatment beyond first aid = OSHA 300 entry.' },
    { id: 'R-EFT-029', name: 'Batch Sequencing',          domain: 'Settlement', eng: 'Batch numbers must be sequential per ODFI within trace number.' },
  ],
  low: [
    { id: 'R-FMT-002', name: 'SSN Format',           domain: 'Validation', eng: 'SSN displayed as XXX-XX-NNNN in all UI surfaces.' },
    { id: 'R-FMT-014', name: 'Currency Display',     domain: 'Validation', eng: 'All amounts shown with thousands separator and 2 decimals.' },
    { id: 'R-FMT-027', name: 'Date Format',          domain: 'Validation', eng: 'Dates displayed MM/DD/YYYY in US locale, DD/MM/YYYY elsewhere.' },
    { id: 'R-LOG-031', name: 'API Audit Logging',    domain: 'Operations', eng: 'Every API call logged with user, timestamp, and response code.' },
    { id: 'R-LOG-058', name: 'Login Audit',          domain: 'Operations', eng: 'Failed login attempts logged with IP and rate-limited.' },
    { id: 'R-RPT-019', name: 'Daily Stat Snapshot',  domain: 'Reporting',  eng: 'End-of-day batch snapshot for trending and reconciliation.' },
    { id: 'R-UI-044',  name: 'Pagination Default',   domain: 'UI',         eng: 'List views default to 25 rows per page with size selector.' },
    { id: 'R-UI-091',  name: 'Empty State Copy',     domain: 'UI',         eng: 'Empty lists show contextual hint with "Learn more" link.' },
  ],
};

function SampleRuleGrid({ tier }) {
  const samples = SAMPLES[tier] || [];
  const total = TIERS.find((t) => t.key === tier).count;
  return (
    <div>
      <div className="grid gap-2 md:grid-cols-2">
        {samples.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border bg-card p-3"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold text-accent">{r.id}</span>
              <Badge variant="outline" className="text-[9px]">{r.domain}</Badge>
            </div>
            <div className="text-xs font-semibold">{r.name}</div>
            <p className="mt-1 text-[10px] italic text-muted-foreground">"{r.eng}"</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-center text-[10px] italic text-muted-foreground">
        …and {(total - samples.length).toLocaleString()} more rules in this tier
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ACT 3 — The Navigator (Triple View)
// ════════════════════════════════════════════════════════════════════════

function ActThreeNavigator() {
  // Selection: { kind: 'file' | 'rule' | 'class', id: string }
  const [selection, setSelection] = useState(null);

  // Compute related items based on selection
  const { selectedFiles, selectedRules, selectedClasses, selectedRule } = useMemo(() => {
    if (!selection) return { selectedFiles: new Set(), selectedRules: new Set(), selectedClasses: new Set(), selectedRule: null };

    let files = new Set();
    let rules = new Set();
    let classes = new Set();
    let theRule = null;

    if (selection.kind === 'file') {
      files.add(selection.id);
      CRITICAL_RULES.filter((r) => r.file === selection.id).forEach((r) => {
        rules.add(r.id);
        classes.add(r.cls);
      });
    } else if (selection.kind === 'rule') {
      const r = CRITICAL_RULES.find((x) => x.id === selection.id);
      if (r) {
        files.add(r.file);
        rules.add(r.id);
        classes.add(r.cls);
        theRule = r;
      }
    } else if (selection.kind === 'class') {
      const r = CRITICAL_RULES.find((x) => x.cls === selection.id);
      if (r) {
        files.add(r.file);
        rules.add(r.id);
        classes.add(r.cls);
        theRule = r;
      }
    }
    return { selectedFiles: files, selectedRules: rules, selectedClasses: classes, selectedRule: theRule };
  }, [selection]);

  return (
    <section className="mb-8">
      <div className="mb-4">
        <Badge variant="accent" className="mb-2 text-[10px] uppercase tracking-widest">
          Act 3 · The Navigator
        </Badge>
        <h2 className="font-serif text-2xl font-bold tracking-tight">
          Z+Lens — Navigate everything
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click any item in any panel. Watch the other two follow. Source ↔ Rule ↔ Target,
          all bidirectional, all linked through D+L+T.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {/* Panel 1: Source */}
        <NavigatorPanel
          title="Source (D+)"
          subtitle="TAL Files"
          footerLabel="D+ Deterministic"
          footerSubtitle="AST-parsed, not inferred"
        >
          <div className="space-y-0.5 text-[11px]">
            {SOURCE_TREE.map((f) => (
              <SourceTreeItem
                key={f.file}
                file={f}
                isSelected={selectedFiles.has(f.file)}
                onClick={() => setSelection({ kind: 'file', id: f.file })}
              />
            ))}
          </div>
        </NavigatorPanel>

        {/* Panel 2: Rules */}
        <NavigatorPanel
          title="Rules (L+)"
          subtitle="Domain Clusters"
          footerLabel="L+ Lineage"
          footerSubtitle="Every rule linked to source file:line"
        >
          <div className="space-y-1 text-[11px]">
            {DOMAIN_BARS.map((d) => (
              <RuleClusterItem
                key={d.domain}
                domain={d}
                rules={CRITICAL_RULES.filter((r) => domainMatches(r.domain, d.domain))}
                selectedRules={selectedRules}
                onSelect={(rid) => setSelection({ kind: 'rule', id: rid })}
              />
            ))}
          </div>
        </NavigatorPanel>

        {/* Panel 3: Target */}
        <NavigatorPanel
          title="Target (T+)"
          subtitle="Java Classes"
          footerLabel="T+ Traceable"
          footerSubtitle="Every class has SHA audit hash"
        >
          <div className="space-y-1 text-[11px]">
            {TARGET_TREE.map((p) => (
              <PackageItem
                key={p.pkg}
                pkg={p}
                selectedClasses={selectedClasses}
                onSelect={(cls) => setSelection({ kind: 'class', id: cls })}
              />
            ))}
          </div>
        </NavigatorPanel>
      </div>

      {/* Trace Detail */}
      <AnimatePresence>
        {selectedRule && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4"
          >
            <Card className="border-l-4 border-l-accent">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-accent">
                      Trace Detail
                    </div>
                    <div className="font-mono text-xs font-bold text-accent">{selectedRule.id}</div>
                    <div className="font-serif text-base font-bold">{selectedRule.name}</div>
                  </div>
                  <button
                    onClick={() => setSelection(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    close ✕
                  </button>
                </div>
                <div className="mb-3 grid gap-2 text-xs md:grid-cols-2">
                  <DetailRow label="Source" value={`${selectedRule.source}`} mono />
                  <DetailRow label="Rule"   value={`${selectedRule.domain} | CRITICAL | ${selectedRule.reg}`} />
                  <DetailRow label="Target" value={`${selectedRule.java}`} mono />
                  <DetailRow label="Audit"  value="SHA: 2b7c8a01 | Prev: d4e9f1b3 | Chain valid ✓" mono />
                </div>
                <p className="mb-3 rounded border bg-muted p-2 text-xs italic leading-relaxed text-muted-foreground">
                  "{selectedRule.english}"
                </p>
                <div className="flex gap-2">
                  <DLTBadge label="D+ Same output every run" />
                  <DLTBadge label="L+ File:line linked" />
                  <DLTBadge label="T+ SHA-chained" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function NavigatorPanel({ title, subtitle, footerLabel, footerSubtitle, children }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex h-[480px] flex-col p-0">
        <div className="border-b bg-muted/30 px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent">
            {title}
          </div>
          <div className="mt-0.5 text-xs font-bold text-foreground">{subtitle}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
        <div className="border-t bg-muted/30 px-4 py-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-success">
            {footerLabel}
          </div>
          <div className="text-[10px] text-muted-foreground">{footerSubtitle}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceTreeItem({ file, isSelected, onClick }) {
  const [expanded, setExpanded] = useState(false);
  const hasRoutines = file.routines && file.routines.length > 0;
  const Icon = expanded && hasRoutines ? FolderOpen : Folder;
  return (
    <div
      className={cn(
        'rounded',
        isSelected && 'border-l-2 border-accent bg-accent/8 pl-1.5'
      )}
    >
      <button
        onClick={() => {
          if (hasRoutines) setExpanded((e) => !e);
          onClick();
        }}
        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/50"
      >
        {hasRoutines ? (
          expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <span className="w-3" />
        )}
        <Icon className={cn('h-3 w-3', isSelected ? 'text-accent' : 'text-muted-foreground')} />
        <span className={cn('font-mono', isSelected ? 'font-bold text-accent' : 'text-foreground')}>
          {file.file}
        </span>
        <span className="ml-auto text-[9px] text-muted-foreground">{file.lines}ln</span>
      </button>
      {expanded && hasRoutines && (
        <div className="ml-5 space-y-0.5">
          {file.routines.map((r) => (
            <div key={r} className="flex items-center gap-1 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
              <span className="text-muted-foreground/50">└</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RuleClusterItem({ domain, rules, selectedRules, onSelect }) {
  const [expanded, setExpanded] = useState(rules.length > 0);
  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/50"
      >
        {rules.length > 0 ? (
          expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <span className="w-3" />
        )}
        <span className="h-2 w-2 rounded-full" style={{ background: domain.color }} />
        <span className="font-semibold">{domain.domain}</span>
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{domain.count}</span>
      </button>
      {expanded && rules.map((r) => {
        const isSelected = selectedRules.has(r.id);
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={cn(
              'ml-5 flex w-[calc(100%-1.25rem)] items-center gap-1 rounded px-1.5 py-0.5 text-left',
              isSelected ? 'border-l-2 border-accent bg-accent/8 pl-1' : 'hover:bg-muted/50'
            )}
          >
            <span className={cn('font-mono text-[10px]', isSelected ? 'font-bold text-accent' : 'text-muted-foreground')}>
              {r.id}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PackageItem({ pkg, selectedClasses, onSelect }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/50"
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <Folder className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-[10px] text-muted-foreground">{pkg.pkg}</span>
      </button>
      {expanded && (
        <div className="ml-5 space-y-0.5">
          {pkg.classes.map((c) => {
            const isSelected = selectedClasses.has(c.name);
            return (
              <button
                key={c.name}
                onClick={() => onSelect(c.name)}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left',
                  isSelected ? 'border-l-2 border-accent bg-accent/8 pl-0.5' : 'hover:bg-muted/50'
                )}
              >
                <Code2 className={cn('h-3 w-3', isSelected ? 'text-accent' : 'text-muted-foreground')} />
                <span className={cn('font-mono', isSelected ? 'font-bold text-accent' : 'text-foreground')}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 flex-shrink-0 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-foreground', mono && 'font-mono text-[10px]')}>{value}</span>
    </div>
  );
}

// Map a rule.domain (Authorization, Fraud, etc.) to a top-level cluster (Payments, Fraud, etc.)
function domainMatches(ruleDomain, clusterDomain) {
  const map = {
    Payments: ['Authorization', 'Settlement', 'Benefits'],
    Fraud: ['Fraud'],
    Compliance: ['Compliance'],
    Operations: ['Operations'],
    Risk: ['Risk'],
    Claims: ['Claims'],
    'Workers Comp': ['Workers Comp'],
    Reserve: ['Reserve'],
    Legal: ['Legal'],
    Settlement: ['Settlement'],
    Pharmacy: ['Pharmacy'],
  };
  return (map[clusterDomain] || []).includes(ruleDomain);
}
