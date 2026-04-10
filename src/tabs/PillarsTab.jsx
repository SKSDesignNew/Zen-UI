import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PILLARS = [
  {
    num: '01', title: 'Structural Integrity', subtitle: 'Deterministic Extraction vs Probabilistic Inference',
    llm: { label: 'Pure LLM (Opus 4.6)', desc: 'Relies on token prediction. Outputs shift based on temperature, model version, or prompt phrasing. The same TAL routine can produce different Java across runs.', stat: '+21%', statLabel: 'Issue Density — raw Opus 4.6 output yields higher defect rates per 1K lines vs predecessor' },
    zf: { label: 'ZenPlus', desc: 'Custom TAL parser isolates operations, call graphs, and metadata before any LLM involvement. Identical input always yields identical architectural blueprint.', stat: '100%', statLabel: 'Deterministic — same TAL input produces same inventory and metadata every single time' },
    example: 'ZenPlus extracts all 13 rules (R001–R013) structurally from AUTHPROC.TAL, FRAUDCHK.TAL, and FEECALC.TAL. An LLM-only approach missed R007 (Geo-Risk) and R011 (FX Margin) because they weren\'t explicitly referenced in the prompt.',
  },
  {
    num: '02', title: 'Lineage & Traceability', subtitle: 'Bidirectional Metadata Graph vs Chat Logs',
    llm: { label: 'Pure LLM', desc: 'Conversational history lacks structured provenance. When an audit asks "Which source caused this Java change?", developers hunt through thousands of lines.', stat: '0', statLabel: 'Structured lineage links — auditor gets a conversation transcript, not a metadata chain' },
    zf: { label: 'ZenPlus', desc: 'Every generated rule, verticle, test, and fix is hard-linked to the exact TAL file, routine, and line range. Bidirectional tethering from source to target.', stat: '100%', statLabel: 'Bidirectional links — every Java class traces back to exact TAL routine and line' },
    example: 'When a regulator asks "Why was transaction #4847 declined?", ZenPlus traces: R006 (Velocity Limit, FRAUDCHK.TAL:201) triggered by R004 (Card Status, AUTHPROC.TAL:142) → routed to manual review.',
  },
  {
    num: '03', title: 'Context Management', subtitle: 'Snippet Grounding vs Context Flooding',
    llm: { label: 'Pure LLM', desc: 'Dumps full codebases into prompts. Opus 4.6 scores 78.3% on MRCR v2 at 64K tokens — impressive, but a 24% failure rate is catastrophic at Visa-scale migration.', stat: '24%', statLabel: 'Failure Rate — at 1M tokens, even the best model misses 1 in 4 retrievals' },
    zf: { label: 'ZenPlus', desc: 'LLM calls receive only tiny, grounded snippets: a specific TAL routine for rules, or a TAL-Java pair for fixes. The LLM never searches the haystack.', stat: '0%', statLabel: 'Context Rot — scoped snippets eliminate token flooding and enforce standardization' },
    example: 'For R008 (Credit Limit Auth), ZenPlus passes only CREDITAUTH.TAL lines 88–145 to the LLM — not the entire 9M-line codebase. The LLM operates on 200 tokens of context, not 1M.',
  },
  {
    num: '04', title: 'Repeatability', subtitle: 'Spec-Driven Development vs Re-Prompting',
    llm: { label: 'Pure LLM', desc: 'Re-prompting workflows suffer from history drift. As conversation context shifts, the AI\'s understanding degrades. No canonical workflow to version.', stat: '+55%', statLabel: 'Vulnerability Density — increased autonomy leads to aggressive exploration, spiking flaws' },
    zf: { label: 'ZenPlus', desc: 'Versioned specs, prompts, parsers, and test suites form a canonical workflow. Non-negotiable rules are evaluated before generation. Workflows can be paused and restarted.', stat: '100%', statLabel: 'Reproducible — same config + same source = same blueprint. Versioned and replayable.' },
    example: 'Run the pipeline 3 times with the same TAL input. ZenPlus produces identical output: 13 rules, 15 edges, same criticality scores. The LLM produces 11 rules on run 1, 12 on run 2, 13 on run 3.',
  },
  {
    num: '05', title: 'Controlled Exposure', subtitle: 'Deterministic Gates vs Vulnerability Cascade',
    llm: { label: 'Pure LLM', desc: 'Collapses planning, generation, and fixing into a single volatile loop. If an LLM generates a path traversal flaw, it carries that flaw into the next phase.', stat: '278%', statLabel: 'Path Traversal Risk — increased autonomy in agentic models dramatically spikes vulnerabilities' },
    zf: { label: 'ZenPlus', desc: 'Four deterministic gates: Rule Gen → Code Draft → Reviewer Agent → Security Audit. LLMs handle micro-tasks within rigid AST boundaries.', stat: '4', statLabel: 'Independent Gates — each stage has a specialized reviewer validating against the spec' },
    example: 'When generating Java for R012 (AML/CTR Screening), output passes through: (1) Rule verification against AML-Policy, (2) Code draft with scoped context, (3) Independent reviewer, (4) Security audit.',
  },
];

const MATRIX = [
  { dim: 'Analysis Engine', llm: 'Probabilistic Inference', zf: 'Deterministic TAL Parser (AST)' },
  { dim: 'Traceability', llm: 'Unstructured Chat Logs', zf: 'Bidirectional Metadata Graph' },
  { dim: 'Context Mgmt', llm: '1M Token Flooding', zf: 'Laser-Targeted Snippet Grounding' },
  { dim: 'Repeatability', llm: 'Volatile Re-prompting', zf: 'Versioned Spec-Driven Development' },
  { dim: 'Error Mitigation', llm: 'Cascading Agentic Loops', zf: 'Multi-Agent Deterministic Gates' },
];

export function PillarsTab() {
  const [active, setActive] = useState(0);
  const p = PILLARS[active];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight">The 5 Pillars of Governance</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Architectural governance for agentic AI at Visa-scale. Each pillar addresses a fundamental gap between raw LLM capability and enterprise production readiness.
        </p>
        <div className="mt-2 text-xs font-semibold italic text-accent">
          Reliability = Deterministic Verification / Probabilistic Variance
        </div>
      </div>

      {/* Pillar selector */}
      <div className="mb-6 grid grid-cols-5 gap-2">
        {PILLARS.map((pl, i) => (
          <button
            key={pl.num}
            onClick={() => setActive(i)}
            className={cn(
              'relative rounded-xl border p-3 text-center transition-all',
              active === i ? 'border-accent bg-accent/5 shadow-md' : 'border-border bg-card hover:border-accent/50'
            )}
          >
            <div className={cn('font-serif text-2xl font-bold', active === i ? 'text-accent' : 'text-muted-foreground')}>
              {pl.num}
            </div>
            <div className={cn('mt-1 text-[10px] font-semibold leading-tight', active === i ? 'text-foreground' : 'text-muted-foreground')}>
              {pl.title}
            </div>
          </button>
        ))}
      </div>

      {/* Active pillar detail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
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

          <Card className="mb-6 border-accent/30 bg-accent/5">
            <CardContent className="p-4">
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">
                Credit Card Auth Pipeline — This Pillar in Action
              </div>
              <p className="text-sm leading-relaxed">{p.example}</p>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Architectural matrix */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 font-serif text-lg font-bold">The Architectural Matrix</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2">
                <th className="py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dimension</th>
                <th className="py-2 text-left text-[10px] font-bold uppercase tracking-wider text-destructive">Pure Opus 4.6</th>
                <th className="py-2 text-left text-[10px] font-bold uppercase tracking-wider text-success">ZenPlus Orchestration</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((r, i) => (
                <tr key={r.dim} className={cn('border-b', i === active && 'bg-accent/5')}>
                  <td className="py-3 pr-4 font-semibold">{r.dim}</td>
                  <td className="py-3 pr-4 text-destructive">
                    <XCircle className="mr-1.5 inline h-3 w-3" />
                    {r.llm}
                  </td>
                  <td className="py-3 text-success">
                    <CheckCircle2 className="mr-1.5 inline h-3 w-3" />
                    {r.zf}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
