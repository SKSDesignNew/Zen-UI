// Style definitions and layout configs for the Governed Rules Repository graph.

export const DOMAIN_COLORS = {
  Authorization: '#3B82F6',
  Fraud: '#EF4444',
  Credit: '#F97316',
  Pricing: '#EAB308',
  Compliance: '#8B5CF6',
  Settlement: '#14B8A6',
  Reporting: '#06B6D4',
  Risk: '#F59E0B',
  Operations: '#22C55E',
  Security: '#EC4899',
};

export const CRIT_COLORS = {
  HIGH: '#DC2626',
  MEDIUM: '#D97706',
  LOW: '#6B7280',
};

export const CRIT_SIZE = {
  HIGH: 18,
  MEDIUM: 14,
  LOW: 10,
};

// Compound (domain) node size grows with rule count. Authorization/Security
// (370+) should look visibly larger than Risk (145), without overflowing the
// canvas — capped so the layout fits in the available height.
export function domainNodeDiameter(count) {
  return Math.min(140, 78 + Math.sqrt(count) * 3.4);
}

export function buildStylesheet() {
  return [
    // Domain compound nodes — explicit width/height so layout positions them
    // even when they have no children yet.
    {
      selector: 'node[type="domain"]',
      style: {
        'background-color': 'data(color)',
        'background-opacity': 0.12,
        'border-color': 'data(color)',
        'border-width': 2,
        'border-opacity': 0.85,
        shape: 'round-rectangle',
        padding: '24px',
        label: 'data(label)',
        color: 'data(color)',
        'font-family': 'DM Sans, Inter, sans-serif',
        'font-size': 14,
        'font-weight': 700,
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': -8,
        'text-outline-color': '#0a0e1a',
        'text-outline-width': 2,
        width: 'data(diameter)',
        height: 'data(diameter)',
        'min-width': 'data(diameter)',
        'min-height': 'data(diameter)',
        'compound-sizing-wrt-labels': 'include',
      },
    },
    {
      selector: 'node[type="domain"]:selected',
      style: {
        'border-width': 4,
        'background-opacity': 0.22,
      },
    },
    // Rule nodes
    {
      selector: 'node[type="rule"]',
      style: {
        'background-color': 'data(color)',
        'border-color': '#ffffff',
        'border-width': 1.4,
        'border-opacity': 0.85,
        width: 'data(size)',
        height: 'data(size)',
        shape: 'ellipse',
        label: 'data(label)',
        color: '#e2e8f0',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': 8,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-outline-color': '#0a0e1a',
        'text-outline-width': 1,
      },
    },
    {
      selector: 'node[type="rule"]:selected',
      style: {
        'border-color': '#fbbf24',
        'border-width': 3,
      },
    },
    {
      selector: 'node[type="rule"].search-hit',
      style: {
        'background-color': '#fde047',
        'border-color': '#fbbf24',
        'border-width': 3,
        width: 24,
        height: 24,
      },
    },
    {
      selector: 'node[type="rule"].dimmed',
      style: {
        'background-opacity': 0.18,
        'border-opacity': 0.18,
        'text-opacity': 0.2,
      },
    },
    {
      selector: 'node[type="rule"].hidden',
      style: { display: 'none' },
    },
    // Cross-domain dashed edges
    {
      selector: 'edge[type="cross-domain"]',
      style: {
        width: 1.5,
        'line-color': '#94A3B8',
        'line-style': 'dashed',
        'curve-style': 'unbundled-bezier',
        'control-point-distances': 60,
        'control-point-weights': 0.5,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#94A3B8',
        opacity: 0.55,
        label: 'shared',
        color: '#94A3B8',
        'font-family': 'DM Sans, sans-serif',
        'font-size': 8,
        'text-rotation': 'autorotate',
        'text-margin-y': -6,
      },
    },
    {
      selector: 'edge[type="cross-domain"].edge-highlight',
      style: {
        width: 3,
        'line-color': '#fbbf24',
        'target-arrow-color': '#fbbf24',
        opacity: 1,
        'z-index': 999,
      },
    },
    {
      selector: '.dim',
      style: {
        'background-opacity': 0.15,
        'border-opacity': 0.15,
        'text-opacity': 0.2,
        opacity: 0.3,
      },
    },
  ];
}

// Layout: cytoscape-cola, used as the default "Compound" mode.
// Cola needs randomize:true when there are no edges (10 isolated compounds)
// otherwise it leaves them stacked at the origin.
export const compoundLayout = {
  name: 'cola',
  nodeSpacing: 12,
  edgeLength: 140,
  animate: true,
  randomize: true,
  maxSimulationTime: 1500,
  fit: true,
  padding: 60,
  centerGraph: true,
  nodeDimensionsIncludeLabels: true,
};

// Initial layout for the empty graph: respect the preset positions baked into
// each domain element by useGraphData (a circle of 10 around the origin).
// Padding has to be large enough that the biggest circle's full diameter fits
// inside the viewport — otherwise the top/bottom circles get clipped.
export const initialDomainLayout = {
  name: 'preset',
  fit: true,
  padding: 100,
  animate: false,
};

// Tight circle layout used INSIDE a compound when expanding it.
export const compoundChildLayout = {
  name: 'concentric',
  concentric: () => 1,
  levelWidth: () => 1,
  minNodeSpacing: 6,
  fit: false,
  animate: true,
  animationDuration: 500,
  padding: 12,
};

// Concentric layout: domains in inner circle, rules in outer.
export const concentricLayout = {
  name: 'concentric',
  concentric: (node) => (node.data('type') === 'domain' ? 100 : 1),
  levelWidth: () => 1,
  minNodeSpacing: 8,
  animate: true,
  animationDuration: 600,
  fit: true,
  padding: 40,
};

// Grid layout: sorted by domain then criticality desc.
export const gridLayout = {
  name: 'grid',
  fit: true,
  padding: 30,
  animate: true,
  animationDuration: 500,
  avoidOverlap: true,
  condense: false,
  sort: (a, b) => {
    const da = a.data('domain') || '';
    const db = b.data('domain') || '';
    if (da !== db) return da.localeCompare(db);
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const ca = order[a.data('criticality')] ?? 3;
    const cb = order[b.data('criticality')] ?? 3;
    return ca - cb;
  },
};
