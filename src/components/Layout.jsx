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
  { k: 'zg2', label: 'Z+Lens', Icon: Network },
  { k: 'graph', label: 'Z+Lens2', Icon: CircleDot },
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

      {/* Nav tabs — thick underline with gradient bleed */}
      <nav className="tab-nav flex items-center overflow-x-auto border-b-2 border-border/30 bg-card px-5 backdrop-blur-lg">
        {NAV_ITEMS.map(({ k, label, Icon }) => {
          const active = view === k;
          const showDivider = k === 'sandbox' || k === 'zresults';
          return (
            <div key={k} className="flex items-center">
              <button
                onClick={() => setView(k)}
                className={cn(
                  'group -mb-[2px] flex items-center gap-1.5 whitespace-nowrap border-b-[3px] px-4 py-3 text-xs transition-all duration-200',
                  active
                    ? 'border-accent bg-gradient-to-t from-accent/[0.06] to-transparent font-semibold text-accent'
                    : 'border-transparent font-normal text-muted-foreground hover:border-border hover:bg-gradient-to-t hover:from-border/10 hover:to-transparent hover:text-foreground'
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
                <div className="mx-1.5 h-5 w-px shrink-0 self-center bg-border/50" />
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
