export type EntryType = 'thema' | 'link' | 'person' | 'begriff' | 'ort' | 'medium' | 'quelle';

export type EntryStatus = 'offen' | 'besucht';

export interface Position {
  x: number;
  y: number;
}

/** Ein Knoten im Recherchegraphen: Thema, Link, Person, Begriff, Ort, Medium oder Quelle. */
export interface Entry {
  id: string;
  title: string;
  type: EntryType;
  url: string;
  note: string;
  status: EntryStatus;
  createdAt: number;
  visitedAt: number | null;
  position: Position;
}

/** Gerichtete Verbindung: von `source` aus ging es weiter zu `target`. */
export interface Connection {
  id: string;
  source: string;
  target: string;
  createdAt: number;
}

/** Eine Recherche, ausgehend von einem Ausgangsthema (`rootId`). */
export interface Trail {
  id: string;
  title: string;
  rootId: string;
  createdAt: number;
  updatedAt: number;
  entries: Entry[];
  connections: Connection[];
}

export interface AppState {
  version: 1;
  trails: Trail[];
  activeTrailId: string | null;
}

export const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: 'thema', label: 'Thema' },
  { value: 'link', label: 'Link' },
  { value: 'person', label: 'Person' },
  { value: 'begriff', label: 'Begriff' },
  { value: 'ort', label: 'Ort' },
  { value: 'medium', label: 'Medium' },
  { value: 'quelle', label: 'Quelle' },
];

export function typeLabel(type: EntryType): string {
  return ENTRY_TYPES.find((t) => t.value === type)?.label ?? type;
}
