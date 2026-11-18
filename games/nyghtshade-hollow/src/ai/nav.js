// Waypoint navigation graph: auto-linked by walkability, A* path queries. Used by NPCs and by the playtest bot.
const IGNORE = new Set(['celldoor', 'door']);

export class Nav {
  constructor(world) { this.world = world; this.nodes = world.waypoints; this.cache = new Map(); }

  walkable(ax, az, bx, bz, y = 0, r = 0.3) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.ceil(d / 0.35));
    const p = { x: 0, y: y + 0.05, z: 0 };
    for (let i = 0; i <= n; i++) {
      p.x = ax + (bx - ax) * (i / n); p.z = az + (bz - az) * (i / n); p.y = y + 0.05;
      const ox = p.x, oz = p.z;
      this.world.resolveCircle(p, r, 1.7, IGNORE);
      if (Math.abs(p.x - ox) > 0.001 || Math.abs(p.z - oz) > 0.001) return false;
    }
    return true;
  }

  /** Link every pair within `maxDist` on the same level that has a clear straight walk. */
  autoLink(maxDist = 9) {
    const arr = [...this.nodes.values()];
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      if (Math.abs(a.y - b.y) > 1.7) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > maxDist) continue;
      if (a.links.has(b.name)) continue;
      if (this.walkable(a.x, a.z, b.x, b.z, a.y)) { a.links.add(b.name); b.links.add(a.name); }
    }
  }

  nearest(x, z, y = 0, needClear = true) {
    let best = null, bd = 1e9;
    for (const n of this.nodes.values()) {
      if (Math.abs(n.y - y) > 1.2) continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd && (!needClear || d < 1.0 || this.walkable(x, z, n.x, n.z, y))) { bd = d; best = n; }
    }
    if (!best) for (const n of this.nodes.values()) { const d = Math.hypot(n.x - x, n.z - z) + Math.abs(n.y - y) * 5; if (d < bd) { bd = d; best = n; } }
    return best;
  }

  /** Returns [{x,z,y,name}] from (x,z) to goal (node name or {x,z}). */
  path(fx, fz, fy, goal) {
    const start = this.nearest(fx, fz, fy);
    let goalNode, gx, gz;
    if (typeof goal === 'string') { goalNode = this.nodes.get(goal); gx = goalNode.x; gz = goalNode.z; }
    else { gx = goal.x; gz = goal.z; goalNode = this.nearest(gx, gz, goal.y || 0); }
    if (!start || !goalNode) return [];
    const open = new Map([[start.name, 0]]), came = new Map(), g = new Map([[start.name, 0]]), closed = new Set();
    const h = (n) => Math.hypot(n.x - goalNode.x, n.z - goalNode.z) + Math.abs(n.y - goalNode.y) * 2;
    while (open.size) {
      let cur = null, cf = 1e9;
      for (const [k, f] of open) if (f < cf) { cf = f; cur = k; }
      if (cur === goalNode.name) break;
      open.delete(cur); closed.add(cur);
      const cn = this.nodes.get(cur);
      for (const nb of cn.links) {
        if (closed.has(nb)) continue;
        const n = this.nodes.get(nb);
        const tg = g.get(cur) + Math.hypot(cn.x - n.x, cn.z - n.z) + Math.abs(cn.y - n.y) * 1.5;
        if (tg < (g.get(nb) ?? 1e9)) { g.set(nb, tg); came.set(nb, cur); open.set(nb, tg + h(n)); }
      }
    }
    const out = [];
    let k = goalNode.name;
    if (k !== start.name && !came.has(k)) return [];
    while (k) { const n = this.nodes.get(k); out.unshift({ x: n.x, z: n.z, y: n.y, name: n.name }); k = came.get(k); }
    // don't backtrack to a node we've already passed
    while (out.length > 1) { const a = out[0], b = out[1]; if (Math.hypot(fx - b.x, fz - b.z) < Math.hypot(a.x - b.x, a.z - b.z) - 0.05 && Math.abs((fy ?? 0) - a.y) < 1.5) out.shift(); else break; }
    if (typeof goal !== 'string') out.push({ x: gx, z: gz, y: goal.y || goalNode.y, name: null });
    return out;
  }
}
