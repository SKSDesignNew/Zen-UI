import { motion } from 'framer-motion';
import { Sun, Snowflake } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
      {[
        { k: 'warm', label: 'Executive', Icon: Sun },
        { k: 'frost', label: 'Frost', Icon: Snowflake },
      ].map(({ k, label, Icon }) => {
        const active = theme === k;
        return (
          <button
            key={k}
            onClick={() => setTheme(k)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {active && (
              <motion.div
                layoutId="theme-toggle-active"
                className="absolute inset-0 rounded-md bg-card shadow-sm"
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}
            <Icon className="relative h-3.5 w-3.5" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
