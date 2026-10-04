import { useState, type FormEvent } from 'react';
import { parseUrl, titleFromUrl } from '../graph';
import type { EntryPatch } from '../store';
import { ENTRY_TYPES, typeLabel, type Connection, type Entry, type EntryStatus, type EntryType, type Trail } from '../types';

export interface EntryDraft {
  title: string;
  type: EntryType;
  url: string;
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (ts: number) => dateFormat.format(ts);

// --- Eintrag ----------------------------------------------------------------

interface EntryPanelProps {
  trail: Trail;
  entry: Entry;
  path: Entry[] | null;
  onUpdate: (patch: EntryPatch) => void;
  onSetStatus: (status: EntryStatus) => void;
  onOpenUrl: () => void;
  onAddChild: (draft: EntryDraft) => void;
  onDelete: () => void;
  onFocus: (entryId: string) => void;
}

export function EntryPanel({
  trail,
  entry,
  path,
  onUpdate,
  onSetStatus,
  onOpenUrl,
  onAddChild,
  onDelete,
  onFocus,
}: EntryPanelProps) {
  const isRoot = entry.id === trail.rootId;
  const validUrl = parseUrl(entry.url) !== null;

  return (
    <div className="panel-body">
      <div className="panel-kicker">{isRoot ? 'Ausgangsthema' : typeLabel(entry.type)}</div>

      <label className="field">
        <span>Titel</span>
        <input value={entry.title} onChange={(e) => onUpdate({ title: e.target.value })} />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Art</span>
          <select value={entry.type} onChange={(e) => onUpdate({ type: e.target.value as EntryType })}>
            {ENTRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Status</span>
          <div className="segmented" role="group" aria-label="Status">
            {(['offen', 'besucht'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={entry.status === s ? 'on' : ''}
                aria-pressed={entry.status === s}
                onClick={() => onSetStatus(s)}
              >
                {s === 'offen' ? 'Offen' : 'Besucht'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="field">
        <span>Link</span>
        <div className="row">
          <input
            value={entry.url}
            placeholder="https://…"
            onChange={(e) => onUpdate({ url: e.target.value })}
          />
          <button type="button" disabled={!validUrl} onClick={onOpenUrl} title="Im neuen Tab öffnen und als besucht markieren">
            Öffnen
          </button>
        </div>
      </label>

      <label className="field">
        <span>Notiz</span>
        <textarea
          value={entry.note}
          rows={5}
          placeholder="Was war hier interessant? Warum ging es weiter?"
          onChange={(e) => onUpdate({ note: e.target.value })}
        />
      </label>

      <p className="muted small">
        Angelegt {formatDate(entry.createdAt)}
        {entry.visitedAt && <> · besucht {formatDate(entry.visitedAt)}</>}
      </p>

      {path && path.length > 1 && (
        <section className="panel-section">
          <h3>Weg vom Ausgangsthema</h3>
          <ol className="path">
            {path.map((step) => (
              <li key={step.id}>
                <button className="link-button" onClick={() => onFocus(step.id)}>
                  {step.title || 'Ohne Titel'}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      {!isRoot && !path && (
        <p className="hint">Dieser Eintrag ist noch nicht mit dem Ausgangsthema verbunden.</p>
      )}

      <AddChildForm key={entry.id} onAdd={onAddChild} />

      {!isRoot && (
        <button className="danger subtle" onClick={onDelete}>
          Eintrag löschen
        </button>
      )}
    </div>
  );
}

function AddChildForm({ onAdd }: { onAdd: (draft: EntryDraft) => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<EntryType>('link');

  const derivedTitle = titleFromUrl(url);
  const canSubmit = Boolean(title.trim() || derivedTitle);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onAdd({ title: title.trim() || derivedTitle!, type, url: url.trim() });
    setTitle('');
    setUrl('');
  };

  return (
    <form className="panel-section add-child" onSubmit={submit}>
      <h3>Abzweig hinzufügen</h3>
      <input
        value={url}
        onChange={(e) => {
          const next = e.target.value;
          setUrl(next);
          if (parseUrl(next)) setType('link');
        }}
        placeholder="Link einfügen (optional)"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={derivedTitle ?? 'Titel'}
      />
      <div className="row">
        <select value={type} onChange={(e) => setType(e.target.value as EntryType)} aria-label="Art">
          {ENTRY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="submit" className="primary" disabled={!canSubmit}>
          Hinzufügen
        </button>
      </div>
    </form>
  );
}

// --- Verbindung -------------------------------------------------------------

interface ConnectionPanelProps {
  connection: Connection;
  from: Entry | undefined;
  to: Entry | undefined;
  onDelete: () => void;
  onFocus: (entryId: string) => void;
}

export function ConnectionPanel({ connection, from, to, onDelete, onFocus }: ConnectionPanelProps) {
  return (
    <div className="panel-body">
      <div className="panel-kicker">Verbindung</div>
      <p className="connection-line">
        <button className="link-button" onClick={() => from && onFocus(from.id)}>
          {from?.title || 'Ohne Titel'}
        </button>
        <span aria-label="führte zu"> → </span>
        <button className="link-button" onClick={() => to && onFocus(to.id)}>
          {to?.title || 'Ohne Titel'}
        </button>
      </p>
      <p className="muted small">Angelegt {formatDate(connection.createdAt)}</p>
      <button className="danger subtle" onClick={onDelete}>
        Verbindung löschen
      </button>
    </div>
  );
}

// --- Übersicht --------------------------------------------------------------

interface OverviewPanelProps {
  trail: Trail;
  onRename: (title: string) => void;
  onFocus: (entryId: string) => void;
}

export function OverviewPanel({ trail, onRename, onFocus }: OverviewPanelProps) {
  const open = trail.entries.filter((e) => e.status === 'offen');
  const visited = trail.entries
    .filter((e) => e.visitedAt !== null)
    .sort((a, b) => (a.visitedAt ?? 0) - (b.visitedAt ?? 0));

  return (
    <div className="panel-body">
      <div className="panel-kicker">Recherche</div>
      <label className="field">
        <span>Name</span>
        <input value={trail.title} onChange={(e) => onRename(e.target.value)} />
      </label>

      <div className="stats">
        <div>
          <strong>{trail.entries.length}</strong>
          <span>Einträge</span>
        </div>
        <div>
          <strong>{visited.length}</strong>
          <span>besucht</span>
        </div>
        <div>
          <strong>{open.length}</strong>
          <span>offen</span>
        </div>
      </div>

      <section className="panel-section">
        <h3>Offene Pfade</h3>
        {open.length === 0 ? (
          <p className="muted small">Alles abgearbeitet.</p>
        ) : (
          <ul className="entry-list">
            {open.map((e) => (
              <li key={e.id}>
                <button className="link-button" onClick={() => onFocus(e.id)}>
                  {e.title || 'Ohne Titel'}
                </button>
                <span className="muted small">{typeLabel(e.type)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-section">
        <h3>Spur in Besuchsreihenfolge</h3>
        <ol className="timeline">
          {visited.map((e) => (
            <li key={e.id}>
              <button className="link-button" onClick={() => onFocus(e.id)}>
                {e.title || 'Ohne Titel'}
              </button>
              <span className="muted small">{formatDate(e.visitedAt!)}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="hint">
        Tipp: Eintrag anklicken, um ihn zu bearbeiten und Abzweige anzulegen. Verbindungen ziehst du vom rechten zum
        linken Anschlusspunkt. Entf löscht die Auswahl.
      </p>
    </div>
  );
}
