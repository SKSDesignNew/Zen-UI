import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, FileCode, Clock, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';

const TAL_FILES = [
  {
    name: 'AUTHPROC.TAL', lines: '4,200', age: '1987',
    desc: 'Core authorization processor — card validation, BIN lookup, status checks. Modified 847 times across 37 years.',
    code: `PROC CHECK^CARD^STATUS(CARD^NUM, CARD^STATUS, RESP^CODE);
BEGIN
  INT .EXT CARD^REC[0:127];
  STRING .EXT CARD^STATUS^FLAG[0:1];

  CALL READ^CARD^MASTER(CARD^NUM, CARD^REC);
  CARD^STATUS^FLAG := CARD^REC[42] FOR 2;

  IF CARD^STATUS^FLAG = "00" THEN  ! Active
    CARD^STATUS := 1
  ELSE IF CARD^STATUS^FLAG = "41" THEN  ! Lost
    BEGIN
      CARD^STATUS := 0;
      RESP^CODE := "41";
      CALL LOG^SECURITY^EVENT(CARD^NUM, "LOST^CARD^ATTEMPT");
    END
  ELSE IF CARD^STATUS^FLAG = "43" THEN  ! Stolen
    BEGIN
      CARD^STATUS := 0;
      RESP^CODE := "43";
      CALL LOG^SECURITY^EVENT(CARD^NUM, "STOLEN^CARD^ATTEMPT");
      CALL NOTIFY^FRAUD^TEAM(CARD^NUM);
    END;
END;`,
  },
  {
    name: 'FRAUDCHK.TAL', lines: '6,800', age: '1994',
    desc: 'Fraud detection engine — velocity checks, geo-risk, composite scoring. Contains 23 nested IF blocks with undocumented business rules.',
    code: `PROC CHECK^VELOCITY^LIMITS(ACCT^NUM, TXN^AMT, TXN^COUNT^24HR,
                           VELOCITY^LIMIT, RISK^FLAG);
BEGIN
  INT  ALERT^LEVEL;
  FIXED DAILY^TOTAL;

  CALL GET^24HR^ACTIVITY(ACCT^NUM, TXN^COUNT^24HR, DAILY^TOTAL);

  IF TXN^COUNT^24HR > VELOCITY^LIMIT THEN
    BEGIN
      ALERT^LEVEL := 3;  ! HIGH
      RISK^FLAG := 1;
      CALL FLAG^SUSPICIOUS^ACTIVITY(ACCT^NUM, ALERT^LEVEL);
      CALL ROUTE^TO^MANUAL^REVIEW(ACCT^NUM, TXN^AMT,
                                   "VELOCITY^EXCEEDED");
    END;

  ! Legacy rule: if single txn > 50% of daily limit, flag
  ! Added by J.Morrison 1998 — no ticket reference
  IF TXN^AMT > (DAILY^TOTAL / 2) THEN
    CALL FLAG^LARGE^SINGLE^TXN(ACCT^NUM, TXN^AMT);
END;`,
  },
  {
    name: 'FEECALC.TAL', lines: '3,100', age: '1991',
    desc: 'Fee computation — interchange, FX margins, overlimit fees. 14 different fee schedules based on card type, MCC, and region.',
    code: `PROC CALC^INTERCHANGE^FEE(TXN^AMT, MCC^CODE, CARD^TYPE,
                          REGION^CODE, FEE^AMOUNT);
BEGIN
  FIXED BASE^RATE;
  FIXED REGULATED^RATE;

  ! Durbin Amendment regulated rates (added 2011)
  IF CARD^TYPE = "REGULATED^DEBIT" THEN
    BEGIN
      REGULATED^RATE := 0.0005F + 21;
      FEE^AMOUNT := TXN^AMT * REGULATED^RATE;
      IF FEE^AMOUNT > 21 THEN FEE^AMOUNT := 21;
    END
  ELSE
    BEGIN
      CALL LOOKUP^MCC^TIER(MCC^CODE, MCC^TABLE, BASE^RATE);
      FEE^AMOUNT := TXN^AMT * BASE^RATE;

      IF REGION^CODE <> "US" THEN
        FEE^AMOUNT := FEE^AMOUNT + (TXN^AMT * 0.015F);
    END;
END;`,
  },
];

const STATS = [
  { n: '9M+', l: 'Lines of TAL' },
  { n: '800+', l: 'Source Files' },
  { n: '37', l: 'Years of Patches' },
  { n: '4,200+', l: 'Business Rules' },
  { n: '23', l: 'Nested IF Depth' },
  { n: '3', l: 'Engineers Left' },
];

const PAIN_POINTS = [
  { Icon: AlertCircle, title: 'Hidden, Ungoverned Rules', desc: 'Critical decision logic buried across 800+ files. No single source of truth.' },
  { Icon: AlertCircle, title: 'Zero Margin for Error', desc: 'A single missed edge case in conditional jump logic translates to millions at Visa scale.' },
  { Icon: Clock, title: '6-Month Change Cycles', desc: 'Changing one velocity threshold requires 6 months of manual testing because nobody can trace downstream impact.' },
  { Icon: Brain, title: 'The Intelligence Paradox', desc: 'Frontier AI offers unprecedented reasoning — but raw output shows +21% issue density without governance.' },
];

export function LegacyTab() {
  const [idx, setIdx] = useState(0);
  const f = TAL_FILES[idx];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Badge variant="accent" className="mb-3">The Starting Point</Badge>
        <h2 className="mb-2 font-serif text-4xl font-bold tracking-tight">
          The Legacy Reality: 9 Million Lines of TAL
        </h2>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
          The bedrock of global financial infrastructure. Decades of business logic encoded in Tandem Application Language across NonStop systems. Every rule, every edge case, every regulatory patch — buried in code only a shrinking number of engineers can read.
        </p>
      </motion.div>

      {/* Stats grid */}
      <div className="mb-10 grid grid-cols-3 gap-3 md:grid-cols-6">
        {STATS.map((s, i) => (
          <motion.div
            key={s.l}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="flex flex-col items-center p-4">
                <div className="font-serif text-2xl font-bold">{s.n}</div>
                <div className="mt-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Code explorer */}
      <div className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-accent">
          Real TAL Source Code — Credit Card Authorization System
        </h3>
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          {TAL_FILES.map((tf, i) => (
            <button key={tf.name} onClick={() => setIdx(i)}
              className={cn(
                'rounded-lg border p-3 text-left transition-all',
                idx === i ? 'border-accent bg-accent/5 shadow-md' : 'border-border bg-card hover:border-accent/50'
              )}
            >
              <div className={cn('font-mono text-xs font-bold', idx === i ? 'text-accent' : 'text-foreground')}>
                <FileCode className="mr-1 inline h-3 w-3" />
                {tf.name}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {tf.lines} lines · Since {tf.age}
              </div>
            </button>
          ))}
        </div>
        <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 text-sm text-muted-foreground">{f.desc}</p>
              <CodeBlock code={f.code} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Pain points */}
      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2">
        {PAIN_POINTS.map((p) => (
          <Card key={p.title}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <p.Icon className="h-5 w-5 text-destructive" />
                <CardTitle className="text-base">{p.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="leading-relaxed">{p.desc}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Core question */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-8 text-center">
          <div className="mb-2 font-serif text-xl font-semibold text-accent">The Core Question</div>
          <p className="text-lg leading-relaxed text-primary-foreground/80">
            How do you apply a{' '}
            <span className="font-bold text-accent">probabilistic machine</span>
            {' '}to a problem that demands a single,{' '}
            <span className="font-bold text-primary-foreground">deterministic, correct solution</span>
            {' '}— every time?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
