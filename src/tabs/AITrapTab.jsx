import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Eye, Check, X, Sparkles, Zap, RotateCcw, Search,
  Layers, GitBranch, Bot, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

// ════════════════════════════════════════════════════════════════════════
//   DATA — 3 routines for the Hallucination Detector
// ════════════════════════════════════════════════════════════════════════

const ROUTINES = [
  {
    id: 'velocity',
    name: 'CHECK^VELOCITY',
    file: 'FRAUDCHK.TAL',
    tal: `PROC CHECK^VELOCITY^LIMITS(ACCT^NUM, TXN^AMT, TXN^COUNT^24HR,
                           VELOCITY^LIMIT, RISK^FLAG);
BEGIN
  INT ALERT^LEVEL;
  FIXED DAILY^TOTAL;
  CALL GET^24HR^ACTIVITY(ACCT^NUM, TXN^COUNT^24HR, DAILY^TOTAL);
  IF TXN^COUNT^24HR > VELOCITY^LIMIT THEN
    BEGIN
      ALERT^LEVEL := 3;
      RISK^FLAG := 1;
      CALL FLAG^SUSPICIOUS^ACTIVITY(ACCT^NUM, ALERT^LEVEL);
      CALL ROUTE^TO^MANUAL^REVIEW(ACCT^NUM, TXN^AMT, "VELOCITY^EXCEEDED");
    END
  ELSE IF TXN^COUNT^24HR > (VELOCITY^LIMIT * 80 / 100) THEN
    BEGIN
      ALERT^LEVEL := 2;
      CALL LOG^NEAR^LIMIT^WARNING(ACCT^NUM);
    END;
  IF TXN^AMT > (DAILY^TOTAL / 2) THEN
    CALL FLAG^LARGE^SINGLE^TXN(ACCT^NUM, TXN^AMT);
END;`,
    java: [
      'public class VelocityCheckService {',
      '    private static final int MAX_RETRY_COUNT = 3;',
      '',
      '    public RiskResult checkVelocityLimits(String acctNum, BigDecimal txnAmt,',
      '            int txnCount24Hr, int velocityLimit) {',
      '        DailyActivity activity = get24HrActivity(acctNum);',
      '        int alertLevel = 0;',
      '        boolean riskFlag = false;',
      '',
      '        if (txnCount24Hr > velocityLimit * 1.1) {',
      '            alertLevel = 3;',
      '            riskFlag = true;',
      '            flagSuspiciousActivity(acctNum, alertLevel);',
      '            routeToManualReview(acctNum, txnAmt, "VELOCITY_EXCEEDED");',
      '            notifyFraudTeam(acctNum);',
      '        } else if (txnCount24Hr > velocityLimit * 0.8) {',
      '            alertLevel = 2;',
      '            logNearLimitWarning(acctNum);',
      '        }',
      '',
      '        if (txnAmt.compareTo(activity.getDailyTotal().divide(BigDecimal.valueOf(2))) > 0) {',
      '            flagLargeSingleTxn(acctNum, txnAmt);',
      '        }',
      '',
      '        auditLog.record(acctNum, "VELOCITY_CHECK", alertLevel);',
      '        return new RiskResult(riskFlag, alertLevel);',
      '    }',
      '}',
    ],
    // 1-based line numbers
    hallucinations: [
      {
        line: 2,
        category: 'INVENTED VARIABLE',
        explain:
          'The TAL source has no retry concept whatsoever. The LLM invented MAX_RETRY_COUNT from common Java patterns. This variable is never used but adds confusion in the codebase.',
      },
      {
        line: 10,
        category: 'MODIFIED THRESHOLD',
        explain:
          'TAL says IF TXN^COUNT^24HR > VELOCITY^LIMIT — a direct comparison. The LLM added a 1.1 multiplier, changing the business rule. This means 10% more transactions would be approved that should have been flagged.',
      },
      {
        line: 15,
        category: 'INVENTED CALL',
        explain:
          'TAL calls FLAG^SUSPICIOUS^ACTIVITY and ROUTE^TO^MANUAL^REVIEW — but never notifyFraudTeam. The LLM assumed this was needed from common fraud patterns. This would trigger false alerts to a team that may not exist.',
      },
      {
        line: 25,
        category: 'INVENTED AUDIT',
        explain:
          'TAL performs no audit logging in this routine. The LLM added enterprise Java boilerplate. While audit logging is good practice, this output does not match the source — meaning the migration is NOT equivalent.',
      },
      {
        line: 26,
        category: 'WRONG RETURN TYPE',
        explain:
          'TAL PROC sets RISK^FLAG by reference (pass-by-reference parameter). The LLM created a return object instead. Every caller of this routine would now need to be rewritten.',
      },
    ],
  },
  {
    id: 'liens',
    name: 'CHECK^LIENS',
    file: 'PMTAPPR.TAL',
    tal: `PROC CHECK^LIENS(CLAIM^NUM, GROSS^AMT, PMT^TYPE, DEDUCTION, HAS^LIEN);
  STRING .CLAIM^NUM[0:11];
  DOLLARS GROSS^AMT;
  INT     PMT^TYPE;
  DOLLARS .DEDUCTION;
  INT     .HAS^LIEN;
BEGIN
  INT     BYTES^READ;
  DOLLARS TOTAL^DEDUCT;
  TOTAL^DEDUCT := 0.00F;
  HAS^LIEN := 0;
  WHILE NOT <> AND W^LIEN.CLAIM^NUMBER = CLAIM^NUM DO
  BEGIN
    IF W^LIEN.LIEN^STATUS = 0 AND W^LIEN.REMAINING^BALANCE > 0.00F THEN
    BEGIN
      HAS^LIEN := 1;
      IF W^LIEN.LIEN^TYPE = LIEN^CHILD^SUPPORT AND PMT^TYPE = PMT^TYPE^INDEMNITY THEN
        TOTAL^DEDUCT := TOTAL^DEDUCT + (GROSS^AMT * W^LIEN.DEDUCTION^PCT);
      IF W^LIEN.LIEN^TYPE = LIEN^IRS THEN
        TOTAL^DEDUCT := TOTAL^DEDUCT + (GROSS^AMT * W^LIEN.DEDUCTION^PCT);
      IF W^LIEN.LIEN^TYPE = LIEN^ATTY AND PMT^TYPE = PMT^TYPE^SETTLEMENT THEN
        TOTAL^DEDUCT := TOTAL^DEDUCT + (GROSS^AMT * W^LIEN.DEDUCTION^PCT);
      IF W^LIEN.LIEN^TYPE = LIEN^MEDICARE THEN
        IF TOTAL^DEDUCT + W^LIEN.REMAINING^BALANCE > GROSS^AMT THEN
          TOTAL^DEDUCT := GROSS^AMT
        ELSE
          TOTAL^DEDUCT := TOTAL^DEDUCT + W^LIEN.REMAINING^BALANCE;
    END;
  END;
  IF TOTAL^DEDUCT > GROSS^AMT THEN TOTAL^DEDUCT := GROSS^AMT;
  DEDUCTION := TOTAL^DEDUCT;
END;`,
    java: [
      'public class LienCheckService {',
      '    @Autowired',
      '    private LienRepository lienRepo;',
      '',
      '    public LienResult checkLiens(String claimNum, BigDecimal grossAmt, int pmtType) {',
      '        BigDecimal totalDeduct = BigDecimal.ZERO;',
      '        boolean hasLien = false;',
      '',
      '        List<Lien> liens = lienRepo.findByClaimAndStatus(claimNum, 0);',
      '',
      '        for (Lien lien : liens) {',
      '            if (lien.getRemainingBalance().compareTo(BigDecimal.ZERO) > 0) {',
      '                hasLien = true;',
      '                switch (lien.getLienType()) {',
      '                    case CHILD_SUPPORT:',
      '                        if (pmtType == PMT_TYPE_INDEMNITY)',
      '                            totalDeduct = totalDeduct.add(grossAmt.multiply(lien.getDeductionPct()));',
      '                        break;',
      '                    case IRS:',
      '                        totalDeduct = totalDeduct.add(grossAmt.multiply(lien.getDeductionPct()));',
      '                        break;',
      '                    case ATTORNEY:',
      '                        if (pmtType == PMT_TYPE_SETTLEMENT || pmtType == PMT_TYPE_LEGAL)',
      '                            totalDeduct = totalDeduct.add(grossAmt.multiply(lien.getDeductionPct()));',
      '                        break;',
      '                    case MEDICARE:',
      '                        totalDeduct = totalDeduct.add(lien.getRemainingBalance());',
      '                        break;',
      '                }',
      '            }',
      '        }',
      '        totalDeduct = totalDeduct.min(grossAmt);',
      '        return new LienResult(hasLien, totalDeduct, grossAmt.subtract(totalDeduct));',
      '    }',
      '}',
    ],
    hallucinations: [
      {
        line: 3,
        category: 'INVENTED FRAMEWORK',
        explain:
          'TAL uses sequential Enscribe file I/O (FILE_READ64_ with KEYPOSITION). The LLM assumed Spring Data JPA with a repository pattern. This changes the entire data access layer and adds a dependency that does not exist.',
      },
      {
        line: 14,
        category: 'CHANGED CONTROL FLOW',
        explain:
          'TAL uses 4 separate IF statements — each executes independently. switch/case in Java has fall-through semantics and is mutually exclusive with breaks. If a lien has multiple types (edge case), the behavior would differ.',
      },
      {
        line: 23,
        category: 'ADDED CONDITION',
        explain:
          'TAL ONLY checks PMT^TYPE^SETTLEMENT for attorney liens. The LLM added PMT_TYPE_LEGAL — a condition that does not exist in the source. This would deduct attorney liens from legal payments when the original system would not.',
      },
      {
        line: 27,
        category: 'REMOVED SAFETY CAP',
        explain:
          'TAL has critical conditional logic: IF TOTAL^DEDUCT + REMAINING > GROSS^AMT THEN cap at GROSS^AMT. The LLM simplified this to a direct add, removing the cap. Deductions could now exceed the payment amount — a financial error.',
      },
      {
        line: 33,
        category: 'WRONG CALLING CONVENTION',
        explain:
          'TAL PROC sets DEDUCTION and HAS^LIEN by reference (output parameters). The LLM created a return object. Every caller expects to pass variables by reference and read them back — this breaks all call sites.',
      },
    ],
  },
  {
    id: 'routing',
    name: 'VALIDATE^ROUTING^NUMBER',
    file: 'PMTEFT.TAL',
    tal: `INT PROC VALIDATE^ROUTING^NUMBER(RTN);
  STRING .RTN[0:8];
BEGIN
  INT D1, D2, D3, D4, D5, D6, D7, D8, D9;
  INT CHECKSUM;
  D1 := RTN[0] - "0";  D2 := RTN[1] - "0";  D3 := RTN[2] - "0";
  D4 := RTN[3] - "0";  D5 := RTN[4] - "0";  D6 := RTN[5] - "0";
  D7 := RTN[6] - "0";  D8 := RTN[7] - "0";  D9 := RTN[8] - "0";
  CHECKSUM := 3 * (D1 + D4 + D7) + 7 * (D2 + D5 + D8) + (D3 + D6 + D9);
  IF CHECKSUM - ((CHECKSUM / 10) * 10) = 0 THEN
    RETURN 1;
  RETURN 0;
END;`,
    java: [
      'public class RoutingValidator {',
      '    private static final Pattern ABA_PATTERN = Pattern.compile("^\\\\d{9}$");',
      '',
      '    public boolean validateRoutingNumber(String routingNumber) {',
      '        if (routingNumber == null || !ABA_PATTERN.matcher(routingNumber).matches()) {',
      '            return false;',
      '        }',
      '',
      '        int[] digits = routingNumber.chars().map(c -> c - \'0\').toArray();',
      '        int checksum = 3 * (digits[0] + digits[3] + digits[6])',
      '                     + 7 * (digits[1] + digits[4] + digits[7])',
      '                     + 1 * (digits[2] + digits[5] + digits[8]);',
      '',
      '        if (checksum % 10 == 0) {',
      '            logValidation(routingNumber, true);',
      '            return true;',
      '        }',
      '        logValidation(routingNumber, false);',
      '        throw new InvalidRoutingException(routingNumber);',
      '    }',
      '}',
    ],
    hallucinations: [
      {
        line: 2,
        category: 'INVENTED VALIDATION',
        explain:
          'TAL performs only a checksum calculation — no format validation. The LLM added regex validation which would reject routing numbers with leading spaces or formatting that the original system accepted.',
      },
      {
        line: 5,
        category: 'ADDED NULL CHECK',
        explain:
          'TAL has no null handling — it expects a valid 9-byte string. Adding a null check seems "safe" but changes behavior: the original system would crash on null (caught by the caller), the new system silently returns false.',
      },
      {
        line: 12,
        category: 'OBSCURED FORMULA',
        explain:
          'While mathematically equivalent, writing "1 *" instead of just the sum obscures the ABA algorithm and suggests the weight might be configurable. In the TAL source, the third group has no multiplier — this is a subtle readability hallucination.',
      },
      {
        line: 15,
        category: 'INVENTED LOGGING',
        explain:
          'TAL performs no logging. The LLM added logValidation calls that do not exist. In a high-throughput payment system, this adds I/O overhead on every routing validation — potentially millions per day.',
      },
      {
        line: 19,
        category: 'CHANGED ERROR HANDLING',
        explain:
          'TAL returns 0 (integer) for invalid routing numbers. The LLM throws an exception instead. This fundamentally changes error handling: every caller must now catch InvalidRoutingException instead of checking a return value.',
      },
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════
//   DATA — 3 rules for the Blast Radius
// ════════════════════════════════════════════════════════════════════════

const BLAST_RULES = [
  {
    id: 'R006',
    name: 'Velocity Limit',
    file: 'FRAUDCHK.TAL:201',
    param: { name: 'VELOCITY^LIMIT', current: 15, min: 5, max: 30, unit: 'txns/24hr' },
    downstream: [
      { id: 'R009', name: 'Composite Risk',    file: 'FRAUDCHK.TAL:400',  severity: 'CRITICAL', impact: 'Composite score weights velocity at 35% — threshold change shifts all risk bands.' },
      { id: 'R007', name: 'Geo-Risk Score',    file: 'FRAUDCHK.TAL:310',  severity: 'HIGH',     impact: 'Geo-risk threshold recalibration needed — velocity feeds composite score.' },
      { id: 'R008', name: 'Credit Limit Auth', file: 'CREDITAUTH.TAL:88', severity: 'HIGH',     impact: 'Velocity flag changes credit hold behavior — approved transactions may now bypass hold.' },
      { id: 'R012', name: 'AML/CTR Screening', file: 'AML-Policy:§3.1',   severity: 'HIGH',     impact: 'Velocity-flagged transactions get enhanced AML — threshold change alters screening volume by ~18%.' },
      { id: 'R013', name: 'Auth Response',     file: 'AUTHRESP.TAL:10',   severity: 'MEDIUM',   impact: 'Response code logic depends on velocity flag state — soft decline triggers change.' },
      { id: 'R010', name: 'Interchange Fee',   file: 'FEECALC.TAL:55',    severity: 'MEDIUM',   impact: 'High-risk transactions incur elevated interchange — fewer flags means lower fee revenue.' },
      { id: 'R-RPT', name: 'Fraud Summary',    file: 'RPTGEN.TAL:200',    severity: 'LOW',      impact: 'Daily fraud report counts velocity flags — threshold change skews trending data.' },
      { id: 'R011', name: 'FX Margin',         file: 'FEECALC.TAL:95',    severity: 'LOW',      impact: 'Cross-border velocity flagging affects FX margin application for flagged transactions.' },
    ],
  },
  {
    id: 'R012',
    name: 'AML/CTR Threshold',
    file: 'AML-Policy:§3.1',
    param: { name: 'CTR^THRESHOLD', current: 10000, min: 5000, max: 50000, unit: 'USD' },
    downstream: [
      { id: 'R-SAR',  name: 'SAR Filing',     file: 'AML-Policy:§3.4',  severity: 'CRITICAL', impact: 'CTR threshold directly triggers SAR review queue — lowering increases SAR volume by 300%.' },
      { id: 'R013',   name: 'Auth Response',  file: 'AUTHRESP.TAL:10',  severity: 'HIGH',     impact: 'AML hold affects response code — more holds mean more declined transactions.' },
      { id: 'R-RPT2', name: 'FinCEN Report',  file: 'REGFILE.TAL:50',   severity: 'HIGH',     impact: 'CTR filing volume directly changes — regulatory reporting workload scales linearly.' },
      { id: 'R-OPS',  name: 'Alert Queue',    file: 'ALERTQ.TAL:30',    severity: 'MEDIUM',   impact: 'Compliance analyst queue depth changes — may require staffing adjustment.' },
    ],
  },
  {
    id: 'R-PMT-005',
    name: 'Lien Deduction %',
    file: 'PMTAPPR.TAL',
    param: { name: 'DEDUCTION^PCT', current: 25, min: 10, max: 50, unit: '% of gross' },
    downstream: [
      { id: 'R-PMT-006', name: '1099 Tracking', file: 'PMTAPPR.TAL:UPDATE^1099',     severity: 'HIGH',   impact: 'Net payment amount changes — 1099 accumulation must use post-deduction amount.' },
      { id: 'R-PMT-009', name: 'Dual Approval', file: 'PMTEFT.TAL:RELEASE^BATCH',    severity: 'MEDIUM', impact: 'Batch totals change with different deduction rates — approval thresholds may need recalibration.' },
      { id: 'R-PMT-007', name: 'ABA Routing',   file: 'PMTEFT.TAL:VALIDATE^ROUTING', severity: 'LOW',    impact: 'Net payment amount drives EFT batch sizing — routing validation volume unchanged but batch totals shift.' },
    ],
  },
];

const SEVERITY_COLORS = {
  CRITICAL: '#8b1a1a',
  HIGH:     '#c45c3e',
  MEDIUM:   '#d97706',
  LOW:      '#94a3b8',
};

// ════════════════════════════════════════════════════════════════════════
//   SECTION 1 — The Hallucination Detector
// ════════════════════════════════════════════════════════════════════════

function HallucinationDetector() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [clickedLines, setClickedLines] = useState(new Set());
  const [revealed, setRevealed] = useState(false);
  const revealRef = useRef(null);

  const routine = ROUTINES[selectedIdx];
  const hallucinationLineSet = useMemo(
    () => new Set(routine.hallucinations.map((h) => h.line)),
    [routine]
  );

  const switchRoutine = (idx) => {
    setSelectedIdx(idx);
    setClickedLines(new Set());
    setRevealed(false);
  };

  const toggleLine = (lineNumber) => {
    if (revealed) return;
    setClickedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineNumber)) next.delete(lineNumber);
      else next.add(lineNumber);
      return next;
    });
  };

  const reveal = () => {
    setRevealed(true);
    setTimeout(() => {
      revealRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
  };

  const tryAnother = () => {
    const next = (selectedIdx + 1) % ROUTINES.length;
    switchRoutine(next);
  };

  const correctHits = useMemo(
    () => [...clickedLines].filter((l) => hallucinationLineSet.has(l)),
    [clickedLines, hallucinationLineSet]
  );
  const score = correctHits.length;
  const total = routine.hallucinations.length;
  const correctSet = new Set(correctHits);

  return (
    <section>
      {/* Heading */}
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/15">
            <Eye className="h-4 w-4 text-destructive" />
          </div>
          <Badge variant="destructive" className="text-[10px] uppercase tracking-widest">
            Section 1
          </Badge>
        </div>
        <h2 className="font-serif text-3xl font-bold tracking-tight">
          The Hallucination Detector
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The Java code below was generated from TAL by a leading LLM. It looks
          clean, professional, and idiomatic. <strong>It also contains 5 hallucinations.</strong>
          {' '}Click the lines you think are wrong, then reveal.
        </p>
      </div>

      {/* Routine picker */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ROUTINES.map((r, i) => {
          const active = i === selectedIdx;
          return (
            <button
              key={r.id}
              onClick={() => switchRoutine(i)}
              className={cn(
                'rounded-lg border px-4 py-2 text-left transition-all',
                active
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-border bg-card hover:border-accent/50'
              )}
            >
              <div className={cn('font-mono text-xs font-bold', active ? 'text-accent' : 'text-foreground')}>
                {r.name}
              </div>
              <div className="text-[10px] text-muted-foreground">{r.file}</div>
            </button>
          );
        })}
      </div>

      {/* Source TAL + LLM Java side by side */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        {/* TAL source — read-only */}
        <Card>
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Source TAL · {routine.file}
              </div>
              <Badge variant="outline" className="text-[9px]">
                read-only
              </Badge>
            </div>
            <pre className="max-h-[520px] overflow-auto rounded-md bg-primary p-3 text-[11px] leading-relaxed text-primary-foreground/85">
              <code className="font-mono">{routine.tal}</code>
            </pre>
          </CardContent>
        </Card>

        {/* LLM-generated Java — clickable lines */}
        <Card>
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                LLM-Generated Java
              </div>
              <Badge variant="warning" className="text-[9px] bg-accent/15 text-accent">
                {revealed ? 'revealed' : 'click suspicious lines'}
              </Badge>
            </div>
            <div className="max-h-[520px] overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
              {routine.java.map((text, idx) => {
                const lineNum = idx + 1;
                const clicked = clickedLines.has(lineNum);
                const isHallucination = hallucinationLineSet.has(lineNum);
                const correct = revealed && clicked && isHallucination;
                const missed = revealed && !clicked && isHallucination;
                const wrong = revealed && clicked && !isHallucination;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleLine(lineNum)}
                    disabled={revealed}
                    className={cn(
                      'flex w-full items-start gap-2 rounded px-2 py-0.5 text-left transition-all',
                      !revealed && clicked && 'border-l-[3px] border-amber-400 bg-amber-100/40 dark:bg-amber-500/10',
                      !revealed && !clicked && 'hover:bg-muted/60',
                      correct && 'border-l-[3px] border-emerald-500 bg-emerald-100/40 dark:bg-emerald-500/10',
                      missed && 'animate-pulse border-l-[3px] border-destructive bg-destructive/10',
                      wrong && 'border-l-[3px] border-muted-foreground/50 bg-muted/40 opacity-60',
                    )}
                  >
                    <span className="w-7 select-none text-right text-muted-foreground">{lineNum}</span>
                    <span className="flex-1 whitespace-pre text-foreground">{text || ' '}</span>
                    {revealed && correct && <Check className="h-3 w-3 flex-shrink-0 text-emerald-500" />}
                    {revealed && missed && <X className="h-3 w-3 flex-shrink-0 text-destructive" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="text-xs text-muted-foreground">
          Your picks: <span className="font-mono font-bold text-foreground">{clickedLines.size}/{total}</span>
        </div>
        {!revealed ? (
          <Button onClick={reveal} variant="accent">
            <Sparkles className="h-3.5 w-3.5" />
            Reveal All Hallucinations
          </Button>
        ) : (
          <Button onClick={tryAnother} variant="outline">
            <RotateCcw className="h-3.5 w-3.5" />
            Try Another Routine
          </Button>
        )}
        {revealed && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Score:</span>
            <span
              className={cn(
                'rounded px-2 py-1 font-mono text-sm font-bold',
                score === total ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
              )}
            >
              {score}/{total}
            </span>
          </div>
        )}
      </div>

      {/* Reveal panel */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            ref={revealRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h3 className="font-serif text-lg font-bold">
                    The 5 Hallucinations in {routine.name}
                  </h3>
                </div>
                <div className="space-y-3">
                  {routine.hallucinations.map((h) => {
                    const wasFound = correctSet.has(h.line);
                    return (
                      <motion.div
                        key={h.line}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + h.line * 0.01 }}
                        className="rounded-lg border border-destructive/20 bg-card p-3"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <X className="h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                          <span className="font-mono font-bold text-muted-foreground">Line {h.line}</span>
                          <Badge variant="destructive" className="text-[9px]">
                            {h.category}
                          </Badge>
                          {wasFound && (
                            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                              <Check className="h-3 w-3" />
                              you caught it
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{h.explain}</p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Score commentary */}
                <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs">
                  {score === total ? (
                    <p className="leading-relaxed">
                      <strong className="text-accent">Perfect score.</strong> But in production
                      you don't have the source TAL to compare against — and you don't have time
                      to read every line of every generated file. ZenPlus catches all 5
                      automatically through field-level reconciliation.
                    </p>
                  ) : (
                    <p className="leading-relaxed">
                      You found <strong>{score}/{total}</strong>. A senior reviewer who knows
                      both TAL and Java catches an average of <strong>3/5</strong> on the first
                      pass. ZenPlus catches <strong>{total}/{total}</strong> automatically through
                      field-level reconciliation — every variable, every condition, every call
                      mapped 1:1.
                    </p>
                  )}
                </div>

                {/* Hard stat */}
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary p-3 text-[11px] leading-relaxed text-primary-foreground/90">
                  <Layers className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" />
                  <span>
                    <strong className="text-accent">GPT-4 scores 10% on COBOLEval.</strong>{' '}
                    TAL has zero training data. These aren't edge cases — they're the norm for
                    legacy mainframe languages that weren't represented in the training corpus.
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════
//   SECTION 2 — The Blast Radius
// ════════════════════════════════════════════════════════════════════════

function BlastRadius() {
  const [ruleIdx, setRuleIdx] = useState(0);
  const [paramValue, setParamValue] = useState(BLAST_RULES[0].param.current);
  const [showGraph, setShowGraph] = useState(false);

  const rule = BLAST_RULES[ruleIdx];

  // Reset paramValue when rule changes
  useEffect(() => {
    setParamValue(rule.param.current);
    setShowGraph(false);
  }, [ruleIdx, rule]);

  const switchRule = (idx) => setRuleIdx(idx);

  const formatValue = (v) => {
    if (rule.param.unit === 'USD') return `$${Number(v).toLocaleString()}`;
    return `${v} ${rule.param.unit}`;
  };

  const severityCount = useMemo(() => {
    const c = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    rule.downstream.forEach((d) => c[d.severity]++);
    return c;
  }, [rule]);

  const filesAffected = useMemo(
    () => new Set(rule.downstream.map((d) => d.file.split(':')[0])).size,
    [rule]
  );

  // Bottom banner narrative — depends on the selected rule
  const bannerNarrative = useMemo(() => {
    const high = severityCount.CRITICAL + severityCount.HIGH;
    return (
      <>
        The LLM changed <strong>1 file</strong>. But{' '}
        <strong>{rule.downstream.length} rules across {filesAffected} files</strong> are now
        inconsistent — including <strong>{high} HIGH/CRITICAL impacts</strong>. ZenPlus catches
        every dependency BEFORE the change is made.
      </>
    );
  }, [rule, severityCount, filesAffected]);

  return (
    <section className="mt-12">
      {/* Heading */}
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15">
            <Zap className="h-4 w-4 text-accent" />
          </div>
          <Badge variant="accent" className="text-[10px] uppercase tracking-widest">
            Section 2
          </Badge>
        </div>
        <h2 className="font-serif text-3xl font-bold tracking-tight">The Blast Radius</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Change one rule. See what breaks. The LLM has no idea what's downstream.
          ZenPlus shows every affected rule before you commit.
        </p>
      </div>

      {/* Rule selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {BLAST_RULES.map((r, i) => {
          const active = i === ruleIdx;
          return (
            <button
              key={r.id}
              onClick={() => switchRule(i)}
              className={cn(
                'rounded-lg border px-4 py-2 text-left transition-all',
                active
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-border bg-card hover:border-accent/50'
              )}
            >
              <div className={cn('font-mono text-xs font-bold', active ? 'text-accent' : 'text-foreground')}>
                {r.id}
              </div>
              <div className="text-[10px] text-muted-foreground">{r.name}</div>
            </button>
          );
        })}
      </div>

      {/* The change card */}
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-3">
            <Badge variant="accent" className="font-mono text-[10px]">
              {rule.id}
            </Badge>
            <span className="text-sm font-semibold">{rule.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{rule.file}</span>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <div className="font-mono text-muted-foreground">{rule.param.name}</div>
            <div>
              <span className="font-mono text-muted-foreground">{formatValue(rule.param.current)}</span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span className="font-mono font-bold text-accent">{formatValue(paramValue)}</span>
            </div>
          </div>
          <Slider
            value={[paramValue]}
            onValueChange={(v) => setParamValue(v[0])}
            min={rule.param.min}
            max={rule.param.max}
            step={rule.param.unit === 'USD' ? 500 : 1}
            className="my-3"
          />
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{formatValue(rule.param.min)}</span>
            <span>{formatValue(rule.param.max)}</span>
          </div>
        </CardContent>
      </Card>

      {/* LLM vs ZenPlus side-by-side */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        {/* LLM side */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-4 w-4 text-destructive" />
              <div className="text-xs font-bold uppercase tracking-widest text-destructive">
                LLM Response
              </div>
            </div>
            <div className="rounded-md border border-destructive/20 bg-card p-4">
              <p className="text-sm leading-relaxed">
                "Done. I've updated the {rule.param.name} to{' '}
                <span className="font-mono font-bold">{paramValue}</span> in{' '}
                <span className="font-mono">
                  {rule.id}{rule.id.startsWith('R') ? 'Service' : ''}.java
                </span>
                ."
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="h-3 w-3 text-emerald-500" />
                <span>1 file changed</span>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <X className="h-3 w-3 text-destructive" />
                No impact analysis
              </div>
              <div className="flex items-center gap-2">
                <X className="h-3 w-3 text-destructive" />
                No dependency check
              </div>
              <div className="flex items-center gap-2">
                <X className="h-3 w-3 text-destructive" />
                No downstream review
              </div>
            </div>
            <p className="mt-4 text-[11px] italic text-muted-foreground">
              The LLM doesn't know what it doesn't know.
            </p>
          </CardContent>
        </Card>

        {/* ZenPlus side */}
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <div className="text-xs font-bold uppercase tracking-widest text-accent">
                ZenPlus Response
              </div>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-md border border-accent/30 bg-card p-3 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-accent" />
              <span>
                <strong>{rule.downstream.length} downstream rules</strong> affected across{' '}
                <strong>{filesAffected} TAL files</strong>:
              </span>
            </div>
            <div className="space-y-1.5">
              {rule.downstream.map((d, i) => (
                <motion.div
                  key={d.id + ruleIdx + paramValue}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-md border border-border bg-card px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        background: SEVERITY_COLORS[d.severity] + '22',
                        color: SEVERITY_COLORS[d.severity],
                      }}
                    >
                      {d.severity}
                    </span>
                    <span className="font-mono font-bold text-accent">{d.id}</span>
                    <span className="font-semibold">{d.name}</span>
                    <span className="ml-auto font-mono text-[9px] text-muted-foreground">{d.file}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{d.impact}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px]">
                {Object.entries(severityCount).map(([sev, n]) =>
                  n > 0 ? (
                    <span
                      key={sev}
                      className="rounded px-1.5 py-0.5 font-bold"
                      style={{
                        background: SEVERITY_COLORS[sev] + '22',
                        color: SEVERITY_COLORS[sev],
                      }}
                    >
                      {n} {sev}
                    </span>
                  ) : null
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowGraph((s) => !s)}
              >
                <GitBranch className="h-3 w-3" />
                {showGraph ? 'Hide' : 'Show'} Dependency Graph
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inline dependency graph (SVG) */}
      <AnimatePresence>
        {showGraph && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="mb-4 overflow-hidden">
              <CardContent className="p-5">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Dependency Cascade — every affected rule, computed BEFORE the change
                </div>
                <DependencyGraph rule={rule} />
                <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                  {Object.entries(SEVERITY_COLORS).map(([sev, c]) => (
                    <div key={sev} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                      {sev}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom banner */}
      <div className="rounded-2xl border border-accent/30 bg-primary p-5 text-primary-foreground">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
          <Search className="h-3 w-3" />
          The cost of "1 file changed"
        </div>
        <p className="text-sm leading-relaxed">{bannerNarrative}</p>
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════
//   Dependency Graph — inline SVG
// ════════════════════════════════════════════════════════════════════════

function DependencyGraph({ rule }) {
  const W = 800;
  const ROW_H = 56;
  const TOP = 20;
  const H = TOP * 2 + Math.max(rule.downstream.length, 1) * ROW_H;
  const SOURCE_X = 130;
  const TARGET_X = 600;
  const SOURCE_Y = H / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ maxHeight: 420 }}>
      <defs>
        <marker
          id="blast-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--muted-foreground))" />
        </marker>
      </defs>

      {/* Edges with animated dash flow */}
      {rule.downstream.map((d, i) => {
        const ty = TOP + i * ROW_H + ROW_H / 2;
        const path = `M ${SOURCE_X + 60} ${SOURCE_Y} C ${(SOURCE_X + TARGET_X) / 2} ${SOURCE_Y}, ${(SOURCE_X + TARGET_X) / 2} ${ty}, ${TARGET_X - 5} ${ty}`;
        return (
          <g key={d.id}>
            <path
              d={path}
              fill="none"
              stroke={SEVERITY_COLORS[d.severity]}
              strokeWidth={1.6}
              strokeDasharray="6 4"
              opacity={0.7}
              markerEnd="url(#blast-arrow)"
              style={{
                animation: `dashFlow 1.2s linear ${i * 0.1}s infinite`,
              }}
            />
          </g>
        );
      })}

      {/* Source rule (left, the one being changed) */}
      <g>
        <rect
          x={SOURCE_X - 60}
          y={SOURCE_Y - 26}
          width={120}
          height={52}
          rx={10}
          fill="hsl(var(--card))"
          stroke="hsl(var(--accent))"
          strokeWidth={2.5}
          style={{ animation: 'pulseAccent 2s ease-in-out infinite' }}
        />
        <text
          x={SOURCE_X}
          y={SOURCE_Y - 7}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize={11}
          fontWeight={800}
          fill="hsl(var(--accent))"
        >
          {rule.id}
        </text>
        <text
          x={SOURCE_X}
          y={SOURCE_Y + 9}
          textAnchor="middle"
          fontFamily="DM Sans, sans-serif"
          fontSize={9}
          fill="hsl(var(--foreground))"
        >
          {rule.name}
        </text>
        <text
          x={SOURCE_X}
          y={SOURCE_Y + 21}
          textAnchor="middle"
          fontFamily="DM Sans, sans-serif"
          fontSize={8}
          fill="hsl(var(--muted-foreground))"
        >
          changed
        </text>
      </g>

      {/* Downstream rules */}
      {rule.downstream.map((d, i) => {
        const ty = TOP + i * ROW_H + ROW_H / 2;
        const color = SEVERITY_COLORS[d.severity];
        return (
          <g key={d.id}>
            <rect
              x={TARGET_X}
              y={ty - 22}
              width={180}
              height={44}
              rx={9}
              fill="hsl(var(--card))"
              stroke={color}
              strokeWidth={1.8}
            />
            <circle cx={TARGET_X + 12} cy={ty} r={5} fill={color} />
            <text
              x={TARGET_X + 24}
              y={ty - 4}
              fontFamily="JetBrains Mono, monospace"
              fontSize={10}
              fontWeight={800}
              fill="hsl(var(--foreground))"
            >
              {d.id}
            </text>
            <text
              x={TARGET_X + 24}
              y={ty + 9}
              fontFamily="DM Sans, sans-serif"
              fontSize={9}
              fill="hsl(var(--muted-foreground))"
            >
              {d.name}
            </text>
            <text
              x={TARGET_X + 168}
              y={ty + 4}
              textAnchor="end"
              fontFamily="DM Sans, sans-serif"
              fontSize={8}
              fontWeight={700}
              fill={color}
            >
              {d.severity}
            </text>
          </g>
        );
      })}

      <style>{`
        @keyframes dashFlow {
          to { stroke-dashoffset: -20; }
        }
        @keyframes pulseAccent {
          0%, 100% { stroke-width: 2.5; }
          50% { stroke-width: 4; }
        }
      `}</style>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════
//   The AI Trap — top-level tab
// ════════════════════════════════════════════════════════════════════════

export function AITrapTab() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Tab heading */}
      <div className="mb-8">
        <Badge variant="destructive" className="mb-3 text-[10px] uppercase tracking-widest">
          The AI Trap
        </Badge>
        <h1 className="font-serif text-4xl font-bold tracking-tight">
          Why LLM-only modernization fails
        </h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Two interactive demos. The first shows you what an LLM hallucinates when it
          generates code from a language it has no training data for. The second shows
          you the cascading damage when that same LLM changes one parameter without
          understanding the call graph.
        </p>
      </div>

      <HallucinationDetector />

      {/* Section divider */}
      <div className="my-12 border-t" />

      <BlastRadius />
    </div>
  );
}
