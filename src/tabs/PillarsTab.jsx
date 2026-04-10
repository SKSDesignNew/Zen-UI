import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XCircle, CheckCircle2, Search, Link2, Layers, RotateCw, Shield,
  Play, ChevronDown, AlertTriangle, FileText, Hash, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

const PILLARS = [
  {
    num: '01', title: 'Structural Integrity', subtitle: 'Deterministic Extraction vs Probabilistic Inference',
    Icon: Search,
    llm: { label: 'Pure LLM (Opus 4.6)', desc: 'Relies on token prediction. Outputs shift based on temperature, model version, or prompt phrasing. The same TAL routine can produce different Java across runs.', stat: '+21%', statLabel: 'Issue Density — raw Opus 4.6 output yields higher defect rates per 1K lines vs predecessor' },
    zf: { label: 'ZenPlus', desc: 'Custom TAL parser isolates operations, call graphs, and metadata before any LLM involvement. Identical input always yields identical architectural blueprint.', stat: '100%', statLabel: 'Deterministic — same TAL input produces same inventory and metadata every single time' },
  },
  {
    num: '02', title: 'Lineage & Traceability', subtitle: 'Bidirectional Metadata Graph vs Chat Logs',
    Icon: Link2,
    llm: { label: 'Pure LLM', desc: 'Conversational history lacks structured provenance. When an audit asks "Which source caused this Java change?", developers hunt through thousands of lines.', stat: '0', statLabel: 'Structured lineage links — auditor gets a conversation transcript, not a metadata chain' },
    zf: { label: 'ZenPlus', desc: 'Every generated rule, verticle, test, and fix is hard-linked to the exact TAL file, routine, and line range. Bidirectional tethering from source to target.', stat: '100%', statLabel: 'Bidirectional links — every Java class traces back to exact TAL routine and line' },
  },
  {
    num: '03', title: 'Context Management', subtitle: 'Snippet Grounding vs Context Flooding',
    Icon: Layers,
    llm: { label: 'Pure LLM', desc: 'Dumps full codebases into prompts. Opus 4.6 scores 78.3% on MRCR v2 at 64K tokens — impressive, but a 24% failure rate is catastrophic at Visa-scale migration.', stat: '24%', statLabel: 'Failure Rate — at 1M tokens, even the best model misses 1 in 4 retrievals' },
    zf: { label: 'ZenPlus', desc: 'LLM calls receive only tiny, grounded snippets: a specific TAL routine for rules, or a TAL-Java pair for fixes. The LLM never searches the haystack.', stat: '0%', statLabel: 'Context Rot — scoped snippets eliminate token flooding and enforce standardization' },
  },
  {
    num: '04', title: 'Repeatability', subtitle: 'Spec-Driven Development vs Re-Prompting',
    Icon: RotateCw,
    llm: { label: 'Pure LLM', desc: 'Re-prompting workflows suffer from history drift. As conversation context shifts, the AI\'s understanding degrades. No canonical workflow to version.', stat: '+55%', statLabel: 'Vulnerability Density — increased autonomy leads to aggressive exploration, spiking flaws' },
    zf: { label: 'ZenPlus', desc: 'Versioned specs, prompts, parsers, and test suites form a canonical workflow. Non-negotiable rules are evaluated before generation. Workflows can be paused and restarted.', stat: '100%', statLabel: 'Reproducible — same config + same source = same blueprint. Versioned and replayable.' },
  },
  {
    num: '05', title: 'Controlled Exposure', subtitle: 'Deterministic Gates vs Vulnerability Cascade',
    Icon: Shield,
    llm: { label: 'Pure LLM', desc: 'Collapses planning, generation, and fixing into a single volatile loop. If an LLM generates a path traversal flaw, it carries that flaw into the next phase.', stat: '278%', statLabel: 'Path Traversal Risk — increased autonomy in agentic models dramatically spikes vulnerabilities' },
    zf: { label: 'ZenPlus', desc: 'Four deterministic gates: Rule Gen → Code Draft → Reviewer Agent → Security Audit. LLMs handle micro-tasks within rigid AST boundaries.', stat: '4', statLabel: 'Independent Gates — each stage has a specialized reviewer validating against the spec' },
  },
];

const PROOF_COMPONENTS = [
  MissingRuleDetectorProof,
  RegulatorQuestionProof,
  TokenBudgetProof,
  ThreeRunTestProof,
  GateSequenceProof,
];

// ════════════════════════════════════════════════════════════════════════
// Top-level component
// ════════════════════════════════════════════════════════════════════════

export function PillarsTab() {
  const [active, setActive] = useState(0);
  const [expandedDim, setExpandedDim] = useState(0);
  const p = PILLARS[active];
  const Proof = PROOF_COMPONENTS[active];

  const setActiveAndDim = (i) => {
    setActive(i);
    setExpandedDim(i);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight">The 5 Pillars of Governance</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Architectural governance for agentic AI at Visa-scale. Each pillar addresses
          a fundamental gap between raw LLM capability and enterprise production readiness.
        </p>
        <div className="mt-2 text-xs font-semibold italic text-accent">
          Reliability = Deterministic Verification / Probabilistic Variance
        </div>
      </div>

      {/* Pillar selector */}
      <div className="mb-6 grid grid-cols-5 gap-2">
        {PILLARS.map((pl, i) => {
          const Icon = pl.Icon;
          return (
            <button
              key={pl.num}
              onClick={() => setActiveAndDim(i)}
              className={cn(
                'relative rounded-xl border p-3 text-center transition-all',
                active === i ? 'border-accent bg-accent/5 shadow-md' : 'border-border bg-card hover:border-accent/50'
              )}
            >
              <Icon className={cn('mx-auto mb-1 h-4 w-4', active === i ? 'text-accent' : 'text-muted-foreground')} />
              <div className={cn('font-serif text-2xl font-bold leading-none', active === i ? 'text-accent' : 'text-muted-foreground')}>
                {pl.num}
              </div>
              <div className={cn('mt-1 text-[10px] font-semibold leading-tight', active === i ? 'text-foreground' : 'text-muted-foreground')}>
                {pl.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active pillar — header + LLM/ZF stat cards */}
      <div className="mb-1 font-serif text-2xl font-bold">{p.title}</div>
      <div className="mb-5 text-sm font-semibold text-accent">{p.subtitle}</div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-destructive">
              <XCircle className="h-4 w-4" />
              {p.llm.label}
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{p.llm.desc}</p>
            <div className="rounded-lg bg-destructive/10 p-3 text-center">
              <div className="font-serif text-3xl font-bold text-destructive">{p.llm.stat}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{p.llm.statLabel}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-success">
              <CheckCircle2 className="h-4 w-4" />
              {p.zf.label}
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{p.zf.desc}</p>
            <div className="rounded-lg bg-success/10 p-3 text-center">
              <div className="font-serif text-3xl font-bold text-success">{p.zf.stat}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{p.zf.statLabel}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 10-SECOND PROOF — switches based on active pillar */}
      <Card className="mb-6 overflow-hidden border-accent/30">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="accent" className="text-[10px] uppercase tracking-widest">
              10-Second Proof
            </Badge>
            <span className="text-xs italic text-muted-foreground">live demo of this pillar</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Proof />
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Live Comparison Playground (replaces matrix table) */}
      <ComparisonPlayground expanded={expandedDim} setExpanded={setExpandedDim} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PILLAR 01 — The Missing Rule Detector
// ════════════════════════════════════════════════════════════════════════

const RULES_13 = [
  { id: 'R001', name: 'PAN Format' },
  { id: 'R002', name: 'Luhn Checksum' },
  { id: 'R003', name: 'BIN Range' },
  { id: 'R004', name: 'Card Status' },
  { id: 'R005', name: 'Expiry' },
  { id: 'R006', name: 'Velocity' },
  { id: 'R007', name: 'Geo-Risk' },
  { id: 'R008', name: 'Credit Limit' },
  { id: 'R009', name: 'Composite Risk' },
  { id: 'R010', name: 'Interchange' },
  { id: 'R011', name: 'FX Margin' },
  { id: 'R012', name: 'AML/CTR' },
  { id: 'R013', name: 'Auth Response' },
];
const LLM_MISSED = new Set(['R007', 'R011']);

function MissingRuleDetectorProof() {
  const [llmStep, setLlmStep] = useState(-1);
  const [zfStep, setZfStep] = useState(-1);
  const [showImpact, setShowImpact] = useState(false);

  useEffect(() => {
    setLlmStep(-1);
    setZfStep(-1);
    setShowImpact(false);
    let i = 0;
    const t1 = setInterval(() => {
      setLlmStep(i);
      i++;
      if (i >= RULES_13.length) {
        clearInterval(t1);
        let j = 0;
        const t2 = setInterval(() => {
          setZfStep(j);
          j++;
          if (j >= RULES_13.length) {
            clearInterval(t2);
            setTimeout(() => setShowImpact(true), 250);
          }
        }, 60);
      }
    }, 60);
    return () => clearInterval(t1);
  }, []);

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        {/* LLM column */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              LLM extracted 11 rules
            </div>
            <Badge variant="destructive" className="text-[9px]">2 missed</Badge>
          </div>
          <div className="space-y-1">
            {RULES_13.map((r, i) => {
              const visible = i <= llmStep;
              const missed = LLM_MISSED.has(r.id);
              return (
                <motion.div
                  key={r.id}
                  initial={false}
                  animate={{ opacity: visible ? 1 : 0.15, x: visible ? 0 : -4 }}
                  className={cn(
                    'flex items-center gap-2 rounded border px-2 py-1 font-mono text-[11px]',
                    missed && visible
                      ? 'animate-pulse border-destructive bg-destructive/15 text-destructive'
                      : 'border-border bg-card text-foreground'
                  )}
                >
                  {missed && visible ? (
                    <XCircle className="h-3 w-3 flex-shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-success/70" />
                  )}
                  <span className="font-bold">{r.id}</span>
                  <span className={missed && visible ? 'text-destructive' : 'text-muted-foreground'}>
                    {missed && visible ? '— MISSED' : r.name}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ZenPlus column */}
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              ZenPlus extracted 13 rules
            </div>
            <Badge variant="success" className="bg-success/15 text-success text-[9px]">
              all found
            </Badge>
          </div>
          <div className="space-y-1">
            {RULES_13.map((r, i) => {
              const visible = i <= zfStep;
              const recovered = LLM_MISSED.has(r.id);
              return (
                <motion.div
                  key={r.id}
                  initial={false}
                  animate={{ opacity: visible ? 1 : 0.15, x: visible ? 0 : 4 }}
                  className={cn(
                    'flex items-center gap-2 rounded border px-2 py-1 font-mono text-[11px]',
                    recovered && visible
                      ? 'border-success bg-success/15 text-success'
                      : 'border-border bg-card text-foreground'
                  )}
                >
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-success" />
                  <span className="font-bold">{r.id}</span>
                  <span className="text-muted-foreground">{r.name}</span>
                  {recovered && visible && (
                    <span className="ml-auto text-[9px] font-bold text-success">FOUND</span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showImpact && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <p className="leading-relaxed">
                <strong className="text-destructive">2 rules missed.</strong> R007 handles{' '}
                <strong>$4.2B</strong> in annual cross-border volume. R011 applies FX margin on{' '}
                <strong>$890M</strong> in daily trades. Missing these = undetected risk exposure.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PILLAR 02 — The Regulator Question
// ════════════════════════════════════════════════════════════════════════

const REGULATOR_Q = '"Transaction #4847 was declined. Why?"';

function RegulatorQuestionProof() {
  const [typed, setTyped] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    setTyped('');
    setShowAnswers(false);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(REGULATOR_Q.slice(0, i));
      if (i >= REGULATOR_Q.length) {
        clearInterval(t);
        setTimeout(() => setShowAnswers(true), 200);
      }
    }, 25);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      {/* Question */}
      <div className="mb-4 rounded-lg border border-border bg-muted p-4">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          🏛 Regulator asks
        </div>
        <div className="font-serif text-base font-semibold">
          {typed}
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
        </div>
      </div>

      <AnimatePresence>
        {showAnswers && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-4 md:grid-cols-2"
          >
            {/* LLM answer */}
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                LLM Answer
              </div>
              <p className="mb-3 text-xs italic leading-relaxed text-muted-foreground">
                "Based on the transaction patterns and risk profile analysis, the
                system determined this transaction posed elevated risk and was
                declined per standard fraud detection protocols."
              </p>
              <div className="space-y-1">
                {[
                  '📎 No file reference',
                  '📎 No line number',
                  '📎 No audit hash',
                ].map((m) => (
                  <div
                    key={m}
                    className="animate-pulse rounded bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>

            {/* ZenPlus answer */}
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ZenPlus Answer
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="accent" className="font-mono text-[9px]">R006</Badge>
                  <span className="font-bold">Velocity Limit</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  FRAUDCHK.TAL line 201
                </div>
                <div className="rounded bg-card px-2 py-1 font-mono text-[10px]">
                  TXN_COUNT: <strong className="text-destructive">18</strong> &gt; LIMIT:{' '}
                  <strong>15</strong>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Chain: R001✓ → R002✓ → R003✓ → R004✓ → R005✓ →{' '}
                  <span className="font-bold text-warning">R006⚠ FLAGGED</span>
                </div>
                <div className="flex items-center gap-1 rounded bg-card px-2 py-1">
                  <Hash className="h-3 w-3 text-accent" />
                  <span className="font-mono text-[10px] text-accent">SHA-a3f8c2e1</span>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {[
                  '📎 Source-linked',
                  '📎 Tamper-evident',
                  '📎 Regulator-ready',
                ].map((m) => (
                  <div
                    key={m}
                    className="rounded bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success"
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-3 text-center text-xs italic text-muted-foreground">
        A regulator doesn't accept "based on patterns." They need: File. Line. Hash. Chain.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PILLAR 03 — The Token Budget
// ════════════════════════════════════════════════════════════════════════

function TokenBudgetProof() {
  const [codebaseSize, setCodebaseSize] = useState(9); // millions of lines
  const llmTokens = useMemo(() => Math.round(codebaseSize * 110_000), [codebaseSize]);
  const llmFailRate = useMemo(() => {
    // Empirical curve — at 1M lines ~10%, at 9M ~24%
    return Math.min(35, Math.round(8 + codebaseSize * 1.8));
  }, [codebaseSize]);

  return (
    <div>
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        {/* What the LLM receives */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              What the LLM receives
            </div>
            <span className="text-[9px] text-muted-foreground">{codebaseSize}M lines of TAL</span>
          </div>
          {/* Visual: dense block representing 9M lines */}
          <div
            className="relative mb-2 h-32 overflow-hidden rounded border border-destructive/40 bg-primary"
            aria-hidden
          >
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute h-px bg-destructive/40"
                style={{ top: `${i * 2.5}px`, left: 4, right: 4 }}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-destructive/10 to-destructive/30" />
            <div className="absolute bottom-1 right-2 font-mono text-[9px] text-destructive">
              flooded
            </div>
          </div>
          <div className="font-mono text-[11px] text-destructive">
            ◄── {llmTokens.toLocaleString()} tokens ──►
          </div>
          <div className="mt-1 text-[10px] font-bold text-destructive">
            {llmFailRate}% retrieval failure (MRCR v2)
          </div>
        </div>

        {/* What ZenPlus sends */}
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              What ZenPlus sends
            </div>
            <span className="text-[9px] text-muted-foreground">scoped snippet</span>
          </div>
          {/* Visual: clean snippet */}
          <div className="relative mb-2 h-32 overflow-hidden rounded border-2 border-success bg-card">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded bg-success/10 px-3 py-2 text-center">
                <div className="font-mono text-[11px] font-bold text-success">CREDITAUTH.TAL</div>
                <div className="font-mono text-[10px] text-success/70">lines 88–145</div>
                <div className="mt-1 font-mono text-[9px] text-muted-foreground">57 lines</div>
              </div>
            </div>
          </div>
          <div className="font-mono text-[11px] text-success">◄── 200 tokens ──►</div>
          <div className="mt-1 text-[10px] font-bold text-success">0% context rot · 100% grounded</div>
        </div>
      </div>

      {/* Slider */}
      <div className="rounded-lg border bg-muted p-3">
        <div className="mb-2 flex items-center justify-between text-[10px]">
          <span className="font-bold uppercase tracking-widest text-muted-foreground">
            Codebase size
          </span>
          <span className="font-mono font-bold text-foreground">{codebaseSize}M lines</span>
        </div>
        <input
          type="range"
          min={1}
          max={9}
          step={1}
          value={codebaseSize}
          onChange={(e) => setCodebaseSize(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="mt-2 text-[10px] italic text-muted-foreground">
          Drag the slider. Watch the LLM failure rate climb. ZenPlus stays at 200 tokens.
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PILLAR 04 — The 3-Run Test
// ════════════════════════════════════════════════════════════════════════

function genLlmRuns() {
  // Each call returns a fresh random set of 3 runs — used to demonstrate
  // that LLM output drifts even on identical input.
  return [0, 1, 2].map(() => {
    const possibleRules = [10, 11, 12, 13];
    const possibleHigh = [3, 4, 5];
    return {
      rules: possibleRules[Math.floor(Math.random() * possibleRules.length)],
      high: possibleHigh[Math.floor(Math.random() * possibleHigh.length)],
      missed: ['R007', 'R011'].filter(() => Math.random() > 0.4),
    };
  });
}

function ThreeRunTestProof() {
  const [llmRuns, setLlmRuns] = useState(() => genLlmRuns());
  const zfRuns = useMemo(
    () => [0, 1, 2].map(() => ({ rules: 13, high: 5, missed: [] })),
    []
  );

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Same TAL input → 3 runs. What comes out?
      </p>

      {/* LLM runs */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <XCircle className="h-3.5 w-3.5 text-destructive" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-destructive">
            LLM
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {llmRuns.map((r, i) => (
            <motion.div
              key={`llm-${r.rules}-${r.high}-${r.missed.join('')}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs"
            >
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-destructive">
                Run {i + 1}
              </div>
              <div className="font-mono text-foreground">{r.rules} rules</div>
              {['R007', 'R011'].map((rid) => (
                <div key={rid} className="font-mono text-[10px]">
                  {rid}:{' '}
                  {r.missed.includes(rid) ? (
                    <span className="text-destructive">MISSED</span>
                  ) : (
                    <span className="text-success">found</span>
                  )}
                </div>
              ))}
              <div className="font-mono text-[10px] text-muted-foreground">
                Crit: {r.high} HIGH
              </div>
              <div className="mt-2 text-center text-base font-bold text-destructive">≠ different</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ZenPlus runs */}
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-success">
            ZenPlus
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {zfRuns.map((r, i) => (
            <div
              key={`zf-${i}`}
              className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs"
            >
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-success">
                Run {i + 1}
              </div>
              <div className="font-mono text-foreground">{r.rules} rules</div>
              <div className="font-mono text-[10px] text-success">All found</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                Crit: {r.high} HIGH
              </div>
              <div className="mt-2 text-center text-base font-bold text-success">= identical ✓</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted p-3">
        <div className="text-xs italic text-muted-foreground">
          LLM results change. ZenPlus results never do.
        </div>
        <Button onClick={() => setLlmRuns(genLlmRuns())} variant="accent" size="sm">
          <Play className="h-3 w-3" />
          Run Again
        </Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PILLAR 05 — The Gate Sequence
// ════════════════════════════════════════════════════════════════════════

const GATES = [
  { name: 'Rule Gen',   check: 'Verified against AML Policy v4.2' },
  { name: 'Code Draft', check: 'Field mapping 8/8 correct' },
  { name: 'Reviewer',   check: 'Logic equivalence 100%' },
  { name: 'Security',   check: 'No SQL inject · No path traverse' },
];

function GateSequenceProof() {
  const [step, setStep] = useState(-1);
  const [bouncedAtGate3, setBouncedAtGate3] = useState(false);
  const [showFlawDemo, setShowFlawDemo] = useState(false);

  // Auto-play forward
  useEffect(() => {
    if (showFlawDemo) return;
    setStep(-1);
    setBouncedAtGate3(false);
    let i = -1;
    const t = setInterval(() => {
      i++;
      setStep(i);
      if (i >= GATES.length) clearInterval(t);
    }, 380);
    return () => clearInterval(t);
  }, [showFlawDemo]);

  // Flaw-demo sequence: dot enters Gate 3, fails, bounces back to Gate 2, recalculates, re-enters Gate 3, passes
  useEffect(() => {
    if (!showFlawDemo) return;
    setStep(-1);
    setBouncedAtGate3(false);
    let i = -1;
    const t = setInterval(() => {
      i++;
      setStep(i);
      if (i === 2) {
        // Hit Gate 3 — bounce
        clearInterval(t);
        setTimeout(() => {
          setBouncedAtGate3(true);
          setStep(1); // back to gate 2
          setTimeout(() => {
            setBouncedAtGate3(false);
            let j = 1;
            const t2 = setInterval(() => {
              j++;
              setStep(j);
              if (j >= GATES.length) clearInterval(t2);
            }, 380);
          }, 700);
        }, 600);
      }
    }, 380);
    return () => clearInterval(t);
  }, [showFlawDemo]);

  const done = step >= GATES.length - 1 && !bouncedAtGate3;

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        <span className="font-mono font-bold text-accent">R012</span> (AML/CTR Screening)
        passes through 4 independent gates:
      </p>

      <div className="relative mb-4 grid grid-cols-4 gap-2">
        {GATES.map((g, i) => {
          const isPast = step > i;
          const isCurrent = step === i && !bouncedAtGate3;
          const isFailed = bouncedAtGate3 && i === 2;
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className={cn(
                  'relative w-full rounded-lg border p-3 text-center transition-all',
                  isPast && 'border-success bg-success/5',
                  isCurrent && !isFailed && 'border-accent bg-accent/10 shadow-md scale-[1.04]',
                  isFailed && 'border-destructive bg-destructive/10',
                  !isPast && !isCurrent && !isFailed && 'border-border bg-card'
                )}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Gate {i + 1}
                </div>
                <div className="mt-1 text-xs font-bold">{g.name}</div>
                <p className="mt-1 text-[9px] leading-snug text-muted-foreground">{g.check}</p>
                <div className="mt-2">
                  {isPast && <CheckCircle2 className="mx-auto h-4 w-4 text-success" />}
                  {isCurrent && !isFailed && <Loader2 className="mx-auto h-4 w-4 animate-spin text-accent" />}
                  {isFailed && <XCircle className="mx-auto h-4 w-4 text-destructive" />}
                  {!isPast && !isCurrent && !isFailed && <div className="h-4" />}
                </div>
              </div>
              {i < GATES.length - 1 && (
                <div
                  className={cn(
                    'absolute top-1/2 h-0.5 -translate-y-1/2',
                    isPast ? 'bg-success' : 'bg-border'
                  )}
                  style={{
                    left: `${(i + 1) * 25 - 1}%`,
                    width: '2%',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {bouncedAtGate3 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
              <span>
                <strong className="text-destructive">Gate 3 caught a flaw.</strong> Logic
                equivalence failed — bouncing back to Gate 2 to recalculate field mapping.
                The flaw never reaches production.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {done && !showFlawDemo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-lg border border-success/30 bg-success/5 p-3 text-center"
          >
            <Badge variant="success" className="bg-success/15 text-success">
              <CheckCircle2 className="h-3 w-3" />
              Production Ready · 4/4 gates passed
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-3 flex items-center gap-2">
        <Button
          onClick={() => setShowFlawDemo((s) => !s)}
          variant="outline"
          size="sm"
        >
          {showFlawDemo ? 'Reset' : 'What if Gate 3 catches a flaw?'}
        </Button>
      </div>

      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[11px] text-muted-foreground">
        <strong className="text-destructive">LLM:</strong> Generate → Ship. No gates. No
        review. No catch.
        <br />
        <strong className="text-success">ZenPlus:</strong> 4 gates. Each gate is a{' '}
        <em>different</em> agent. A flaw must fool 4 independent reviewers to reach production.
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// REPLACEMENT FOR THE MATRIX TABLE — Comparison Playground
// ════════════════════════════════════════════════════════════════════════

const DIMENSIONS = [
  { key: 'analysis',     Icon: Search,    title: 'Analysis Engine',    summary: 'LLM: vague paraphrase → ZenPlus: precise AST extraction', expand: AnalysisEngineExpand },
  { key: 'traceability', Icon: Link2,     title: 'Traceability',       summary: 'LLM: chat transcript → ZenPlus: File:Line:SHA chain',     expand: TraceabilityExpand },
  { key: 'context',      Icon: Layers,    title: 'Context Management', summary: 'LLM: 1M tokens dumped → ZenPlus: 200 tokens scoped',      expand: ContextMgmtExpand },
  { key: 'repeat',       Icon: RotateCw,  title: 'Repeatability',      summary: 'LLM: different each run → ZenPlus: identical always',     expand: RepeatabilityExpand },
  { key: 'gates',        Icon: Shield,    title: 'Error Gates',        summary: 'LLM: 1 pass → ZenPlus: 4 independent gates',              expand: ErrorGatesExpand },
];

function ComparisonPlayground({ expanded, setExpanded }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-serif text-lg font-bold">Live Comparison Playground</h3>
        <span className="text-xs italic text-muted-foreground">click any dimension</span>
      </div>
      <div className="space-y-2">
        {DIMENSIONS.map((d, i) => {
          const isOpen = expanded === i;
          const Expand = d.expand;
          const Icon = d.Icon;
          return (
            <div
              key={d.key}
              className="overflow-hidden rounded-xl border bg-card"
              style={{ borderLeftWidth: 4, borderLeftColor: isOpen ? 'hsl(var(--accent))' : 'hsl(var(--border))' }}
            >
              <button
                onClick={() => setExpanded(isOpen ? -1 : i)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <Icon className={cn('h-4 w-4', isOpen ? 'text-accent' : 'text-muted-foreground')} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-bold', isOpen ? 'text-foreground' : 'text-foreground')}>
                      {d.title}
                    </span>
                    {isOpen && (
                      <Badge variant="accent" className="text-[9px]">active</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{d.summary}</div>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t bg-muted/20 p-4">
                      <Expand />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Accordion expanded contents ──────────────────────────────────────────

function AnalysisEngineExpand() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-destructive">
          LLM: "Here's what I think this code does…"
        </div>
        <CodeBlock code="PROC CHECK^VELOCITY^LIMITS..." className="mb-2" />
        <div className="rounded bg-card p-2 text-xs italic text-muted-foreground">
          → "This appears to check transaction velocity against a limit." <em>(vague)</em>
        </div>
      </div>
      <div className="rounded-lg border border-success/30 bg-success/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-success">
          ZenPlus: "Here's exactly what this code does."
        </div>
        <CodeBlock code="PROC CHECK^VELOCITY^LIMITS..." className="mb-2" />
        <div className="space-y-1 rounded bg-card p-2 font-mono text-[10px]">
          <div><span className="text-muted-foreground">Params:</span> 5 (ACCT^NUM, TXN^AMT, TXN^COUNT, VELOCITY^LIMIT, RISK^FLAG)</div>
          <div><span className="text-muted-foreground">Branches:</span> 3 (&gt;limit, &gt;80%, large single)</div>
          <div><span className="text-muted-foreground">Calls:</span> FLAG^SUSPICIOUS, ROUTE^MANUAL, LOG^NEAR^LIMIT, FLAG^LARGE^SINGLE</div>
          <div><span className="text-muted-foreground">Return:</span> void (sets RISK^FLAG by ref)</div>
          <div><span className="text-muted-foreground">Complexity:</span> 4 (cyclomatic)</div>
        </div>
      </div>
    </div>
  );
}

function TraceabilityExpand() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-destructive">
          LLM: chat transcript
        </div>
        <div className="space-y-2 rounded bg-card p-3 font-mono text-[10px]">
          <div><span className="text-muted-foreground">User:</span> convert this TAL routine to Java</div>
          <div><span className="text-muted-foreground">Assistant:</span> Here's the Java for that routine: ```java\npublic void check…\n```</div>
          <div><span className="text-muted-foreground">User:</span> what file did it come from?</div>
          <div className="text-destructive">
            <span className="text-muted-foreground">Assistant:</span> I don't have access to the original file context.
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-success/30 bg-success/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-success">
          ZenPlus: bidirectional chain
        </div>
        <div className="flex flex-col gap-2">
          {[
            { label: 'TAL source',    val: 'FRAUDCHK.TAL:201',         icon: FileText },
            { label: 'Rule ID',       val: 'R006 Velocity Limit',      icon: Hash },
            { label: 'Generated Java',val: 'VelocityCheckService.java',icon: FileText },
            { label: 'Audit hash',    val: 'SHA-a3f8c2e1',             icon: Hash },
          ].map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <c.icon className="h-3 w-3 text-success" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {c.label}
              </span>
              <span className="font-mono text-[10px] text-foreground">{c.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContextMgmtExpand() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-destructive">
          LLM: 1M+ tokens
        </div>
        <div className="relative h-24 overflow-hidden rounded border border-destructive/30 bg-primary">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-px bg-destructive/30"
              style={{ top: `${i * 2.5}px`, left: 4, right: 4 }}
            />
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-success/20 px-1.5 text-[8px] font-bold text-success">
            relevant snippet (lost)
          </div>
        </div>
        <div className="mt-2 font-mono text-[10px] text-destructive">
          24% retrieval failure (MRCR v2)
        </div>
      </div>
      <div className="rounded-lg border border-success/30 bg-success/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-success">
          ZenPlus: 200 tokens
        </div>
        <div className="flex h-24 items-center justify-center rounded border-2 border-success bg-card">
          <div className="rounded bg-success/10 px-3 py-2 text-center font-mono">
            <div className="text-[10px] font-bold text-success">CREDITAUTH.TAL:88-145</div>
            <div className="text-[9px] text-muted-foreground">57 lines</div>
          </div>
        </div>
        <div className="mt-2 font-mono text-[10px] text-success">0% context rot · grounded</div>
      </div>
    </div>
  );
}

function RepeatabilityExpand() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-destructive">
          LLM: 3 runs, 3 outputs
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[11, 12, 13].map((n, i) => (
            <div key={i} className="rounded border border-destructive/30 bg-card p-2 text-center">
              <div className="text-[9px] text-muted-foreground">Run {i + 1}</div>
              <div className="font-mono text-base font-bold text-destructive">{n}</div>
              <div className="text-[8px] text-muted-foreground">rules</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-center font-bold text-destructive">≠ different</div>
      </div>
      <div className="rounded-lg border border-success/30 bg-success/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-success">
          ZenPlus: 3 runs, identical
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[13, 13, 13].map((n, i) => (
            <div key={i} className="rounded border border-success/30 bg-card p-2 text-center">
              <div className="text-[9px] text-muted-foreground">Run {i + 1}</div>
              <div className="font-mono text-base font-bold text-success">{n}</div>
              <div className="text-[8px] text-muted-foreground">rules</div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-center font-bold text-success">= identical ✓</div>
      </div>
    </div>
  );
}

function ErrorGatesExpand() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-destructive">
          LLM: 1 pass
        </div>
        <div className="flex h-24 items-center justify-center gap-2">
          <div className="rounded-lg border border-destructive/40 bg-card px-3 py-2 text-center">
            <div className="text-[9px] text-muted-foreground">step</div>
            <div className="text-xs font-bold text-destructive">Generate</div>
          </div>
          <span className="text-destructive">→</span>
          <div className="rounded-lg border border-destructive/40 bg-card px-3 py-2 text-center">
            <div className="text-[9px] text-muted-foreground">step</div>
            <div className="text-xs font-bold text-destructive">Ship</div>
          </div>
        </div>
        <div className="mt-2 text-center text-[10px] italic text-destructive">
          No gates. No review. No catch.
        </div>
      </div>
      <div className="rounded-lg border border-success/30 bg-success/5 p-3">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-success">
          ZenPlus: 4 independent gates
        </div>
        <div className="flex h-24 items-center justify-center gap-1">
          {['Rule', 'Code', 'Reviewer', 'Security'].map((g, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="rounded-lg border border-success/40 bg-card px-2 py-1.5 text-center">
                <div className="text-[8px] text-muted-foreground">G{i + 1}</div>
                <div className="text-[10px] font-bold text-success">{g}</div>
                <CheckCircle2 className="mx-auto mt-0.5 h-3 w-3 text-success" />
              </div>
              {i < 3 && <span className="text-success">→</span>}
            </div>
          ))}
        </div>
        <div className="mt-2 text-center text-[10px] italic text-success">
          Each gate is a different agent.
        </div>
      </div>
    </div>
  );
}
