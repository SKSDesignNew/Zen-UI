import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ShieldCheck, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* ── Pyramid tiers ── */
const TIERS = [
  { label: 'CRITICAL', count: 14, width: '30%', bg: 'bg-red-900/10', border: 'border-red-900/20', text: 'text-red-800 dark:text-red-400', badgeCls: 'border-red-900/30 bg-red-900/15 text-red-800' },
  { label: 'HIGH', count: 186, width: '48%', bg: 'bg-orange-800/10', border: 'border-orange-800/20', text: 'text-orange-800 dark:text-orange-400', badgeCls: 'border-orange-800/30 bg-orange-800/15 text-orange-800' },
  { label: 'MEDIUM', count: 623, width: '66%', bg: 'bg-accent/10', border: 'border-accent/20', text: 'text-accent', badgeCls: 'border-accent/30 bg-accent/10 text-accent' },
  { label: 'LOW', count: 1177, width: '84%', bg: 'bg-muted', border: 'border-border', text: 'text-muted-foreground', badgeCls: 'border-border bg-muted text-muted-foreground' },
];

/* ── Critical rules (14 real rules) ── */
const CRITICAL_RULES = [
  { id: 'R-PMT-001', name: 'Payment authority check', domain: 'Authorization', source: 'PMTAPPR.TAL:CHECK^PAYMENT^AUTHORITY', reg: 'SOX Section 302', english: 'Each user has dollar limits by payment type. Exceed = escalation required.', java: 'PaymentAuthorityService.checkAuthority()' },
  { id: 'R-PMT-002', name: 'Duplicate payment detection', domain: 'Fraud', source: 'PMTAPPR.TAL:CHECK^DUPLICATE^PAYMENT', reg: 'OIG Fraud Prevention', english: 'Same provider + same date + same amount within 30 days = hold as duplicate.', java: 'DuplicateDetectionService.checkDuplicate()' },
  { id: 'R-PMT-003', name: 'Medical bill review gate', domain: 'Compliance', source: 'PMTAPPR.TAL:CHECK^MEDICAL^BILL^REVIEW', reg: 'State WC Fee Schedule', english: 'Medical bills must be reviewed before payment. Reduced = pay allowed amount.', java: 'MedicalBillReviewService.checkReview()' },
  { id: 'R-PMT-004', name: 'Indemnity schedule validation', domain: 'Benefits', source: 'PMTAPPR.TAL:CHECK^INDEMNITY^SCHEDULE', reg: 'State WC Benefit Regs', english: 'Indemnity payments must match approved schedule dates and weekly rate.', java: 'IndemnityScheduleService.validate()' },
  { id: 'R-PMT-005', name: 'Lien & garnishment check', domain: 'Compliance', source: 'PMTAPPR.TAL:CHECK^LIENS', reg: 'MSPRA — 42 USC 1395y', english: 'Check for IRS, child support, attorney, Medicare liens. Deduct before payment.', java: 'LienCheckService.checkLiens()' },
  { id: 'R-PMT-006', name: '1099 tax tracking', domain: 'Compliance', source: 'PMTAPPR.TAL:UPDATE^1099^TRACKING', reg: 'IRS — 26 USC 6041', english: 'Accumulate payments by payee TIN. Over $600 = flag for 1099 filing.', java: 'Tax1099TrackingService.update()' },
  { id: 'R-PMT-007', name: 'ABA routing validation', domain: 'Settlement', source: 'PMTEFT.TAL:VALIDATE^ROUTING^NUMBER', reg: 'NACHA Operating Rules', english: 'Validate 9-digit routing number using weighted checksum before any EFT.', java: 'RoutingValidator.validateRoutingNumber()' },
  { id: 'R-PMT-008', name: 'Prenote verification', domain: 'Risk', source: 'PMTEFT.TAL:ADD^PAYMENT^TO^BATCH', reg: 'NACHA Prenote Rules', english: 'New accounts must complete zero-dollar prenote before receiving live payments.', java: 'PrenoteVerificationService.checkPrenote()' },
  { id: 'R-PMT-009', name: 'Dual approval release', domain: 'Authorization', source: 'PMTEFT.TAL:RELEASE^BATCH', reg: 'SOX — Segregation of Duties', english: 'EFT batches need 2 different approvers. Same person cannot approve twice.', java: 'BatchReleaseService.releaseBatch()' },
  { id: 'R-PMT-010', name: 'ACH return suspension', domain: 'Risk', source: 'PMTEFT.TAL:PROCESS^RETURN', reg: 'NACHA Return Threshold', english: '3+ ACH returns = suspend EFT for that account, route to check.', java: 'AchReturnService.processReturn()' },
  { id: 'R-FNOL-001', name: 'Duplicate FNOL detection', domain: 'Fraud', source: 'FNOLPROC.TAL:CHECK^DUPLICATE', reg: 'NCCI Standards', english: 'Same SSN + same injury date + same employer = duplicate claim.', java: 'FnolDuplicateService.checkDuplicate()' },
  { id: 'R-FNOL-002', name: 'Injury classification', domain: 'Risk', source: 'FNOLPROC.TAL:CLASSIFY^INJURY', reg: 'OSHA 29 CFR 1904', english: 'Classify injury: Medical Only, Lost Time, Permanent, Occupational, Fatality.', java: 'InjuryClassificationService.classify()' },
  { id: 'R-FNOL-003', name: 'Adjuster auto-assignment', domain: 'Operations', source: 'FNOLPROC.TAL:FIND^ADJUSTER', reg: 'NAIIA Standards', english: 'Assign adjuster with lowest caseload in matching jurisdiction and team.', java: 'AdjusterAssignmentService.findAdjuster()' },
  { id: 'R-FNOL-004', name: 'Jurisdiction reserve adjustment', domain: 'Risk', source: 'FNOLPROC.TAL:GET^INITIAL^RESERVE', reg: 'Actuarial Standards', english: 'CA/NY/FL get +25% reserve. IL/PA/NJ get +20%. Based on state cost indices.', java: 'ReserveCalculationService.getInitialReserve()' },
];

/* ── Domain distribution ── */
const DOMAINS = [
  { name: 'Payments', count: 412, color: '#185FA5' },
  { name: 'Claims', count: 347, color: '#534AB7' },
  { name: 'Fraud', count: 298, color: '#993C1D' },
  { name: 'Compliance', count: 243, color: '#085041' },
  { name: 'Workers Comp', count: 189, color: '#854F0B' },
  { name: 'Reserve', count: 158, color: '#5C6BC0' },
  { name: 'Legal', count: 134, color: '#455A64' },
  { name: 'Settlement', count: 98, color: '#0F6E56' },
  { name: 'Operations', count: 73, color: '#6D4C41' },
  { name: 'Pharmacy', count: 48, color: '#7B1FA2' },
];
const MAX_DOMAIN = Math.max(...DOMAINS.map(d => d.count));

/* ── DLT mini badges ── */
function DLTRow() {
  return (
    <div className="flex gap-2 pt-2">
      {['D+', 'L+', 'T+'].map(l => (
        <Badge key={l} variant="outline" className="border-success/30 bg-success/10 text-[10px] text-success">
          <Check className="mr-0.5 h-2.5 w-2.5" />{l}
        </Badge>
      ))}
    </div>
  );
}

/* ── Dossier card for critical rules ── */
function RuleDossierCard({ rule }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <Card className="h-full">
        <CardContent className="p-5">
          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <span className="font-mono text-xs text-muted-foreground">{rule.id}</span>
              <h3 className="text-sm font-bold">{rule.name}</h3>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Badge variant="outline" className="text-[10px]">{rule.domain}</Badge>
              <Badge variant="outline" className="border-red-900/30 bg-red-900/10 text-[10px] text-red-800">CRITICAL</Badge>
            </div>
          </div>

          {/* English description */}
          <p className="mb-3 text-[13px] italic leading-relaxed text-muted-foreground">
            "{rule.english}"
          </p>

          {/* Source / Reg / Java */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">{rule.source}</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{rule.reg}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-success">☕</span>
              <span className="font-mono text-success">{rule.java}</span>
            </div>
          </div>

          <DLTRow />
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   Discovery Tab
   ═══════════════════════════════════════════ */
export function DiscoveryTab() {
  const [selectedTier, setSelectedTier] = useState(0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight">
          2,000 Rules by Risk
        </h1>
        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Click any tier to see rules. Critical rules have full regulatory references from real TAL source code.
        </p>
      </motion.div>

      {/* ── Criticality Pyramid ── */}
      <Card className="mb-8">
        <CardContent className="flex flex-col items-center gap-1 p-8">
          {TIERS.map((tier, i) => (
            <motion.button
              key={tier.label}
              onClick={() => setSelectedTier(i)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                'flex items-center justify-between rounded-lg border px-5 py-3 transition-all',
                tier.bg, tier.border, tier.text,
                selectedTier === i && 'ring-2 ring-accent/40 ring-offset-2 ring-offset-background'
              )}
              style={{ width: tier.width }}
            >
              <span className="text-xs font-bold uppercase tracking-widest">{tier.label}</span>
              <span className="font-serif text-lg font-extrabold">{tier.count.toLocaleString()}</span>
            </motion.button>
          ))}
        </CardContent>
      </Card>

      {/* ── Tier Detail ── */}
      <AnimatePresence mode="wait">
        {selectedTier === 0 ? (
          <motion.div
            key="critical"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8"
          >
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="outline" className={TIERS[0].badgeCls}>CRITICAL</Badge>
              <span className="text-sm text-muted-foreground">14 rules — full dossier cards</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {CRITICAL_RULES.map(r => <RuleDossierCard key={r.id} rule={r} />)}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`tier-${selectedTier}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8"
          >
            <Card className="border-accent/20 bg-accent/5">
              <CardContent className="p-6">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className={TIERS[selectedTier].badgeCls}>
                    {TIERS[selectedTier].label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">{TIERS[selectedTier].count.toLocaleString()}</span>{' '}
                  {TIERS[selectedTier].label.toLowerCase()} rules across 10 domains.
                  Click any domain bar below to filter.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Domain Distribution ── */}
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Domain Distribution
          </h2>
          <div className="space-y-3">
            {DOMAINS.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3"
              >
                <span className="w-24 shrink-0 text-right text-xs font-medium text-muted-foreground">
                  {d.name}
                </span>
                <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded"
                    style={{ backgroundColor: d.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.count / MAX_DOMAIN) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-xs font-bold">
                  {d.count}
                </span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
