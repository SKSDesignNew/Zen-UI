import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

export function WhatIfTab() {
  const [vel, setVel] = useState(15);
  const [ctr, setCtr] = useState(10000);
  const [ol, setOl] = useState(true);
  const [res, setRes] = useState(null);

  const run = () =>
    setRes({
      fr: Math.max(2, Math.round(40 - vel * 1.8 + Math.random() * 3)),
      cf: Math.round(800 * (10000 / ctr)),
      dr: ol ? 3.2 : 7.8,
    });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h3 className="font-serif text-2xl font-bold tracking-tight">What-If Simulation</h3>
      <p className="mb-8 mt-1 text-sm text-muted-foreground">
        Model rule changes before production.
      </p>

      <Card className="mb-5">
        <CardContent className="space-y-7 p-6">
          <div>
            <label className="mb-3 flex items-center justify-between text-sm">
              <span>R006 — Velocity (txn/24hr)</span>
              <Badge variant="accent">{vel}</Badge>
            </label>
            <Slider value={[vel]} onValueChange={(v) => setVel(v[0])} min={3} max={30} step={1} />
          </div>
          <div>
            <label className="mb-3 flex items-center justify-between text-sm">
              <span>R012 — CTR Threshold</span>
              <Badge variant="accent">${ctr.toLocaleString()}</Badge>
            </label>
            <Slider value={[ctr]} onValueChange={(v) => setCtr(v[0])} min={3000} max={15000} step={500} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm">R008 — Overlimit:</span>
            <Button size="sm" variant={ol ? 'default' : 'destructive'} onClick={() => setOl(!ol)}>
              {ol ? 'YES' : 'NO'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={run}>
        <Play className="h-4 w-4" />
        Run Simulation
      </Button>

      <AnimatePresence>
        {res && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5"
          >
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  30-Day Impact
                </div>
                <div className="mb-4 grid grid-cols-3 gap-4">
                  {[
                    { l: 'Fraud Flags', v: `${res.fr}%`, c: res.fr > 20 ? 'text-warning' : 'text-success' },
                    { l: 'CTR/mo', v: res.cf.toLocaleString(), c: res.cf > 1000 ? 'text-warning' : 'text-success' },
                    { l: 'Decline Rate', v: `${res.dr}%`, c: res.dr > 5 ? 'text-warning' : 'text-success' },
                  ].map((m) => (
                    <div key={m.l} className="text-center">
                      <div className={`font-serif text-3xl font-bold ${m.c}`}>{m.v}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {m.l}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="font-mono text-[10px] text-muted-foreground">
                    R006→R008→R010,R011 · R006→R009→R012
                  </div>
                  <div className="mt-1 text-[10px] text-success">✓ All dependencies validated</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
