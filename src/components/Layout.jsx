import { motion } from 'framer-motion';
import {
  Zap, AlertTriangle, Pentagon, Diamond, List, CircleDot, Network,
  Link2, Settings2, FlaskConical, SlidersHorizontal,
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
  { k: 'usecase', label: 'Use Case', Icon: Diamond },
  { k: 'inventory', label: 'Rules', Icon: List },
  { k: 'graph', label: 'Z+Graph', Icon: CircleDot },
  { k: 'zg2', label: 'Z+G2', Icon: Network },
  { k: 'lineage', label: 'Lineage', Icon: Link2 },
  { k: 'sandbox', label: 'Sandbox', Icon: FlaskConical },
  { k: 'whatif', label: 'What-If', Icon: SlidersHorizontal },
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

      {/* Nav tabs */}
      <nav className="flex items-center gap-1 overflow-x-auto border-b bg-card/60 px-6 backdrop-blur-lg">
        {NAV_ITEMS.map(({ k, label, Icon }) => {
          const active = view === k;
          return (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cn(
                'relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3 whitespace-nowrap text-xs text-muted-foreground">
          <span>13 Rules</span>
          <span className="opacity-50">·</span>
          <span>6 Domains</span>
          <span className="opacity-50">·</span>
          <span>8 TAL Files</span>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
