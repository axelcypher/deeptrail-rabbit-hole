import { describe, expect, it } from 'vitest';
import { childPosition, findPath, titleFromUrl } from './graph';
import { makeEntry } from './store';
import type { Trail } from './types';

function trail(edges: [string, string][], ids = ['a', 'b', 'c', 'd', 'e']): Trail {
  return {
    id: 't',
    title: 'T',
    rootId: ids[0],
    createdAt: 0,
    updatedAt: 0,
    entries: ids.map((id, i) =>
      makeEntry({ id, title: id.toUpperCase(), type: 'thema', position: { x: i * 10, y: i * 5 }, now: 0 }),
    ),
    connections: edges.map(([source, target]) => ({ id: `${source}-${target}`, source, target, createdAt: 0 })),
  };
}

describe('findPath', () => {
  it('folgt der Richtung der Verbindungen', () => {
    const t = trail([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['a', 'd'],
    ]);
    expect(findPath(t, 'a', 'c')).toEqual({ entryIds: ['a', 'b', 'c'], connectionIds: ['a-b', 'b-c'] });
    expect(findPath(t, 'a', 'd')?.entryIds).toEqual(['a', 'd']);
  });

  it('fällt auf ungerichtete Suche zurück', () => {
    const t = trail([
      ['a', 'b'],
      ['c', 'b'],
    ]);
    expect(findPath(t, 'a', 'c')).toEqual({ entryIds: ['a', 'b', 'c'], connectionIds: ['a-b', 'c-b'] });
  });

  it('liefert null für nicht verbundene Einträge', () => {
    expect(findPath(trail([['a', 'b']]), 'a', 'e')).toBeNull();
  });

  it('liefert den Startknoten allein, wenn Start und Ziel gleich sind', () => {
    expect(findPath(trail([]), 'a', 'a')).toEqual({ entryIds: ['a'], connectionIds: [] });
  });
});

describe('childPosition', () => {
  it('setzt das erste Kind rechts neben den Elternknoten', () => {
    const t = trail([], ['a']);
    expect(childPosition(t, 'a')).toEqual({ x: 300, y: 0 });
  });

  it('stapelt weitere Kinder untereinander', () => {
    const t = trail([['a', 'b']], ['a', 'b']);
    t.entries[1].position = { x: 300, y: 40 };
    expect(childPosition(t, 'a')).toEqual({ x: 300, y: 160 });
  });
});

describe('titleFromUrl', () => {
  it('liest Wikipedia-Artikel', () => {
    expect(titleFromUrl('https://de.wikipedia.org/wiki/Kaninchenbau_(Metapher)')).toBe('Kaninchenbau (Metapher)');
    expect(titleFromUrl('https://en.wikipedia.org/wiki/AC/DC')).toBe('AC/DC');
    expect(titleFromUrl('https://de.wikipedia.org/wiki/M%C3%BCnchen')).toBe('München');
  });

  it('liest Reddit-Threads und Subreddits', () => {
    expect(titleFromUrl('https://www.reddit.com/r/history/comments/abc123/why_did_rome_fall/')).toBe(
      'why did rome fall',
    );
    expect(titleFromUrl('https://reddit.com/r/AskHistorians')).toBe('r/AskHistorians');
  });

  it('nutzt sonst Host und letzten Pfadteil', () => {
    expect(titleFromUrl('https://example.com/blog/my-great-post.html')).toBe('example.com: my great post');
    expect(titleFromUrl('https://example.com/')).toBe('example.com');
  });

  it('ignoriert Text, der keine URL ist', () => {
    expect(titleFromUrl('Kaninchen')).toBeNull();
    expect(titleFromUrl('javascript:alert(1)')).toBeNull();
  });
});
