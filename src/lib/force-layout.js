import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';

/**
 * Run a 3D force-directed layout for a graph and return positions keyed by id.
 * @param {Array<{id:string}>} nodes
 * @param {Array<{source:string,target:string}>} links
 * @param {object} opts
 */
export function compute3DLayout(nodes, links, { iterations = 200, charge = -120, linkDistance = 60, center = 0 } = {}) {
  const N = nodes.map((n) => ({ ...n }));
  const L = links.map((l) => ({ ...l }));

  const sim = forceSimulation(N, 3)
    .force('link', forceLink(L).id((d) => d.id).distance(linkDistance).strength(0.6))
    .force('charge', forceManyBody().strength(charge))
    .force('center', forceCenter(center, center, center))
    .stop();

  for (let i = 0; i < iterations; i++) sim.tick();

  const positions = {};
  N.forEach((n) => { positions[n.id] = [n.x, n.y, n.z]; });
  return positions;
}
