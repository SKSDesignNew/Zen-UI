import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

const ROUTINES = [
  { name: 'CHECK^VELOCITY', file: 'FRAUDCHK.TAL', lines: '201–267', domain: 'Fraud',
    tal: 'IF TXN^COUNT^24HR > VELOCITY^LIMIT THEN\n  CALL FLAG^SUSPICIOUS("HIGH")\n  CALL ROUTE^TO^MANUAL^REVIEW\nELSE\n  CALL CONTINUE^AUTH^FLOW',
    java: 'if (txnCount24Hr > velocityLimit) {\n  flagSuspicious(AlertLevel.HIGH);\n  return routeToManualReview(ctx);\n}\nreturn continueAuthFlow(ctx);' },
  { name: 'AUTH^CREDIT^LIMIT', file: 'CREDITAUTH.TAL', lines: '88–145', domain: 'Credit',
    tal: 'IF (BALANCE + TXN^AMT) > CREDIT^LIMIT THEN\n  IF OVERLIMIT^OK = "Y" THEN\n    CALL APPLY^OVERLIMIT^FEE\n  ELSE\n    CALL DECLINE("51")',
    java: 'BigDecimal projected = balance.add(txnAmt);\nif (projected.compareTo(creditLimit) > 0) {\n  if (acct.isOverlimitAllowed())\n    applyOverlimitFee(acct);\n  else return decline("51");\n}' },
  { name: 'COMPOSITE^RISK', file: 'FRAUDCHK.TAL', lines: '400–460', domain: 'Fraud',
    tal: 'RISK := VEL^SCORE + GEO^SCORE + MCC^SCORE\nIF RISK > BLOCK^THRESHOLD THEN\n  CALL HARD^DECLINE("59")',
    java: 'int risk = velScore + geoScore + mccScore;\nif (risk > BLOCK_THRESHOLD)\n  return hardDecline("59");' },
];

const PHASES = [
  { name: 'Parse & Extract', desc: 'TAL routine parsed into AST. Business rules identified and extracted as atomic units.', result: (r) => `${r.name} | 1 rule extracted | ${r.domain} | ${r.file}:${r.lines}` },
  { name: 'Generate Java', desc: 'ZenPlus governed AI generates Java equivalent within deterministic boundaries.', result: (r) => `${r.name.replace(/\^/g, '')}.java | Spring Boot compatible` },
  { name: 'Field Reconciliation', desc: 'Every field, condition, and branch in TAL mapped 1:1 to Java output.', result: () => `5/5 fields reconciled | 0 missing | 0 extra` },
  { name: 'Behavioral Equivalence', desc: '100 synthetic transactions executed against both. Outputs compared.', result: () => `98/100 transactions identical | 2 edge cases flagged` },
  { name: 'Regression Suite', desc: 'Full regression: approvals, declines, edge cases, boundary values.', result: () => `42 tests | 42 passed | Branches: 100% Conditions: 96%` },
  { name: 'Security Scan', desc: 'Java scanned for injection, path traversal, OWASP Top 10 compliance.', result: () => `0 critical | 0 high | 1 medium (null check) | OWASP compliant` },
  { name: 'Sandbox Deployment', desc: 'Java deployed to isolated sandbox with production-like data.', result: (r) => `sandbox-${r.name.toLowerCase().replace(/\^/g, '-')}.zenplus.internal | 2.3ms avg` },
  { name: 'Approval Gate', desc: 'All validations passed. Migration artifact ready for human review.', result: () => `MA-${Date.now().toString(36).toUpperCase().slice(-6)} | AWAITING APPROVAL` },
];

export function SandboxTab() {
  const [routineIdx, setRoutineIdx] = useState(0);
  const [phase, setPhase] = useState(-1);
  const [running, setRunning] = useState(false);
  const timer = useRef(null);
  const r = ROUTINES[routineIdx];

  const reset = () => { clearTimeout(timer.current); setPhase(-1); setRunning(false); };
  const runAll = useCallback(() => {
    reset();
    let i = 0;
    const go = () => {
      if (i >= PHASES.length) { setRunning(false); return; }
      setPhase(i); setRunning(true);
      timer.current = setTimeout(() => { i++; if (i < PHASES.length) go(); else { setPhase(PHASES.length); setRunning(false); } }, 600);
    };
    setTimeout(go, 100);
  }, []);

  const done = phase >= PHASES.length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h3 className="mb-1 font-serif text-2xl font-bold tracking-tight">Sandbox Simulation</h3>
      <p className="mb-1 text-sm text-muted-foreground">
        ZenPlus converts TAL routines to Java inside a fully governed sandbox — parsing, generating, validating, testing, and deploying without touching production.
      </p>
      <div className="mb-5 text-xs font-semibold italic text-accent">
        Zero risk to production — full behavioral equivalence verification before promotion
      </div>

      {/* Routine selector */}
      <div className="mb-5 grid gap-2 md:grid-cols-3">
        {ROUTINES.map((rt, i) => (
          <button key={i} onClick={() => { setRoutineIdx(i); reset(); }}
            className={cn('rounded-xl border-2 p-3 text-left transition-all',
              routineIdx === i ? 'border-accent bg-accent/5' : 'hover:border-accent/50')}
          >
            <div className={cn('font-mono text-xs font-bold', routineIdx === i ? 'text-accent' : '')}>
              {rt.name}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {rt.file}:{rt.lines} — {rt.domain}
            </div>
          </button>
        ))}
      </div>

      {/* Source / Target preview */}
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Source TAL — {r.file}
            </div>
            <CodeBlock code={r.tal} />
          </CardContent>
        </Card>
        <Card className={cn('transition-colors', phase >= 1 && 'border-success/40')}>
          <CardContent className="p-4">
            <div className={cn('mb-2 text-[10px] font-bold uppercase tracking-wider',
              phase >= 1 ? 'text-success' : 'text-muted-foreground')}>
              Target Java — {phase >= 1 ? 'Generated' : 'Pending'}
            </div>
            {phase >= 1 ? (
              <CodeBlock code={r.java} />
            ) : (
              <div className="py-6 text-center font-mono text-xs italic text-muted-foreground">
                Run the sandbox pipeline to generate
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="mb-5 flex items-center gap-2">
        <Button variant="accent" onClick={runAll}>
          <Play className="h-4 w-4" />
          Run Full Pipeline
        </Button>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {Math.min(Math.max(phase + 1, 0), PHASES.length)} / {PHASES.length}
        </div>
      </div>

      {/* Phases grid */}
      <div className="grid gap-2 md:grid-cols-2">
        {PHASES.map((p, i) => {
          const show = i <= phase;
          const isRunning = i === phase && running;
          const isPass = i < phase || (i === phase && !running && phase < PHASES.length);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: show ? 1 : 0.35 }}
            >
              <Card className={cn('transition-all',
                isRunning && 'border-accent shadow-md',
                isPass && i < phase && 'border-success/40'
              )}>
                <CardContent className={cn('p-4', !show && 'py-3')}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                      isPass && i < phase && 'border-success bg-success/10 text-success',
                      isRunning && 'border-accent bg-accent/10 text-accent animate-pulse-glow',
                      !show && 'border-muted-foreground/30 text-muted-foreground'
                    )}>
                      {isPass && i < phase ? <CheckCircle2 className="h-4 w-4" />
                        : isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : i + 1}
                    </div>
                    <span className="text-sm font-semibold">{p.name}</span>
                  </div>
                  {show && (
                    <div className="mt-2">
                      <p className="mb-1 text-[11px] leading-relaxed text-muted-foreground">{p.desc}</p>
                      <div className={cn(
                        'rounded bg-muted px-2 py-1 font-mono text-[10px]',
                        isPass && i < phase ? 'text-success' : 'text-foreground'
                      )}>
                        {p.result(r)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Completion */}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-5">
                <div className="mb-2 font-serif text-lg font-bold text-success">
                  ✓ Sandbox Conversion Complete
                </div>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  Routine <strong>{r.name}</strong> has been fully converted from TAL to Java inside the sandbox. All 8 validation stages passed.
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { n: '100%', l: 'Reconciliation' }, { n: '0', l: 'Hallucinations' },
                    { n: '42/42', l: 'Tests Passed' }, { n: '2.3ms', l: 'Latency' },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg bg-card p-3 text-center">
                      <div className="font-serif text-xl font-bold text-success">{s.n}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
