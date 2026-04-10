import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, FastForward, Check, Loader2, Circle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* ── real TAL filenames ── */
const SCAN_FILES = [
  { name: 'PMTPROC.tal', lines: 195, procs: 5, rules: 3, xrefs: 2 },
  { name: 'PMTAPPR.tal', lines: 520, procs: 8, rules: 6, xrefs: 1 },
  { name: 'PMTEFT.tal', lines: 540, procs: 12, rules: 4, xrefs: 1 },
  { name: 'FNOLPROC.tal', lines: 390, procs: 9, rules: 4, xrefs: 1 },
  { name: 'CLMSETUP.tal', lines: 410, procs: 7, rules: 3, xrefs: 2 },
  { name: 'CLMPROC.tal', lines: 130, procs: 4, rules: 2, xrefs: 1 },
  { name: 'CLMDIARY.tal', lines: 420, procs: 6, rules: 2, xrefs: 0 },
  { name: 'MEDBILL.tal', lines: 460, procs: 8, rules: 5, xrefs: 2 },
  { name: 'RSVRCALC.tal', lines: 470, procs: 7, rules: 4, xrefs: 1 },
  { name: 'RSVRHIST.tal', lines: 480, procs: 6, rules: 3, xrefs: 0 },
  { name: 'WCBENCALC.tal', lines: 550, procs: 9, rules: 5, xrefs: 1 },
  { name: 'WCCOMP.tal', lines: 580, procs: 11, rules: 6, xrefs: 2 },
  { name: 'WCEXMOD.tal', lines: 450, procs: 7, rules: 4, xrefs: 1 },
  { name: 'WCJURIS.tal', lines: 530, procs: 10, rules: 7, xrefs: 3 },
  { name: 'WCLEGAL.tal', lines: 500, procs: 8, rules: 4, xrefs: 1 },
  { name: 'WCPHARM.tal', lines: 520, procs: 9, rules: 5, xrefs: 2 },
  { name: 'WCPPDRATE.tal', lines: 540, procs: 8, rules: 4, xrefs: 1 },
  { name: 'WCSIU.tal', lines: 490, procs: 7, rules: 5, xrefs: 2 },
  { name: 'WCWAGE.tal', lines: 500, procs: 8, rules: 4, xrefs: 1 },
  { name: 'POLMAINT.tal', lines: 170, procs: 4, rules: 2, xrefs: 0 },
];

const FINAL = { lines: 1_000_000, rules: 2_000, deps: 4_832, xrefs: 312 };
const SCAN_MS = 8000;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function fmt(n) {
  return n.toLocaleString();
}

/* ── Counter Card ── */
function CounterCard({ value, label }) {
  return (
    <Card className="flex-1">
      <CardContent className="p-4 text-center">
        <div className="font-serif text-3xl font-extrabold tracking-tight">{fmt(value)}</div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

/* ── File Row ── */
function FileRow({ file, status }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 border-b border-border/40 px-3 py-2 font-mono text-xs"
    >
      {status === 'done' && <Check className="h-3.5 w-3.5 shrink-0 text-success" />}
      {status === 'scanning' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />}
      {status === 'pending' && <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
      <span className={cn('font-semibold', status === 'scanning' ? 'text-accent' : status === 'done' ? 'text-foreground' : 'text-muted-foreground')}>
        {file.name}
      </span>
      {status === 'done' && (
        <span className="ml-auto flex gap-3 text-muted-foreground">
          <span>{file.lines} ln</span>
          <span>{file.procs} PROCs</span>
          <span>{file.rules} rules</span>
          {file.xrefs > 0 && <span>{file.xrefs} XREFs</span>}
        </span>
      )}
      {status === 'scanning' && <span className="ml-auto text-accent">scanning…</span>}
      {status === 'pending' && <span className="ml-auto text-muted-foreground/40">pending</span>}
    </motion.div>
  );
}

/* ── DLT Badge ── */
function DLTBadge({ label, desc }) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
        <Check className="mr-1 h-3 w-3" />{label}
      </Badge>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Use Case Scan Tab
   ═══════════════════════════════════════════ */
export function UseCaseTab() {
  const [phase, setPhase] = useState('ready'); // ready | scanning | complete
  const [progress, setProgress] = useState(0);
  const [counters, setCounters] = useState({ lines: 0, rules: 0, deps: 0, xrefs: 0 });
  const [completedIdx, setCompletedIdx] = useState(-1); // index of last completed file
  const rafRef = useRef(null);
  const startRef = useRef(0);

  const skip = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setCounters(FINAL);
    setProgress(100);
    setCompletedIdx(SCAN_FILES.length - 1);
    setPhase('complete');
  }, []);

  const runScan = useCallback(() => {
    setPhase('scanning');
    setProgress(0);
    setCompletedIdx(-1);
    setCounters({ lines: 0, rules: 0, deps: 0, xrefs: 0 });
    startRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startRef.current;
      const raw = Math.min(elapsed / SCAN_MS, 1);
      const t = easeInOutCubic(raw);

      setCounters({
        lines: Math.round(t * FINAL.lines),
        rules: Math.round(t * FINAL.rules),
        deps: Math.round(t * FINAL.deps),
        xrefs: Math.round(t * FINAL.xrefs),
      });
      setProgress(Math.round(t * 100));
      setCompletedIdx(Math.min(Math.floor(t * SCAN_FILES.length), SCAN_FILES.length - 1));

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCounters(FINAL);
        setProgress(100);
        setCompletedIdx(SCAN_FILES.length - 1);
        setPhase('complete');
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Determine file statuses
  const getFileStatus = (idx) => {
    if (phase === 'ready') return 'pending';
    if (idx < completedIdx) return 'done';
    if (idx === completedIdx && phase === 'scanning') return 'scanning';
    if (idx === completedIdx && phase === 'complete') return 'done';
    return 'pending';
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mb-8 border-primary/20 bg-primary">
          <CardContent className="p-8">
            <h1 className="mb-2 font-serif text-3xl font-bold tracking-tight text-primary-foreground">
              THE CODEBASE
            </h1>
            <p className="text-base font-medium text-primary-foreground/80">
              Workers' Compensation TPA — HPE NonStop (TAL)
            </p>
            <p className="mt-1 text-sm text-primary-foreground/60">
              Source: 1,200 TAL files across 20 Pathway server classes
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Progress bar */}
      {phase !== 'ready' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {phase === 'scanning'
                ? `Scanning: ${SCAN_FILES[Math.min(completedIdx, SCAN_FILES.length - 1)]?.name || '...'}`
                : 'Scan complete'}
            </span>
            <span className="font-mono font-bold">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-accent"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </motion.div>
      )}

      {/* Counter cards */}
      <div className="mb-6 flex gap-3">
        <CounterCard value={counters.lines} label="Lines" />
        <CounterCard value={counters.rules} label="Rules" />
        <CounterCard value={counters.deps} label="Deps" />
        <CounterCard value={counters.xrefs} label="XREFs" />
      </div>

      {/* File feed */}
      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="border-b border-border/40 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Live File Feed
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {SCAN_FILES.map((f, i) => (
              <FileRow key={f.name} file={f} status={getFileStatus(i)} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="mb-8 flex gap-3">
        {phase === 'ready' && (
          <Button onClick={runScan} size="lg" className="gap-2">
            <Play className="h-4 w-4" /> Run Scan
          </Button>
        )}
        {phase === 'scanning' && (
          <Button onClick={skip} variant="outline" size="lg" className="gap-2">
            <FastForward className="h-4 w-4" /> Skip to Results
          </Button>
        )}
        {phase === 'complete' && (
          <Button onClick={runScan} variant="outline" size="lg" className="gap-2">
            <Play className="h-4 w-4" /> Run Again
          </Button>
        )}
      </div>

      {/* Completion banner */}
      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-success" />
                  <span className="text-lg font-bold">Scan Complete</span>
                </div>
                <div className="mb-4 font-mono text-sm text-muted-foreground">
                  {fmt(FINAL.lines)} lines | {fmt(FINAL.rules)} rules | {fmt(FINAL.deps)} deps | {fmt(FINAL.xrefs)} XREFs
                </div>
                <div className="flex flex-col gap-2">
                  <DLTBadge label="D+" desc="Deterministic — identical output every run" />
                  <DLTBadge label="L+" desc="Source-linked — every rule traced to TAL file:line" />
                  <DLTBadge label="T+" desc="SHA-audited — tamper-proof hash chain" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
