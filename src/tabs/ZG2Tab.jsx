import { useMemo, useRef } from 'react';
import { GraphView } from '@/components/GraphView';
import { genScaleRules } from '@/lib/scale-data';

/**
 * Z+G2 — full-bleed dedicated view of the Cytoscape GraphView.
 * Same component the Rules tab embeds, but rendered standalone with no
 * Table/Graph toggle, no stat cards, and the entire viewport for the canvas.
 */
export function ZG2Tab() {
  const allRef = useRef(null);
  if (!allRef.current) allRef.current = genScaleRules();

  const handleSelect = useMemo(
    () => (ruleId) => {
      // eslint-disable-next-line no-console
      console.log('[Z+G2] selected rule:', ruleId);
    },
    []
  );

  return (
    <div className="h-[calc(100vh-120px)] w-full p-3">
      <GraphView rules={allRef.current} onRuleSelect={handleSelect} />
    </div>
  );
}
