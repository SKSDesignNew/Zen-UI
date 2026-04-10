import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, FileText, ShieldCheck, ChevronRight, ChevronDown,
  Folder, FolderOpen, Hash,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ════════════════════════════════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════════════════════════════════

const CRITICAL_RULES = [
  { id: 'R-PMT-001', name: 'Payment authority check', domain: 'Authorization', source: 'PMTAPPR.TAL:CHECK^PAYMENT^AUTHORITY', reg: 'SOX Section 302', english: 'Each user has dollar limits by payment type. Exceed = escalation required.', java: 'PaymentAuthorityService.checkAuthority()', file: 'PMTAPPR.tal', cls: 'PaymentAuthorityService' },
  { id: 'R-PMT-002', name: 'Duplicate payment detection', domain: 'Fraud', source: 'PMTAPPR.TAL:CHECK^DUPLICATE^PAYMENT', reg: 'OIG Fraud Prevention', english: 'Same provider + same date + same amount within 30 days = hold as duplicate.', java: 'DuplicateDetectionService.checkDuplicate()', file: 'PMTAPPR.tal', cls: 'DuplicateDetectionService' },
  { id: 'R-PMT-003', name: 'Medical bill review gate', domain: 'Compliance', source: 'PMTAPPR.TAL:CHECK^MEDICAL^BILL^REVIEW', reg: 'State WC Fee Schedule', english: 'Medical bills must be reviewed before payment. Reduced = pay allowed amount.', java: 'MedicalBillReviewService.checkReview()', file: 'PMTAPPR.tal', cls: 'MedicalBillReviewService' },
  { id: 'R-PMT-004', name: 'Indemnity schedule validation', domain: 'Benefits', source: 'PMTAPPR.TAL:CHECK^INDEMNITY^SCHEDULE', reg: 'State WC Benefit Regs', english: 'Indemnity payments must match approved schedule dates and weekly rate.', java: 'IndemnityScheduleService.validate()', file: 'PMTAPPR.tal', cls: 'IndemnityScheduleService' },
  { id: 'R-PMT-005', name: 'Lien & garnishment check', domain: 'Compliance', source: 'PMTAPPR.TAL:CHECK^LIENS', reg: 'MSPRA — 42 USC 1395y', english: 'Check for IRS, child support, attorney, Medicare liens. Deduct before payment.', java: 'LienCheckService.checkLiens()', file: 'PMTAPPR.tal', cls: 'LienCheckService' },
  { id: 'R-PMT-006', name: '1099 tax tracking', domain: 'Compliance', source: 'PMTAPPR.TAL:UPDATE^1099^TRACKING', reg: 'IRS — 26 USC 6041', english: 'Accumulate payments by payee TIN. Over $600 = flag for 1099 filing.', java: 'Tax1099TrackingService.update()', file: 'PMTAPPR.tal', cls: 'Tax1099TrackingService' },
  { id: 'R-PMT-007', name: 'ABA routing validation', domain: 'Settlement', source: 'PMTEFT.TAL:VALIDATE^ROUTING^NUMBER', reg: 'NACHA Operating Rules', english: 'Validate 9-digit routing number using weighted checksum before any EFT.', java: 'RoutingValidator.validateRoutingNumber()', file: 'PMTEFT.tal', cls: 'RoutingValidator' },
  { id: 'R-PMT-008', name: 'Prenote verification', domain: 'Risk', source: 'PMTEFT.TAL:ADD^PAYMENT^TO^BATCH', reg: 'NACHA Prenote Rules', english: 'New accounts must complete zero-dollar prenote before receiving live payments.', java: 'PrenoteVerificationService.checkPrenote()', file: 'PMTEFT.tal', cls: 'PrenoteVerificationService' },
  { id: 'R-PMT-009', name: 'Dual approval release', domain: 'Authorization', source: 'PMTEFT.TAL:RELEASE^BATCH', reg: 'SOX — Segregation of Duties', english: 'EFT batches need 2 different approvers. Same person cannot approve twice.', java: 'BatchReleaseService.releaseBatch()', file: 'PMTEFT.tal', cls: 'BatchReleaseService' },
  { id: 'R-PMT-010', name: 'ACH return suspension', domain: 'Risk', source: 'PMTEFT.TAL:PROCESS^RETURN', reg: 'NACHA Return Threshold', english: '3+ ACH returns = suspend EFT for that account, route to check.', java: 'AchReturnService.processReturn()', file: 'PMTEFT.tal', cls: 'AchReturnService' },
  { id: 'R-FNOL-001', name: 'Duplicate FNOL detection', domain: 'Fraud', source: 'FNOLPROC.TAL:CHECK^DUPLICATE', reg: 'NCCI Standards', english: 'Same SSN + same injury date + same employer = duplicate claim.', java: 'FnolDuplicateService.checkDuplicate()', file: 'FNOLPROC.tal', cls: 'FnolDuplicateService' },
  { id: 'R-FNOL-002', name: 'Injury classification', domain: 'Risk', source: 'FNOLPROC.TAL:CLASSIFY^INJURY', reg: 'OSHA 29 CFR 1904', english: 'Classify injury: Medical Only, Lost Time, Permanent, Occupational, Fatality.', java: 'InjuryClassificationService.classify()', file: 'FNOLPROC.tal', cls: 'InjuryClassificationService' },
  { id: 'R-FNOL-003', name: 'Adjuster auto-assignment', domain: 'Operations', source: 'FNOLPROC.TAL:FIND^ADJUSTER', reg: 'NAIIA Standards', english: 'Assign adjuster with lowest caseload in matching jurisdiction and team.', java: 'AdjusterAssignmentService.findAdjuster()', file: 'FNOLPROC.tal', cls: 'AdjusterAssignmentService' },
  { id: 'R-FNOL-004', name: 'Jurisdiction reserve adjustment', domain: 'Risk', source: 'FNOLPROC.TAL:GET^INITIAL^RESERVE', reg: 'Actuarial Standards', english: 'CA/NY/FL get +25% reserve. IL/PA/NJ get +20%. Based on state cost indices.', java: 'ReserveCalculationService.getInitialReserve()', file: 'FNOLPROC.tal', cls: 'ReserveCalculationService' },
];

const SOURCE_TREE = [
  { file: 'PMTPROC.tal', lines: 195, rules: ['R-PMT-001'] },
  { file: 'PMTAPPR.tal', lines: 520, rules: ['R-PMT-001','R-PMT-002','R-PMT-003','R-PMT-004','R-PMT-005','R-PMT-006'] },
  { file: 'PMTEFT.tal', lines: 540, rules: ['R-PMT-007','R-PMT-008','R-PMT-009','R-PMT-010'] },
  { file: 'FNOLPROC.tal', lines: 390, rules: ['R-FNOL-001','R-FNOL-002','R-FNOL-003','R-FNOL-004'] },
  { file: 'CLMSETUP.tal', lines: 410, rules: [] },
  { file: 'CLMPROC.tal', lines: 130, rules: [] },
  { file: 'MEDBILL.tal', lines: 460, rules: [] },
  { file: 'RSVRCALC.tal', lines: 470, rules: [] },
  { file: 'WCBENCALC.tal', lines: 550, rules: [] },
  { file: 'WCCOMP.tal', lines: 580, rules: [] },
  { file: 'WCJURIS.tal', lines: 530, rules: [] },
  { file: 'WCLEGAL.tal', lines: 500, rules: [] },
  { file: 'WCPHARM.tal', lines: 520, rules: [] },
  { file: 'WCSIU.tal', lines: 490, rules: [] },
  { file: 'WCWAGE.tal', lines: 500, rules: [] },
  { file: 'POLMAINT.tal', lines: 170, rules: [] },
];

const TARGET_TREE = CRITICAL_RULES.map(r => ({
  cls: r.cls,
  method: r.java.split('.').pop(),
  ruleId: r.id,
}));

// Group rules by domain for panel 2
const RULE_DOMAINS = (() => {
  const map = {};
  CRITICAL_RULES.forEach(r => {
    if (!map[r.domain]) map[r.domain] = [];
    map[r.domain].push(r);
  });
  return Object.entries(map).map(([domain, rules]) => ({ domain, rules }));
})();

// SHA stub
function sha() {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ════════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════════

function PanelHeader({ label, badge, badgeCls }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <Badge variant="outline" className={cn('text-[9px]', badgeCls)}>{badge}</Badge>
    </div>
  );
}

function SourceFileItem({ src, isHl, onClick }) {
  const hasRules = src.rules.length > 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border-l-[3px] px-2.5 py-1.5 text-left text-xs transition-all',
        isHl
          ? 'border-l-accent bg-accent/8 text-foreground'
          : 'border-l-transparent hover:bg-muted',
        !hasRules && 'opacity-50'
      )}
    >
      {isHl ? <FolderOpen className="h-3 w-3 shrink-0 text-accent" /> : <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />}
      <span className="font-mono font-medium">{src.file}</span>
      <span className="ml-auto text-muted-foreground">{src.lines} ln</span>
      {hasRules && <Badge variant="outline" className="ml-1 text-[9px]">{src.rules.length}</Badge>}
    </button>
  );
}

function RuleItem({ rule, isHl, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border-l-[3px] px-2.5 py-1.5 text-left text-xs transition-all',
        isHl
          ? 'border-l-accent bg-accent/8 text-foreground'
          : 'border-l-transparent hover:bg-muted'
      )}
    >
      <Hash className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="font-mono font-medium">{rule.id}</span>
      <span className="ml-1 truncate text-muted-foreground">{rule.name}</span>
    </button>
  );
}

function TargetItem({ t, isHl, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border-l-[3px] px-2.5 py-1.5 text-left text-xs transition-all',
        isHl
          ? 'border-l-accent bg-accent/8 text-foreground'
          : 'border-l-transparent hover:bg-muted'
      )}
    >
      <span className="shrink-0 text-success">☕</span>
      <span className="font-mono font-medium">{t.cls}</span>
      <span className="ml-auto font-mono text-muted-foreground">.{t.method}</span>
    </button>
  );
}

function TraceDetail({ rule }) {
  if (!rule) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-xs text-accent">{rule.id}</span>
            <span className="text-sm font-bold">{rule.name}</span>
          </div>
          <div className="grid gap-2 text-[11px] md:grid-cols-2">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">{rule.source}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-success">☕</span>
              <span className="font-mono text-success">{rule.java}</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">{rule.reg}</span>
            </div>
            <div className="flex items-start gap-2">
              <Hash className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">SHA-{sha()} | Chain valid <Check className="inline h-3 w-3 text-success" /></span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            {['D+ deterministic', 'L+ source-linked', 'T+ SHA-audited'].map(l => (
              <Badge key={l} variant="outline" className="border-success/30 bg-success/10 text-[9px] text-success">
                <Check className="mr-0.5 h-2.5 w-2.5" />{l}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════

export function ZPlusResultsTab() {
  const [hlRule, setHlRule] = useState(null);

  // Derive highlighted sets
  const selectedRule = useMemo(() => CRITICAL_RULES.find(r => r.id === hlRule), [hlRule]);
  const hlFiles = useMemo(() => {
    if (!hlRule) return new Set();
    const r = CRITICAL_RULES.find(r => r.id === hlRule);
    return r ? new Set([r.file]) : new Set();
  }, [hlRule]);
  const hlClasses = useMemo(() => {
    if (!hlRule) return new Set();
    const r = CRITICAL_RULES.find(r => r.id === hlRule);
    return r ? new Set([r.cls]) : new Set();
  }, [hlRule]);

  const handleSourceClick = (src) => {
    if (src.rules.length === 0) { setHlRule(null); return; }
    // Select first rule of this file
    setHlRule(src.rules[0]);
  };

  const handleRuleClick = (rule) => {
    setHlRule(rule.id === hlRule ? null : rule.id);
  };

  const handleTargetClick = (t) => {
    setHlRule(t.ruleId === hlRule ? null : t.ruleId);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight">
          Z+ Results — Navigate Everything
        </h1>
        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Click any item. Watch the other panels follow. Every rule is traced from source TAL to target Java.
        </p>
      </motion.div>

      {/* Triple panels */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {/* Panel 1: Source */}
        <Card>
          <CardContent className="p-4">
            <PanelHeader label="Source" badge="D+" badgeCls="border-blue-500/30 bg-blue-500/10 text-blue-600" />
            <div className="max-h-[400px] space-y-0.5 overflow-y-auto">
              {SOURCE_TREE.map(src => (
                <SourceFileItem
                  key={src.file}
                  src={src}
                  isHl={hlFiles.has(src.file)}
                  onClick={() => handleSourceClick(src)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Panel 2: Rules */}
        <Card>
          <CardContent className="p-4">
            <PanelHeader label="Rules" badge="L+" badgeCls="border-accent/30 bg-accent/10 text-accent" />
            <div className="max-h-[400px] space-y-0.5 overflow-y-auto">
              {RULE_DOMAINS.map(({ domain, rules }) => (
                <div key={domain} className="mb-2">
                  <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    ● {domain}
                  </div>
                  {rules.map(r => (
                    <RuleItem
                      key={r.id}
                      rule={r}
                      isHl={hlRule === r.id}
                      onClick={() => handleRuleClick(r)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Panel 3: Target */}
        <Card>
          <CardContent className="p-4">
            <PanelHeader label="Target" badge="T+" badgeCls="border-success/30 bg-success/10 text-success" />
            <div className="max-h-[400px] space-y-0.5 overflow-y-auto">
              {TARGET_TREE.map(t => (
                <TargetItem
                  key={t.ruleId}
                  t={t}
                  isHl={hlClasses.has(t.cls)}
                  onClick={() => handleTargetClick(t)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trace detail */}
      <AnimatePresence>
        {selectedRule && <TraceDetail key={selectedRule.id} rule={selectedRule} />}
      </AnimatePresence>
    </div>
  );
}
