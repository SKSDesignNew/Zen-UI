import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const STEPS = [
  { n: '1', t: 'Transaction Initiated', d: 'Cardholder swipes, taps, or enters card details. A raw auth request enters the pipeline.' },
  { n: '2', t: 'Validation Layer', d: 'PAN format, Luhn checksum, BIN range, card status, and expiry verified.' },
  { n: '3', t: 'Fraud & Risk', d: 'Velocity limits, geo-location risk, and composite scoring aggregated.' },
  { n: '4', t: 'Credit & Pricing', d: 'Credit limit, interchange fees, and FX margin calculated.' },
  { n: '5', t: 'Compliance Gate', d: 'AML/CTR screening, watchlist matching, suspicious activity reporting.' },
  { n: '6', t: 'Response Assembly', d: 'ISO 8583 auth response returned in milliseconds.' },
];

const STATS = [
  { n: '13', l: 'Atomic Rules' },
  { n: '6', l: 'Domains' },
  { n: '8', l: 'TAL Files' },
  { n: '15', l: 'Edges' },
];

export function UseCaseTab({ onContinue }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <motion.h1
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="mb-3 font-serif text-4xl font-bold tracking-tight"
      >
        Credit Card Authorization Pipeline
      </motion.h1>
      <p className="mb-7 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Every card swipe triggers 13 interdependent rules spanning validation, fraud, credit, pricing, and compliance — all in under 200ms.
      </p>

      <Card className="mb-8 border-accent/30 bg-accent/5">
        <CardContent className="p-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
            Why Traceability Matters
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            When a regulator asks "why was this declined?" — the answer must trace every rule, dependency, and data flow. ZenPlus extracts every rule as an atomic unit and maps the full dependency graph. The Z+Graph makes this invisible chain visible, auditable, and governable.
          </p>
        </CardContent>
      </Card>

      <div className="mb-10 grid grid-cols-1 gap-3 md:grid-cols-2">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            whileHover={{ y: -3 }}
          >
            <Card className="h-full">
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                    {s.n}
                  </div>
                  <div className="font-semibold">{s.t}</div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mb-8 flex gap-4">
        {STATS.map((s) => (
          <div key={s.l} className="flex-1 text-center">
            <div className="font-serif text-3xl font-bold">{s.n}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>

      <Button onClick={onContinue} size="lg" className="w-full">
        Explore the 5 Governance Pillars
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
