import { motion } from 'framer-motion';
import {
  Zap, AlertTriangle, Pentagon, Diamond, CircleDot, Network,
  Link2, Settings2, FlaskConical, BarChart3, Search,
} from 'lucide-react';
import { ZenLogo } from './ZenLogo';
import { ThemeToggle } from './ThemeToggle';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
  { k: 'legacy', label: 'The Challenge', Icon: Zap },
  { k: 'aitrap', label: 'The AI Trap', Icon: AlertTriangle },
  { k: 'engine', label: 'Z+ vs LLM', Icon: Settings2 },
  { k: 'pillars', label: '5 Pillars', Icon: Pentagon },
  { k: 'lineage', label: 'Z+', Icon: Link2 },
  { k: 'sandbox', label: 'Sandbox', Icon: FlaskConical },
  // --- divider after sandbox ---
  { k: 'usecase', label: 'Use Case', Icon: Diamond },
  { k: 'discovery', label: 'Discovery', Icon: Search },
  { k: 'zresults', label: 'Z+ Results', Icon: BarChart3 },
  // --- divider after zresults ---
  { k: 'graph', label: 'Z+Lens', Icon: CircleDot },
];

export function Layout({ view, setView, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-500">
      {/* Top header */}
      <header className="flex items-center justify-between border-b bg-card/80 px-6 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <ZenLogo size={40} />
          <div className="flex items-center gap-3">
            <span className="font-serif text-2xl font-bold tracking-tight">ZenPlus</span>
            <Badge variant="accent" className="text-[10px]">Enterprise Rules Platform</Badge>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="flex items-center gap-2 text-xs">
            <motion.span
              className="h-2 w-2 rounded-full bg-success"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="font-semibold text-success">LIVE</span>
          </div>
        </div>
      </header>

      {/* Nav tabs — pill style with active glow */}
      <nav className="tab-nav flex items-center gap-1 overflow-x-auto border-b bg-card/60 px-5 py-2 backdrop-blur-lg">
        {NAV_ITEMS.map(({ k, label, Icon }, i) => {
          const active = view === k;
          // Group separators: after engine (problem), after sandbox (solution), after zresults (proof)
          const showDivider = k === 'sandbox' || k === 'zresults';
          return (
            <div key={k} className="flex items-center">
              <button
                onClick={() => setView(k)}
                className={cn(
                  'group relative flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 py-2 text-[11.5px] transition-all duration-200',
                  active
                    ? 'border-accent/40 bg-accent/10 font-bold text-accent shadow-[0_0_12px_hsl(var(--accent)/0.15)]'
                    : 'border-transparent font-medium text-muted-foreground hover:border-border hover:bg-border/30 hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 transition-opacity',
                    active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                  )}
                />
                <span>{label}</span>
              </button>
              {showDivider && (
                <div className="mx-1 h-4 w-px shrink-0 self-center bg-border" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
