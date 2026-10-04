import type { Position, Trail } from './types';

export interface TrailPath {
  entryIds: string[];
  connectionIds: string[];
}

/**
 * Kürzester Weg zwischen zwei Einträgen. Bevorzugt die Richtung der Verbindungen
 * (so wie die Recherche tatsächlich verlief) und fällt sonst auf ungerichtet zurück.
 */
export function findPath(trail: Trail, fromId: string, toId: string): TrailPath | null {
  if (fromId === toId) return { entryIds: [fromId], connectionIds: [] };
  return bfs(trail, fromId, toId, true) ?? bfs(trail, fromId, toId, false);
}

function bfs(trail: Trail, fromId: string, toId: string, directed: boolean): TrailPath | null {
  const adjacency = new Map<string, { next: string; via: string }[]>();
  const link = (a: string, b: string, via: string) => {
    const list = adjacency.get(a) ?? [];
    list.push({ next: b, via });
    adjacency.set(a, list);
  };
  for (const c of trail.connections) {
    link(c.source, c.target, c.id);
    if (!directed) link(c.target, c.source, c.id);
  }

  const previous = new Map<string, { from: string; via: string }>();
  const seen = new Set([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) break;
    for (const { next, via } of adjacency.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, { from: current, via });
      queue.push(next);
    }
  }
  if (!seen.has(toId)) return null;

  const entryIds = [toId];
  const connectionIds: string[] = [];
  let current = toId;
  while (current !== fromId) {
    const step = previous.get(current)!;
    connectionIds.push(step.via);
    entryIds.push(step.from);
    current = step.from;
  }
  return { entryIds: entryIds.reverse(), connectionIds: connectionIds.reverse() };
}

const COLUMN_GAP = 300;
const ROW_GAP = 120;

/** Platz für einen neuen Abzweig: rechts vom Elternknoten, unter seinen bisherigen Kindern. */
export function childPosition(trail: Trail, parentId: string): Position {
  const parent = trail.entries.find((e) => e.id === parentId);
  if (!parent) return freePosition(trail);
  const childIds = new Set(trail.connections.filter((c) => c.source === parentId).map((c) => c.target));
  const children = trail.entries.filter((e) => childIds.has(e.id));
  const x = parent.position.x + COLUMN_GAP;
  if (children.length === 0) return { x, y: parent.position.y };
  return { x, y: Math.max(...children.map((c) => c.position.y)) + ROW_GAP };
}

/** Platz für einen freien Eintrag: unterhalb aller bestehenden Einträge. */
export function freePosition(trail: Trail): Position {
  if (trail.entries.length === 0) return { x: 0, y: 0 };
  return {
    x: Math.min(...trail.entries.map((e) => e.position.x)),
    y: Math.max(...trail.entries.map((e) => e.position.y)) + ROW_GAP * 1.5,
  };
}

/** Leitet aus einer URL einen lesbaren Titel ab (Wikipedia, Reddit, sonst Host + letzter Pfadteil). */
export function titleFromUrl(raw: string): string | null {
  const url = parseUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean).map(safeDecode);

  if (host.endsWith('wikipedia.org') && segments[0] === 'wiki' && segments.length > 1) {
    return segments.slice(1).join('/').replace(/_/g, ' ');
  }
  if (host.endsWith('reddit.com')) {
    const i = segments.indexOf('comments');
    if (i >= 0 && segments[i + 2]) return segments[i + 2].replace(/_/g, ' ');
    if (segments[0] === 'r' && segments[1]) return `r/${segments[1]}`;
  }
  const last = segments.at(-1);
  if (!last) return host;
  return `${host}: ${last.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ')}`;
}

export function hostOf(raw: string): string | null {
  return parseUrl(raw)?.hostname.replace(/^www\./, '') ?? null;
}

export function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
