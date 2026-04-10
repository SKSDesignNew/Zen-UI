import { useMemo } from 'react';
import { DOMAIN_COLORS, CRIT_COLORS, CRIT_SIZE, domainNodeDiameter } from './cytoscape.config';

/**
 * Transform the rules prop into the structures GraphView needs:
 *   - domainElements: 10 compound parent nodes (always mounted)
 *   - ruleElements: per-domain map of rule nodes (mounted lazily on first expand)
 *   - crossDomainEdges: dashed edges from rules with secondaryDomain → that domain
 *   - countsByDomain: live counts per domain (used for compound node labels)
 *
 * Each rule from the parent uses the canonical field names:
 *   ruleId, ruleName, domain, criticality, sourceFile, lineStart, lineEnd, secondaryDomain?
 */
export function useGraphData(rules) {
  return useMemo(() => {
    // Live counts (filters apply later — these are the unfiltered totals)
    const countsByDomain = {};
    for (const r of rules) {
      countsByDomain[r.domain] = (countsByDomain[r.domain] || 0) + 1;
    }

    // 10 compound domain nodes — pre-positioned in a circle so cytoscape can
    // render them even before any rules are mounted (empty compound parents
    // otherwise collapse to a single point). Radius is tuned so the
    // outermost circle edges (centers ± diameter/2) fit within the viewport
    // after fit() is called with the layout's padding.
    const domainIds = Object.keys(DOMAIN_COLORS);
    const N = domainIds.length;
    const RADIUS = 290;
    const domainElements = domainIds.map((d, i) => {
      const count = countsByDomain[d] || 0;
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      return {
        group: 'nodes',
        data: {
          id: `dom:${d}`,
          type: 'domain',
          domain: d,
          color: DOMAIN_COLORS[d],
          count,
          label: `${d}  ${count}`,
          diameter: domainNodeDiameter(count),
        },
        position: { x: Math.cos(angle) * RADIUS, y: Math.sin(angle) * RADIUS },
      };
    });

    // Rule nodes bucketed by domain (for lazy add on first expand)
    const ruleElementsByDomain = {};
    for (const d of domainIds) ruleElementsByDomain[d] = [];

    // Cross-domain edges from rules with a secondaryDomain
    const crossDomainEdges = [];

    for (const r of rules) {
      const ruleNode = {
        group: 'nodes',
        data: {
          id: r.ruleId,
          type: 'rule',
          parent: `dom:${r.domain}`,
          domain: r.domain,
          ruleName: r.ruleName,
          criticality: r.criticality,
          sourceFile: r.sourceFile,
          lineStart: r.lineStart,
          lineEnd: r.lineEnd,
          color: CRIT_COLORS[r.criticality] || '#6B7280',
          size: CRIT_SIZE[r.criticality] || 10,
          label: r.ruleId,
          ...(r.secondaryDomain ? { secondaryDomain: r.secondaryDomain } : {}),
        },
      };
      if (ruleElementsByDomain[r.domain]) {
        ruleElementsByDomain[r.domain].push(ruleNode);
      }
      if (r.secondaryDomain && DOMAIN_COLORS[r.secondaryDomain]) {
        crossDomainEdges.push({
          group: 'edges',
          data: {
            id: `xd:${r.ruleId}->${r.secondaryDomain}`,
            type: 'cross-domain',
            source: r.ruleId,
            target: `dom:${r.secondaryDomain}`,
          },
        });
      }
    }

    return { domainElements, ruleElementsByDomain, crossDomainEdges, countsByDomain };
  }, [rules]);
}
