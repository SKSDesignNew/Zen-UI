import { cn } from '@/lib/utils';

export function CodeBlock({ code, className }) {
  return (
    <pre className={cn('rounded-lg bg-primary text-primary-foreground/90 p-4 text-xs leading-relaxed overflow-x-auto font-mono', className)}>
      <code>{code}</code>
    </pre>
  );
}
