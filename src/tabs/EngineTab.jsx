import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, XCircle, AlertTriangle, CircleDot, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STAGE_NAMES = [
  'Code Analysis', 'Rule Extraction', 'Dependency Mapping', 'Risk Scoring',
  'Transaction Processing', 'Output Validation', 'Audit & Compliance',
];

const STATUS_ICONS = { fail: XCircle, warning: AlertTriangle, partial: CircleDot };
const STATUS_COLORS = { fail: 'text-destructive', warning: 'text-warning', partial: 'text-accent' };
const STATUS_BG = { fail: 'border-destructive/40', warning: 'border-warning/40', partial: 'border-accent/40' };
const STATUS_LABELS = { fail: 'FAILED', warning: 'GAPS', partial: 'PARTIAL' };

const METRICS = [
  { label: 'Rules Found', llm: '11 of 13 (85%)', zf: '13 of 13 (100%)' },
  { label: 'Dependency Edges', llm: '10 of 15 (67%)', zf: '15 of 15 (100%)' },
  { label: 'Repeatability', llm: 'Results vary across runs', zf: 'Identical every run' },
  { label: 'Hallucination Risk', llm: 'No detection layer', zf: 'Zero — validated gate' },
  { label: 'Audit Trail', llm: 'Chat transcript only', zf: 'Immutable SHA-linked record' },
  { label: 'Time to Production', llm: 'Manual verification', zf: 'Governed & deployment-ready' },
];

export function EngineTab() {
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [txn, setTxn] = useState({ pan: '4532015112830366', amount: '2847.50', mcc: '5411', country: 'CA', vel: '12' });
  const timer = useRef(null);
  const v = parseInt(txn.vel) || 0;
  const velOk = v <= 15;

  const llmStages = [
    { out: 'Parsed via prompt context window', issue: 'Sensitive to prompt length; may miss nested logic in large files', status: 'partial' },
    { out: '~11 rules inferred (2 missed)', issue: 'Missed R007 geo-risk and R011 FX margin', status: 'warning' },
    { out: 'Partial graph — 10 of 15 edges', issue: 'Cannot compute full call graph; infers from code proximity', status: 'warning' },
    { out: '4 HIGH | 3 MED | 2 LOW | 2 unscored', issue: 'Risk scoring inconsistent across runs', status: 'warning' },
    { out: velOk ? 'APPROVED (probable)' : 'Likely REVIEW — confidence uncertain', issue: 'Cannot verify against source — no rules repo', status: 'partial' },
    { out: 'No validation layer available', issue: 'LLM cannot self-verify; hallucinated fields pass silently', status: 'fail' },
    { out: 'Chat log only — no structured audit', issue: 'No immutable record; auditor gets a conversation transcript', status: 'fail' },
  ];

  const zfStages = [
    { out: 'AST parsed: 847 nodes, 15 edges', note: 'Deterministic parser — identical output every run' },
    { out: '13 atomic rules | 6 domains', note: 'Every rule extracted with source file, line number, routine metadata' },
    { out: '15 edges | 6 layers | 0 cycles', note: 'Complete call graph computed from actual code references' },
    { out: '6 HIGH | 5 MED | 2 LOW', note: 'Fixed classification: monetary → HIGH, mutations → MEDIUM, reads → LOW' },
    { out: velOk ? `APPROVED | ZF-${Date.now().toString(36).toUpperCase().slice(-6)}` : `REVIEW | Velocity ${v}/15 → R006`, note: 'AI generates explanation within deterministic harness' },
    { out: '13/13 fields reconciled | 0 hallucinations', note: 'Field-by-field verification against AST-extracted rules' },
    { out: `SHA: ${Array.from({ length: 8 }, () => Math.random().toString(16)[2]).join('')} | Immutable`, note: 'Complete provenance chain' },
  ];

  const reset = () => { clearTimeout(timer.current); setStep(-1); setRunning(false); };
  const runAll = useCallback(() => {
    reset();
    let i = 0;
    const go = () => {
      if (i >= STAGE_NAMES.length) { setRunning(false); return; }
      setStep(i); setRunning(true);
      timer.current = setTimeout(() => { i++; if (i < STAGE_NAMES.length) go(); else { setStep(STAGE_NAMES.length); setRunning(false); } }, 600);
    };
    setTimeout(go, 100);
  }, []);

  const done = step >= STAGE_NAMES.length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h3 className="font-serif text-2xl font-bold tracking-tight">Deterministic Engine Pipeline</h3>
      <Card className="my-4 border-accent/30 bg-accent/5">
        <CardContent className="p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">In Plain English</div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A bank has millions of lines of legacy TAL deciding whether to approve your card. Below, the <strong>same transaction</strong> runs through two approaches side by side: a leading LLM (Claude Opus 4.6) working alone, vs ZenPlus's deterministic engine. Watch how ZenPlus catches what the LLM misses, validates what it can't, and produces an audit trail.
          </p>
        </CardContent>
      </Card>

      {/* Inputs */}
      <Card className="mb-5">
        <CardContent className="p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Same Transaction Input for Both Pipelines
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { k: 'pan', l: 'PAN' }, { k: 'amount', l: 'Amount ($)' }, { k: 'mcc', l: 'MCC' },
              { k: 'country', l: 'Country' }, { k: 'vel', l: 'Vel Count' },
            ].map((f) => (
              <div key={f.k}>
                <label className="mb-1 block text-[9px] uppercase tracking-wider text-muted-foreground">{f.l}</label>
                <Input className="h-9 font-mono text-xs" value={txn[f.k]}
                  onChange={(e) => { setTxn({ ...txn, [f.k]: e.target.value }); if (step >= 0) reset(); }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="mb-5 flex items-center gap-2">
        <Button variant="accent" onClick={runAll}>
          <Play className="h-4 w-4" />
          Run Both Pipelines
        </Button>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {Math.min(Math.max(step + 1, 0), STAGE_NAMES.length)} / {STAGE_NAMES.length}
        </div>
      </div>

      {/* Side-by-side */}
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <div>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-3 text-center">
              <div className="text-sm font-bold text-destructive">LLM-Only Approach</div>
              <div className="text-[10px] text-muted-foreground">Claude Opus 4.6 with prompts — no governance</div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-3 text-center">
              <div className="text-sm font-bold text-accent">ZenPlus Pipeline</div>
              <div className="text-[10px] text-muted-foreground">Deterministic engine + governed AI layer</div>
            </CardContent>
          </Card>
        </div>
        {STAGE_NAMES.map((name, i) => {
          const show = i <= step;
          const llm = llmStages[i];
          const zf = zfStages[i];
          const StatusIcon = show ? STATUS_ICONS[llm.status] : null;
          return (
            <motion.div
              key={`pair-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: show ? 1 : 0.35 }}
              className="contents"
            >
              <Card className={cn('transition-all', show && STATUS_BG[llm.status])}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    {StatusIcon && <StatusIcon className={cn('h-4 w-4', STATUS_COLORS[llm.status])} />}
                    {!StatusIcon && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </div>
                    )}
                    <span className="text-xs font-semibold">{name}</span>
                    {show && (
                      <span className={cn('ml-auto rounded px-2 py-0.5 text-[9px] font-bold',
                        llm.status === 'fail' && 'bg-destructive/15 text-destructive',
                        llm.status === 'warning' && 'bg-warning/15 text-warning',
                        llm.status === 'partial' && 'bg-accent/15 text-accent'
                      )}>
                        {STATUS_LABELS[llm.status]}
                      </span>
                    )}
                  </div>
                  {show && (
                    <>
                      <div className="mb-1 rounded bg-muted px-2 py-1.5 font-mono text-[10px]">{llm.out}</div>
                      <div className="rounded border px-2 py-1.5 text-[10px]"
                        style={{
                          background: 'hsl(var(--destructive) / 0.05)',
                          borderColor: 'hsl(var(--destructive) / 0.2)',
                          color: 'hsl(var(--destructive))',
                        }}
                      >
                        ⚠ {llm.issue}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card className={cn('transition-all', show && 'border-success/40')}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    {show ? <CheckCircle2 className="h-4 w-4 text-success" /> : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </div>
                    )}
                    <span className="text-xs font-semibold">{name}</span>
                    {show && (
                      <span className="ml-auto rounded bg-success/15 px-2 py-0.5 text-[9px] font-bold text-success">
                        PASSED
                      </span>
                    )}
                  </div>
                  {show && (
                    <>
                      <div className="mb-1 rounded bg-muted px-2 py-1.5 font-mono text-[10px]">{zf.out}</div>
                      <div className="rounded border border-success/20 bg-success/5 px-2 py-1.5 text-[10px] text-success">
                        ✓ {zf.note}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom comparison */}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mb-3 border-accent/30">
              <CardContent className="p-5">
                <div className="mb-1 font-serif text-lg font-bold">Head-to-Head Comparison</div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Same codebase. Same transaction. Dramatically different outcomes.
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  {METRICS.map((m) => (
                    <div key={m.label} className="rounded-lg bg-muted p-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {m.label}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-destructive">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          {m.llm}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          {m.zf}
                        </div>
                      </div>
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
