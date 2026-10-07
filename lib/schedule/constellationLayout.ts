export type LayoutNode = { id: string; w: number; h: number; group: string }
export type LayoutLink = { source: string; target: string }
export type Point = { x: number; y: number }

export type LayoutResult = {
  /** Top-left positions, ReactFlow convention. */
  positions: Map<string, Point>
  /** Bounding box of each group (label anchors when grouping by borough). */
  groups: Array<{ id: string; x: number; y: number; w: number; h: number }>
  bounds: { w: number; h: number }
}

const LINK_LENGTH = 230
const ITERATIONS = 260
const GROUP_GAP = 120
const MAX_ROW_WIDTH = 2600
const OVERLAP_PAD = 18

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

/** Fruchterman–Reingold on node centres; deterministic (no Math.random). */
function forceLayoutGroup(nodes: LayoutNode[], links: LayoutLink[], seed?: Map<string, Point>): Map<string, Point> {
  const pos = new Map<string, Point>()
  const n = nodes.length
  if (n === 0) return pos
  if (n === 1) {
    pos.set(nodes[0].id, { x: 0, y: 0 })
    return pos
  }

  const radius = Math.max(LINK_LENGTH, Math.sqrt(n) * 120)
  const seeded = nodes.filter((nd) => seed?.has(nd.id))
  const seedCx = seeded.length ? seeded.reduce((a, nd) => a + seed!.get(nd.id)!.x + nd.w / 2, 0) / seeded.length : 0
  const seedCy = seeded.length ? seeded.reduce((a, nd) => a + seed!.get(nd.id)!.y + nd.h / 2, 0) / seeded.length : 0
  nodes.forEach((node, i) => {
    const s = seed?.get(node.id)
    if (s) {
      pos.set(node.id, { x: s.x + node.w / 2 - seedCx, y: s.y + node.h / 2 - seedCy })
      return
    }
    const angle = (2 * Math.PI * i) / n + hash(node.id) * 0.5
    pos.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  })

  const k = LINK_LENGTH
  const ids = nodes.map((nd) => nd.id)
  const disp = new Map<string, Point>()
  let temperature = seeded.length ? radius * 0.15 : radius * 0.6

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const id of ids) disp.set(id, { x: 0, y: 0 })

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(ids[i])!
        const b = pos.get(ids[j])!
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d = Math.hypot(dx, dy)
        if (d < 0.01) {
          dx = hash(ids[i] + ids[j]) - 0.5
          dy = hash(ids[j] + ids[i]) - 0.5
          d = Math.hypot(dx, dy)
        }
        const f = (k * k) / d
        const da = disp.get(ids[i])!
        const db = disp.get(ids[j])!
        da.x += (dx / d) * f
        da.y += (dy / d) * f
        db.x -= (dx / d) * f
        db.y -= (dy / d) * f
      }
    }

    for (const l of links) {
      const a = pos.get(l.source)
      const b = pos.get(l.target)
      if (!a || !b) continue
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d = Math.max(Math.hypot(dx, dy), 0.01)
      const f = (d * d) / k
      const da = disp.get(l.source)!
      const db = disp.get(l.target)!
      da.x -= (dx / d) * f
      da.y -= (dy / d) * f
      db.x += (dx / d) * f
      db.y += (dy / d) * f
    }

    for (const id of ids) {
      const p = pos.get(id)!
      const dv = disp.get(id)!
      // Gentle gravity keeps loosely connected nodes in the cluster.
      dv.x -= p.x * 0.08
      dv.y -= p.y * 0.08
      const len = Math.max(Math.hypot(dv.x, dv.y), 0.01)
      const step = Math.min(len, temperature)
      p.x += (dv.x / len) * step
      p.y += (dv.y / len) * step
    }
    temperature = Math.max(temperature * 0.97, 1)
  }

  removeOverlaps(nodes, pos)
  return pos
}

function removeOverlaps(nodes: LayoutNode[], centres: Map<string, Point>) {
  for (let pass = 0; pass < 80; pass++) {
    let moved = false
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const pa = centres.get(a.id)!
        const pb = centres.get(b.id)!
        const ox = (a.w + b.w) / 2 + OVERLAP_PAD - Math.abs(pa.x - pb.x)
        const oy = (a.h + b.h) / 2 + OVERLAP_PAD - Math.abs(pa.y - pb.y)
        if (ox <= 0 || oy <= 0) continue
        moved = true
        if (ox < oy) {
          const s = (pa.x <= pb.x ? -1 : 1) * (ox / 2)
          pa.x += s
          pb.x -= s
        } else {
          const s = (pa.y <= pb.y ? -1 : 1) * (oy / 2)
          pa.y += s
          pb.y -= s
        }
      }
    }
    if (!moved) break
  }
}

/** Connected components, used as groups when not clustering by borough. */
export function connectedComponents(nodeIds: string[], links: LayoutLink[]): Map<string, string> {
  const parent = new Map(nodeIds.map((id) => [id, id]))
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(x, r)
    return r
  }
  for (const l of links) {
    if (!parent.has(l.source) || !parent.has(l.target)) continue
    const a = find(l.source)
    const b = find(l.target)
    if (a !== b) parent.set(a, b)
  }
  const out = new Map<string, string>()
  for (const id of nodeIds) out.set(id, find(id))
  return out
}

/**
 * Lays out each group independently, then shelf-packs groups (largest first) into rows.
 * `seed` holds previous top-left positions so incremental changes don't reshuffle the canvas.
 */
export function layoutConstellation(
  nodes: LayoutNode[],
  links: LayoutLink[],
  opts: { seed?: Map<string, Point>; groupHeader?: number } = {}
): LayoutResult {
  const header = opts.groupHeader ?? 0
  const byGroup = new Map<string, LayoutNode[]>()
  for (const nd of nodes) {
    const list = byGroup.get(nd.group) ?? []
    list.push(nd)
    byGroup.set(nd.group, list)
  }

  const laid: Array<{ id: string; nodes: LayoutNode[]; centres: Map<string, Point>; w: number; h: number; minX: number; minY: number }> = []
  for (const [groupId, members] of byGroup) {
    const memberIds = new Set(members.map((m) => m.id))
    const groupLinks = links.filter((l) => memberIds.has(l.source) && memberIds.has(l.target))
    const centres = forceLayoutGroup(members, groupLinks, opts.seed)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const m of members) {
      const c = centres.get(m.id)!
      minX = Math.min(minX, c.x - m.w / 2)
      minY = Math.min(minY, c.y - m.h / 2)
      maxX = Math.max(maxX, c.x + m.w / 2)
      maxY = Math.max(maxY, c.y + m.h / 2)
    }
    laid.push({ id: groupId, nodes: members, centres, w: maxX - minX, h: maxY - minY + header, minX, minY })
  }

  laid.sort((a, b) => b.nodes.length - a.nodes.length || b.w * b.h - a.w * a.h || a.id.localeCompare(b.id))

  const positions = new Map<string, Point>()
  const groups: LayoutResult['groups'] = []
  let x = 0
  let y = 0
  let rowH = 0
  let maxW = 0
  for (const g of laid) {
    if (x > 0 && x + g.w > MAX_ROW_WIDTH) {
      x = 0
      y += rowH + GROUP_GAP
      rowH = 0
    }
    for (const m of g.nodes) {
      const c = g.centres.get(m.id)!
      positions.set(m.id, {
        x: Math.round(x + (c.x - m.w / 2 - g.minX)),
        y: Math.round(y + header + (c.y - m.h / 2 - g.minY)),
      })
    }
    groups.push({ id: g.id, x, y, w: g.w, h: g.h })
    x += g.w + GROUP_GAP
    rowH = Math.max(rowH, g.h)
    maxW = Math.max(maxW, x - GROUP_GAP)
  }

  return { positions, groups, bounds: { w: maxW, h: y + rowH } }
}

/** Simple grid for the unassigned-therapist tray, placed under the main layout. */
export function trayPositions(ids: string[], originY: number, cell: { w: number; h: number }, columns = 10): Map<string, Point> {
  const out = new Map<string, Point>()
  ids.forEach((id, i) => {
    out.set(id, { x: (i % columns) * (cell.w + 14), y: originY + Math.floor(i / columns) * (cell.h + 14) })
  })
  return out
}
