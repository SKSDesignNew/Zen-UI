import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import {
  buildStylesheet,
  compoundLayout,
  compoundChildLayout,
  concentricLayout,
  gridLayout,
  initialDomainLayout,
  CRIT_COLORS,
} from './cytoscape.config';
import { useGraphData } from './useGraphData';
import styles from './GraphView.module.css';

// Register cytoscape extensions once
let registered = false;
function ensureRegistered() {
  if (registered) return;
  cytoscape.use(cola);
  registered = true;
}

const LAYOUT_OPTIONS = [
  { k: 'compound', label: 'Compound' },
  { k: 'concentric', label: 'Concentric' },
  { k: 'grid', label: 'Grid' },
];

const CRIT_KEYS = ['HIGH', 'MEDIUM', 'LOW'];

/**
 * GraphView — Cytoscape.js graph of the Governed Rules Repository.
 * See spec in chat for behaviour.
 *
 * Props:
 *   rules:            Rule[]
 *   onRuleSelect:     (ruleId: string) => void
 *   activeSearch?:    string
 *   activeDomain?:    string
 *   activeCriticality?: 'HIGH' | 'MEDIUM' | 'LOW' | null
 */
export function GraphView({
  rules,
  onRuleSelect,
  activeSearch: searchProp,
  activeDomain: domainProp,
  activeCriticality: critProp,
}) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  const { domainElements, ruleElementsByDomain, crossDomainEdges } = useGraphData(rules);

  // Toolbar state — defaults are spec'd
  const [layoutMode, setLayoutMode] = useState('compound');
  const [search, setSearch] = useState(searchProp || '');
  const [domainFilter, setDomainFilter] = useState(domainProp || 'All');
  const [critFilters, setCritFilters] = useState({ HIGH: true, MEDIUM: true, LOW: true });
  const [tooltip, setTooltip] = useState(null);

  // Keep internal state in sync with parent's filters when they change.
  useEffect(() => { if (searchProp !== undefined) setSearch(searchProp); }, [searchProp]);
  useEffect(() => { if (domainProp !== undefined) setDomainFilter(domainProp); }, [domainProp]);
  useEffect(() => {
    if (critProp === undefined) return;
    if (critProp === null) setCritFilters({ HIGH: true, MEDIUM: true, LOW: true });
    else setCritFilters({ HIGH: critProp === 'HIGH', MEDIUM: critProp === 'MEDIUM', LOW: critProp === 'LOW' });
  }, [critProp]);

  // Track which domains have been expanded so we only mount their rule nodes
  // once (perf — never put all 2000 nodes in the DOM up front).
  const expandedRef = useRef(new Set());

  // -------- Mount cytoscape once --------
  useEffect(() => {
    ensureRegistered();
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...domainElements], // rule nodes + cross-domain edges added lazily
      style: buildStylesheet(),
      layout: initialDomainLayout, // concentric circle of 10 compound domains
      wheelSensitivity: 0.25,
      minZoom: 0.15,
      maxZoom: 3,
      boxSelectionEnabled: false,
    });
    // Fit + center after the initial layout settles
    setTimeout(() => {
      try { cy.fit(undefined, 80); } catch {}
    }, 600);
    cyRef.current = cy;
    expandedRef.current = new Set();

    // Click handlers
    cy.on('tap', 'node[type="domain"]', (evt) => {
      const node = evt.target;
      const dom = node.data('domain');
      if (expandedRef.current.has(dom)) collapseDomain(dom);
      else expandDomain(dom);
    });

    cy.on('tap', 'node[type="rule"]', (evt) => {
      const id = evt.target.data('id');
      if (id) onRuleSelect?.(id);
    });

    // Tooltip on rule hover
    cy.on('mouseover', 'node[type="rule"]', (evt) => {
      const node = evt.target;
      const pos = node.renderedPosition();
      setTooltip({
        x: pos.x,
        y: pos.y,
        ruleId: node.data('id'),
        ruleName: node.data('ruleName'),
        criticality: node.data('criticality'),
        sourceFile: node.data('sourceFile'),
        lineStart: node.data('lineStart'),
        lineEnd: node.data('lineEnd'),
      });
    });
    cy.on('mouseout', 'node[type="rule"]', () => setTooltip(null));
    cy.on('pan zoom', () => setTooltip(null));

    // Cross-domain edge hover → highlight endpoints, dim everything else
    cy.on('mouseover', 'edge[type="cross-domain"]', (evt) => {
      const edge = evt.target;
      cy.elements().addClass('dim');
      edge.removeClass('dim').addClass('edge-highlight');
      edge.source().removeClass('dim');
      edge.target().removeClass('dim');
    });
    cy.on('mouseout', 'edge[type="cross-domain"]', () => {
      cy.elements().removeClass('dim');
      cy.elements().removeClass('edge-highlight');
    });

    return () => {
      try { cy.destroy(); } catch {}
      cyRef.current = null;
      expandedRef.current = new Set();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Expand / Collapse a single domain --------
  function expandDomain(domain) {
    const cy = cyRef.current;
    if (!cy || expandedRef.current.has(domain)) return;
    const ruleNodes = ruleElementsByDomain[domain] || [];
    if (!ruleNodes.length) return;

    cy.startBatch();
    cy.add(ruleNodes);
    // Add any cross-domain edges whose source rule we just mounted AND whose
    // target domain compound exists (always true).
    const newRuleIds = new Set(ruleNodes.map((n) => n.data.id));
    const edgesToAdd = crossDomainEdges.filter((e) => newRuleIds.has(e.data.source));
    if (edgesToAdd.length) cy.add(edgesToAdd);
    expandedRef.current.add(domain);

    // Re-apply current criticality + search filters to the new nodes
    applyFilters(cy);
    cy.endBatch();

    // Run a tight sub-layout on this compound's children only
    const children = cy.nodes(`node[type="rule"][parent="dom:${domain}"]`);
    if (children.length) {
      const sub = children.layout({ ...compoundChildLayout, boundingBox: undefined });
      sub.run();
    }

    // Animate the compound itself for a small expansion feel
    const compound = cy.getElementById(`dom:${domain}`);
    compound.animate({ style: { 'border-width': 4 } }, { duration: 220 });
    setTimeout(() => compound.animate({ style: { 'border-width': 2 } }, { duration: 220 }), 240);
  }

  function collapseDomain(domain) {
    const cy = cyRef.current;
    if (!cy || !expandedRef.current.has(domain)) return;
    cy.startBatch();
    const children = cy.nodes(`node[type="rule"][parent="dom:${domain}"]`);
    // Remove edges that touch any child first
    children.connectedEdges().remove();
    children.remove();
    expandedRef.current.delete(domain);
    cy.endBatch();
  }

  // -------- Filters --------
  function applyFilters(cyArg) {
    const cy = cyArg || cyRef.current;
    if (!cy) return;
    const term = (search || '').trim().toLowerCase();
    cy.nodes('node[type="rule"]').forEach((n) => {
      const crit = n.data('criticality');
      const dom = n.data('domain');
      const id = (n.data('id') || '').toLowerCase();
      const name = (n.data('ruleName') || '').toLowerCase();
      const critOk = critFilters[crit];
      const domOk = domainFilter === 'All' || dom === domainFilter;
      const visible = critOk && domOk;
      if (visible) n.removeClass('hidden');
      else n.addClass('hidden');

      // Search highlight
      const isHit = term && (id.includes(term) || name.includes(term));
      if (isHit) n.addClass('search-hit');
      else n.removeClass('search-hit');
    });

    // Domain compound dimming when domainFilter is set
    cy.nodes('node[type="domain"]').forEach((n) => {
      const dom = n.data('domain');
      if (domainFilter !== 'All' && dom !== domainFilter) n.addClass('dim');
      else n.removeClass('dim');
    });

    // Update domain badge counts to reflect VISIBLE rules
    cy.nodes('node[type="domain"]').forEach((n) => {
      const dom = n.data('domain');
      const visible = cy.nodes(`node[type="rule"][domain="${dom}"]`).filter((r) => !r.hasClass('hidden')).length;
      const total = n.data('count');
      const visibleCount = expandedRef.current.has(dom) ? visible : total;
      n.data('label', `${dom}  ${visibleCount}`);
    });

    // Pan/zoom to fit search hits
    if (term) {
      const hits = cy.nodes('.search-hit').filter((n) => !n.hasClass('hidden'));
      if (hits.length) cy.animate({ fit: { eles: hits, padding: 80 }, duration: 600 });
    }
  }

  // Re-apply filters when state changes
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, domainFilter, critFilters]);

  // -------- Layout switching --------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    let opts;
    if (layoutMode === 'compound') opts = compoundLayout;
    else if (layoutMode === 'concentric') opts = concentricLayout;
    else opts = gridLayout;
    // For concentric/grid, ensure all rules are mounted (flat view)
    if (layoutMode !== 'compound') {
      cy.startBatch();
      for (const dom of Object.keys(ruleElementsByDomain)) {
        if (!expandedRef.current.has(dom)) {
          const ruleNodes = ruleElementsByDomain[dom] || [];
          if (ruleNodes.length) {
            cy.add(ruleNodes);
            expandedRef.current.add(dom);
          }
        }
      }
      // Add all cross-domain edges
      const existing = new Set(cy.edges().map((e) => e.id()));
      const toAdd = crossDomainEdges.filter((e) => !existing.has(e.data.id));
      if (toAdd.length) cy.add(toAdd);
      applyFilters(cy);
      cy.endBatch();
    }
    cy.layout(opts).run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode]);

  // -------- Toolbar actions --------
  const toggleCrit = (k) => setCritFilters((f) => ({ ...f, [k]: !f[k] }));

  const handleReset = () => {
    const cy = cyRef.current;
    if (!cy) return;
    setSearch('');
    setDomainFilter('All');
    setCritFilters({ HIGH: true, MEDIUM: true, LOW: true });
    cy.startBatch();
    // Collapse all expanded domains
    for (const dom of Array.from(expandedRef.current)) {
      const children = cy.nodes(`node[type="rule"][parent="dom:${dom}"]`);
      children.connectedEdges().remove();
      children.remove();
    }
    expandedRef.current = new Set();
    cy.elements().removeClass('hidden dim search-hit edge-highlight');
    cy.endBatch();
    setLayoutMode('compound');
    cy.layout(compoundLayout).run();
    setTimeout(() => cy.fit(undefined, 60), 700);
  };

  const handleExport = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const blob = cy.png({ output: 'blob', bg: 'white', scale: 2 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rules-graph-export.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const domainOptions = useMemo(
    () => ['All', ...Object.keys(useGraphDataDomains(domainElements))],
    [domainElements]
  );

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.group}>
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.k}
              className={`${styles.btn} ${layoutMode === opt.k ? styles.active : ''}`}
              onClick={() => setLayoutMode(opt.k)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className={styles.group}>
          {CRIT_KEYS.map((k) => (
            <button
              key={k}
              className={`${styles.btn} ${critFilters[k] ? styles.active : ''}`}
              onClick={() => toggleCrit(k)}
              style={critFilters[k] ? { color: CRIT_COLORS[k] } : undefined}
            >
              ● {k}
            </button>
          ))}
        </div>

        <select
          className={styles.select}
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
        >
          {domainOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <input
          className={styles.searchInput}
          placeholder="Search rule ID or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className={styles.spacer} />

        <button className={styles.btn} onClick={handleReset}>
          Reset
        </button>
        <button className={styles.btn} onClick={handleExport}>
          Export PNG
        </button>
      </div>

      {/* Cytoscape canvas */}
      <div className={styles.canvas}>
        <div ref={containerRef} className={styles.cyContainer} />

        {tooltip && (
          <div
            ref={tooltipRef}
            className={styles.tooltip}
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className={styles.tooltipId}>{tooltip.ruleId}</div>
            <div className={styles.tooltipName}>{tooltip.ruleName}</div>
            <div className={styles.tooltipMeta}>
              <span>Criticality</span>
              <span style={{ color: CRIT_COLORS[tooltip.criticality] }}>
                {tooltip.criticality}
              </span>
              <span>Source</span>
              <span>{tooltip.sourceFile}</span>
              <span>Lines</span>
              <span>
                {tooltip.lineStart}–{tooltip.lineEnd}
              </span>
            </div>
          </div>
        )}

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#DC2626' }} /> HIGH
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#D97706' }} /> MEDIUM
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#6B7280' }} /> LOW
          </div>
          <div className={styles.legendItem} style={{ marginLeft: 8, opacity: 0.7 }}>
            click a domain to expand · drag to pan · scroll to zoom
          </div>
        </div>
      </div>
    </div>
  );
}

// Tiny helper that returns the domain id list in the same order useGraphData built them.
function useGraphDataDomains(domainElements) {
  const out = {};
  for (const el of domainElements) out[el.data.domain] = true;
  return out;
}
