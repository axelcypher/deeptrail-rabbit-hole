import type { AppState, Entry, EntryStatus, EntryType, Position, Trail } from './types';
import { ENTRY_TYPES } from './types';

export const STORAGE_KEY = 'deeptrail-rabbit-hole.v1';

export const newId = (): string => crypto.randomUUID();

export const initialState: AppState = { version: 1, trails: [], activeTrailId: null };

export type EntryPatch = Partial<Pick<Entry, 'title' | 'type' | 'url' | 'note'>>;

export type Action =
  | { type: 'createTrail'; trailId: string; rootId: string; title: string; now: number }
  | { type: 'renameTrail'; trailId: string; title: string; now: number }
  | { type: 'deleteTrail'; trailId: string }
  | { type: 'selectTrail'; trailId: string }
  | { type: 'importTrail'; trail: Trail }
  | { type: 'addEntry'; trailId: string; entry: Entry; parentId: string | null; connectionId: string }
  | { type: 'updateEntry'; trailId: string; entryId: string; patch: EntryPatch; now: number }
  | { type: 'setStatus'; trailId: string; entryId: string; status: EntryStatus; now: number }
  | { type: 'moveEntries'; trailId: string; positions: Record<string, Position> }
  | { type: 'deleteEntries'; trailId: string; entryIds: string[]; now: number }
  | { type: 'connect'; trailId: string; connectionId: string; source: string; target: string; now: number }
  | { type: 'deleteConnections'; trailId: string; connectionIds: string[]; now: number };

export function makeEntry(fields: {
  id: string;
  title: string;
  type: EntryType;
  url?: string;
  note?: string;
  status?: EntryStatus;
  position: Position;
  now: number;
}): Entry {
  const status = fields.status ?? 'offen';
  return {
    id: fields.id,
    title: fields.title,
    type: fields.type,
    url: fields.url ?? '',
    note: fields.note ?? '',
    status,
    createdAt: fields.now,
    visitedAt: status === 'besucht' ? fields.now : null,
    position: fields.position,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'createTrail': {
      const root = makeEntry({
        id: action.rootId,
        title: action.title,
        type: 'thema',
        status: 'besucht',
        position: { x: 0, y: 0 },
        now: action.now,
      });
      const trail: Trail = {
        id: action.trailId,
        title: action.title,
        rootId: root.id,
        createdAt: action.now,
        updatedAt: action.now,
        entries: [root],
        connections: [],
      };
      return { ...state, trails: [trail, ...state.trails], activeTrailId: trail.id };
    }
    case 'renameTrail':
      return mapTrail(state, action.trailId, (t) => ({ ...t, title: action.title, updatedAt: action.now }));
    case 'deleteTrail': {
      const trails = state.trails.filter((t) => t.id !== action.trailId);
      const activeTrailId =
        state.activeTrailId === action.trailId ? (trails[0]?.id ?? null) : state.activeTrailId;
      return { ...state, trails, activeTrailId };
    }
    case 'selectTrail':
      return state.trails.some((t) => t.id === action.trailId)
        ? { ...state, activeTrailId: action.trailId }
        : state;
    case 'importTrail':
      return { ...state, trails: [action.trail, ...state.trails], activeTrailId: action.trail.id };
    case 'addEntry':
      return mapTrail(state, action.trailId, (t) => {
        const hasParent = action.parentId !== null && t.entries.some((e) => e.id === action.parentId);
        return {
          ...t,
          updatedAt: action.entry.createdAt,
          entries: [...t.entries, action.entry],
          connections: hasParent
            ? [
                ...t.connections,
                {
                  id: action.connectionId,
                  source: action.parentId!,
                  target: action.entry.id,
                  createdAt: action.entry.createdAt,
                },
              ]
            : t.connections,
        };
      });
    case 'updateEntry':
      return mapEntry(state, action.trailId, action.entryId, action.now, (e) => ({ ...e, ...action.patch }));
    case 'setStatus':
      return mapEntry(state, action.trailId, action.entryId, action.now, (e) =>
        e.status === action.status
          ? e
          : { ...e, status: action.status, visitedAt: action.status === 'besucht' ? action.now : null },
      );
    case 'moveEntries':
      return mapTrail(state, action.trailId, (t) => ({
        ...t,
        entries: t.entries.map((e) => (action.positions[e.id] ? { ...e, position: action.positions[e.id] } : e)),
      }));
    case 'deleteEntries':
      return mapTrail(state, action.trailId, (t) => {
        // Das Ausgangsthema bleibt immer erhalten.
        const doomed = new Set(action.entryIds.filter((id) => id !== t.rootId));
        if (doomed.size === 0) return t;
        return {
          ...t,
          updatedAt: action.now,
          entries: t.entries.filter((e) => !doomed.has(e.id)),
          connections: t.connections.filter((c) => !doomed.has(c.source) && !doomed.has(c.target)),
        };
      });
    case 'connect':
      return mapTrail(state, action.trailId, (t) => {
        const { source, target } = action;
        const known = (id: string) => t.entries.some((e) => e.id === id);
        const duplicate = t.connections.some(
          (c) => (c.source === source && c.target === target) || (c.source === target && c.target === source),
        );
        if (source === target || !known(source) || !known(target) || duplicate) return t;
        return {
          ...t,
          updatedAt: action.now,
          connections: [...t.connections, { id: action.connectionId, source, target, createdAt: action.now }],
        };
      });
    case 'deleteConnections': {
      const doomed = new Set(action.connectionIds);
      return mapTrail(state, action.trailId, (t) =>
        t.connections.some((c) => doomed.has(c.id))
          ? { ...t, updatedAt: action.now, connections: t.connections.filter((c) => !doomed.has(c.id)) }
          : t,
      );
    }
  }
}

function mapTrail(state: AppState, trailId: string, fn: (trail: Trail) => Trail): AppState {
  let changed = false;
  const trails = state.trails.map((t) => {
    if (t.id !== trailId) return t;
    const next = fn(t);
    if (next !== t) changed = true;
    return next;
  });
  return changed ? { ...state, trails } : state;
}

function mapEntry(
  state: AppState,
  trailId: string,
  entryId: string,
  now: number,
  fn: (entry: Entry) => Entry,
): AppState {
  return mapTrail(state, trailId, (t) => {
    let changed = false;
    const entries = t.entries.map((e) => {
      if (e.id !== entryId) return e;
      const next = fn(e);
      if (next !== e) changed = true;
      return next;
    });
    return changed ? { ...t, entries, updatedAt: now } : t;
  });
}

// --- Persistenz -------------------------------------------------------------

export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): AppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.trails)) return initialState;
    const trails = parsed.trails.filter(isTrail);
    const activeTrailId = trails.some((t: Trail) => t.id === parsed.activeTrailId)
      ? parsed.activeTrailId
      : (trails[0]?.id ?? null);
    return { version: 1, trails, activeTrailId };
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Speicher voll oder nicht verfügbar – die Sitzung läuft trotzdem weiter.
  }
}

// --- Export / Import --------------------------------------------------------

const FILE_FORMAT = 'deeptrail-trail';

export function exportTrail(trail: Trail, now: number): string {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, exportedAt: now, trail }, null, 2);
}

/** Liest eine exportierte Recherche ein und vergibt eine neue ID, damit nichts kollidiert. */
export function parseTrailFile(text: string, trailId: string): Trail {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }
  const candidate =
    typeof parsed === 'object' && parsed !== null && (parsed as { format?: unknown }).format === FILE_FORMAT
      ? (parsed as { trail: unknown }).trail
      : parsed;
  if (!isTrail(candidate)) throw new Error('Die Datei enthält keine Deeptrail-Recherche.');
  return { ...candidate, id: trailId };
}

const ENTRY_TYPE_VALUES = new Set<string>(ENTRY_TYPES.map((t) => t.value));

function isTrail(value: unknown): value is Trail {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.rootId !== 'string') return false;
  if (!Array.isArray(t.entries) || !Array.isArray(t.connections)) return false;
  if (!t.entries.every(isEntry)) return false;
  const ids = new Set((t.entries as Entry[]).map((e) => e.id));
  if (!ids.has(t.rootId)) return false;
  return t.connections.every(
    (c: unknown) =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as Record<string, unknown>).id === 'string' &&
      ids.has((c as Record<string, string>).source) &&
      ids.has((c as Record<string, string>).target),
  );
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  const pos = e.position as Record<string, unknown> | undefined;
  return (
    typeof e.id === 'string' &&
    typeof e.title === 'string' &&
    typeof e.type === 'string' &&
    ENTRY_TYPE_VALUES.has(e.type) &&
    typeof e.url === 'string' &&
    typeof e.note === 'string' &&
    (e.status === 'offen' || e.status === 'besucht') &&
    typeof pos === 'object' &&
    pos !== null &&
    typeof pos.x === 'number' &&
    typeof pos.y === 'number'
  );
}
