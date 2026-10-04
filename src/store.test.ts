import { describe, expect, it } from 'vitest';
import { exportTrail, initialState, loadState, makeEntry, parseTrailFile, reducer, STORAGE_KEY, type Action } from './store';
import type { AppState } from './types';

function run(...actions: Action[]): AppState {
  return actions.reduce(reducer, initialState);
}

const create: Action = { type: 'createTrail', trailId: 't1', rootId: 'root', title: 'Kaninchen', now: 1 };

function addChild(id: string, parentId: string | null, now = 2): Action {
  return {
    type: 'addEntry',
    trailId: 't1',
    parentId,
    connectionId: `c-${id}`,
    entry: makeEntry({ id, title: id, type: 'link', position: { x: 0, y: 0 }, now }),
  };
}

describe('reducer', () => {
  it('legt eine Recherche mit besuchtem Ausgangsthema an und aktiviert sie', () => {
    const state = run(create);
    expect(state.activeTrailId).toBe('t1');
    const [trail] = state.trails;
    expect(trail.entries).toHaveLength(1);
    expect(trail.entries[0]).toMatchObject({ id: 'root', title: 'Kaninchen', status: 'besucht', visitedAt: 1 });
  });

  it('verbindet neue Abzweige mit dem Elternknoten', () => {
    const trail = run(create, addChild('b', 'root')).trails[0];
    expect(trail.entries.map((e) => e.status)).toEqual(['besucht', 'offen']);
    expect(trail.connections).toEqual([{ id: 'c-b', source: 'root', target: 'b', createdAt: 2 }]);
  });

  it('legt freie Einträge ohne Verbindung an', () => {
    const trail = run(create, addChild('b', null)).trails[0];
    expect(trail.connections).toEqual([]);
  });

  it('setzt und entfernt den Besuchszeitpunkt mit dem Status', () => {
    const base = run(create, addChild('b', 'root'));
    const visited = reducer(base, { type: 'setStatus', trailId: 't1', entryId: 'b', status: 'besucht', now: 5 });
    expect(visited.trails[0].entries[1]).toMatchObject({ status: 'besucht', visitedAt: 5 });
    const reopened = reducer(visited, { type: 'setStatus', trailId: 't1', entryId: 'b', status: 'offen', now: 6 });
    expect(reopened.trails[0].entries[1]).toMatchObject({ status: 'offen', visitedAt: null });
  });

  it('verhindert Selbstverbindungen und Duplikate in beide Richtungen', () => {
    const base = run(create, addChild('b', 'root'));
    const connect = (source: string, target: string): Action => ({
      type: 'connect',
      trailId: 't1',
      connectionId: 'x',
      source,
      target,
      now: 3,
    });
    expect(reducer(base, connect('b', 'b'))).toBe(base);
    expect(reducer(base, connect('root', 'b'))).toBe(base);
    expect(reducer(base, connect('b', 'root'))).toBe(base);
    expect(reducer(base, connect('b', 'unknown'))).toBe(base);
  });

  it('löscht Einträge samt Verbindungen, aber nie das Ausgangsthema', () => {
    const base = run(create, addChild('b', 'root'), addChild('c', 'b'));
    const state = reducer(base, { type: 'deleteEntries', trailId: 't1', entryIds: ['root', 'b'], now: 9 });
    const trail = state.trails[0];
    expect(trail.entries.map((e) => e.id)).toEqual(['root', 'c']);
    expect(trail.connections).toEqual([]);
  });

  it('wählt nach dem Löschen der aktiven Recherche die nächste aus', () => {
    const state = run(create, { ...create, trailId: 't2', rootId: 'r2' } as Action, {
      type: 'deleteTrail',
      trailId: 't2',
    });
    expect(state.activeTrailId).toBe('t1');
    expect(reducer(state, { type: 'deleteTrail', trailId: 't1' }).activeTrailId).toBeNull();
  });
});

describe('Persistenz', () => {
  it('liest gespeicherten Zustand und verwirft Kaputtes', () => {
    const state = run(create, addChild('b', 'root'));
    expect(loadState({ getItem: () => JSON.stringify(state) })).toEqual(state);
    expect(loadState({ getItem: () => '{kaputt' })).toEqual(initialState);
    expect(loadState({ getItem: () => null })).toEqual(initialState);
    const broken = { ...state, trails: [{ ...state.trails[0], rootId: 'fehlt' }] };
    expect(loadState({ getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(broken) : null) })).toEqual({
      ...initialState,
      trails: [],
    });
  });

  it('exportiert und importiert eine Recherche mit neuer ID', () => {
    const trail = run(create, addChild('b', 'root')).trails[0];
    const imported = parseTrailFile(exportTrail(trail, 10), 'neu');
    expect(imported).toEqual({ ...trail, id: 'neu' });
    expect(() => parseTrailFile('{}', 'x')).toThrow(/keine Deeptrail-Recherche/);
    expect(() => parseTrailFile('nope', 'x')).toThrow(/kein gültiges JSON/);
  });
});
