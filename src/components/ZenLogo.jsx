import { motion } from 'framer-motion';

export function ZenLogo({ size = 40 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="relative flex items-center justify-center overflow-hidden rounded-xl bg-primary shadow-lg"
      style={{ width: size, height: size, boxShadow: '0 4px 20px hsl(var(--accent) / 0.3)' }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <motion.path
          d="M4 5h16L4 19h16"
          stroke="hsl(var(--accent))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 0 4px hsl(var(--accent) / 0.6))' }}
        />
        <motion.circle cx="20" cy="5" r="2" fill="hsl(var(--accent))"
          animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2.5, repeat: Infinity }} />
        <motion.circle cx="4" cy="19" r="2" fill="hsl(var(--accent))"
          animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-accent/10 to-transparent" />
    </motion.div>
  );
}
