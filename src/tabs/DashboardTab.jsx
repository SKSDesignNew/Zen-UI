import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, Wrench, Shield, TrendingUp, Rocket, Code2, TestTube, ShieldCheck, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STAGES = [
  { name: 'Inventory', pct: 100, count: '100,000', desc: 'Every TAL routine scanned, every business rule tagged with domain, criticality, and source.', color: 'success', Icon: Search },
  { name: 'Extract', pct: 87, count: '87,000', desc: 'Rules extracted as atomic units with AST metadata, call graphs computed across all TAL files.', color: 'accent', Icon: CheckCircle2 },
  { name: 'Convert', pct: 64, count: '64,000', desc: 'TAL routines converted to Java inside governed sandbox with field-level reconciliation.', color: 'info', Icon: Wrench },
  { name: 'Validate', pct: 52, count: '52,000', desc: 'Behavioral equivalence verified: synthetic transactions per rule, regression, security scan.', color: 'accent', Icon: Shield },
  { name: 'Production', pct: 38, count: '38,000', desc: 'Validated Java deployed with immutable audit trail, rollback capability, real-time monitoring.', color: 'success', Icon: Rocket },
];

const PERSONAS = [
  { role: 'Engineer', Icon: Code2, view: 'Source TAL, AST, Java target, field mappings, build status',
    detail: { Source: 'FRAUDCHK.TAL:201–267', Routine: 'CHECK^VELOCITY^LIMITS', Fields: 'TXN^COUNT^24HR, VELOCITY^LIMIT, ALERT^LEVEL', Target: 'VelocityCheckService.java', Tests: '12 unit · 3 integration · 2 boundary', Build: '✓ Compiles · ✓ Tests pass · ✓ Sonar clean' } },
  { role: 'Tester', Icon: TestTube, view: 'Test cases, coverage metrics, regression, edge cases',
    detail: { 'Test Cases': '15 total: 8 pass, 4 exceed, 2 boundary, 1 zero-vel', Coverage: 'Branches: 100% · Conditions: 96% · Paths: 94%', Regression: '42/42 passed across full pipeline', 'Edge Cases': 'Velocity=0, Velocity=limit, Velocity=MAX_INT' } },
  { role: 'Compliance', Icon: ShieldCheck, view: 'Audit trail, regulatory mapping, policies, approvals',
    detail: { Regulation: 'BSA/AML — 31 CFR 1010.311 · OCC 2019-37', Policy: 'FRAUD-VEL-001 v3.2 (2024-01-15)', 'Audit Trail': 'SHA: a3f8c2e1 · Source hash verified', 'Approval Chain': 'Extract → AI-gen → Reviewer → CISO' } },
  { role: 'Business', Icon: BarChart3, view: 'Plain English rule, business impact, KPIs, what-if',
    detail: { 'Plain English': 'If a cardholder makes more than 15 transactions in 24 hours, flag as suspicious.', Impact: 'Threshold 15→20: −18% false positives, +12% fraud exposure', 'Connected KPIs': 'Fraud Detection Rate, False Positive Rate', 'What-If': 'Lower to 10: +32% reviews. Raise to 20: −18% reviews.' } },
];

const BADGES = [
  { badge: 'SOC 2 Type II', desc: 'Audited security controls' },
  { badge: 'ISO 27001', desc: 'Information security' },
  { badge: 'ISO 42001', desc: 'AI management system' },
  { badge: 'FINIPC Ready', desc: 'Field-level reconciliation' },
];

export function DashboardTab() {
  const [active, setActive] = useState(null);
  const [pidx, setPidx] = useState(0);
  const p = PERSONAS[pidx];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h2 className="font-serif text-3xl font-bold tracking-tight">Migration Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time progress across 100,000 rules. Click any stage to see details.
        </p>
      </div>

      {/* Pipeline funnel */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-4 flex items-end gap-2">
            {STAGES.map((s, i) => {
              const isActive = active === i;
              const height = isActive ? 140 : Math.max(50, s.pct * 1.1);
              return (
                <motion.div
                  key={s.name}
                  onClick={() => setActive(isActive ? null : i)}
                  className="flex flex-1 cursor-pointer flex-col items-center"
                  whileHover={{ y: -4 }}
                >
                  <s.Icon className={cn('mb-2 h-5 w-5', isActive ? 'text-accent' : 'text-muted-foreground')} />
                  <div className={cn('mb-2 text-[10px] font-bold uppercase tracking-wide',
                    isActive ? 'text-foreground' : 'text-muted-foreground')}>{s.name}</div>
                  <motion.div
                    layout
                    className={cn('flex w-full flex-col items-center justify-center rounded-xl transition-all',
                      isActive ? 'bg-accent text-accent-foreground' : 'bg-accent/70 text-white'
                    )}
                    style={{ height }}
                  >
                    <div className={cn('font-serif font-bold', isActive ? 'text-2xl' : 'text-lg')}>
                      {s.pct}%
                    </div>
                    <div className="font-mono text-[10px] opacity-80">{s.count}</div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            {active !== null && (
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-lg border border-accent/30 bg-accent/5 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  {(() => {
                    const S = STAGES[active];
                    return <S.Icon className="h-5 w-5 text-accent" />;
                  })()}
                  <div className="font-semibold">{STAGES[active].name}</div>
                  <div className="ml-auto font-serif text-lg font-bold text-accent">
                    {STAGES[active].count} rules
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{STAGES[active].desc}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Timeline comparison */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-destructive">Without ZenPlus</div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-5xl font-bold text-destructive">18+</span>
              <span className="text-sm text-muted-foreground">months</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Manual verification for every AI output. No progress tracking. Re-prompting drift means earlier work needs redoing.
            </p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-6">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-success">With ZenPlus</div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-5xl font-bold text-success">6</span>
              <span className="text-sm text-muted-foreground">months</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Real-time dashboard. Every artifact versioned and traceable. Sandbox validation before production.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Multi-persona view */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-accent">
            Same Rule R006 — Four Team Perspectives
          </div>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {PERSONAS.map((ps, i) => (
              <button key={ps.role} onClick={() => setPidx(i)}
                className={cn(
                  'flex flex-col items-center rounded-lg border p-3 transition-all',
                  pidx === i ? 'border-accent bg-accent/5' : 'hover:border-accent/50'
                )}
              >
                <ps.Icon className={cn('h-5 w-5', pidx === i ? 'text-accent' : 'text-muted-foreground')} />
                <span className="mt-1 text-xs font-semibold">{ps.role}</span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={pidx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-2 text-xs text-muted-foreground">
                {p.role} sees: <em>{p.view}</em>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <div className="mb-2 font-semibold">R006 — Velocity Limit</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {Object.entries(p.detail).map(([k, v]) => (
                    <div key={k}>
                      <div className="font-semibold uppercase text-[10px] tracking-wider text-muted-foreground">{k}</div>
                      <div className="mt-0.5 leading-snug">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Compliance badges */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {BADGES.map((b) => (
          <Card key={b.badge} className="bg-primary text-primary-foreground">
            <CardContent className="flex flex-col items-center p-4 text-center">
              <Shield className="mb-2 h-6 w-6 text-accent" />
              <div className="text-xs font-bold text-accent">{b.badge}</div>
              <div className="mt-0.5 text-[10px] text-primary-foreground/60">{b.desc}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
