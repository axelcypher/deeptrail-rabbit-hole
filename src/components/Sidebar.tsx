import { useState, type FormEvent } from 'react';
import type { Trail } from '../types';

interface SidebarProps {
  trails: Trail[];
  activeTrailId: string | null;
  onCreate: (title: string) => void;
  onSelect: (trailId: string) => void;
  onDelete: (trailId: string) => void;
  onImport: (file: File) => void;
}

export default function Sidebar({ trails, activeTrailId, onCreate, onSelect, onDelete, onImport }: SidebarProps) {
  const [title, setTitle] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setTitle('');
  };

  return (
    <aside className="sidebar">
      <header className="brand">
        <span className="brand-mark" aria-hidden />
        <div>
          <h1>Deeptrail</h1>
          <p>Rabbit Hole</p>
        </div>
      </header>

      <form className="new-trail" onSubmit={submit}>
        <label htmlFor="new-trail-title">Neue Recherche</label>
        <div className="row">
          <input
            id="new-trail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ausgangsthema …"
          />
          <button type="submit" className="primary" disabled={!title.trim()}>
            Start
          </button>
        </div>
      </form>

      <nav className="trail-list" aria-label="Recherchen">
        {trails.length === 0 && <p className="muted small">Noch keine Recherchen.</p>}
        {trails.map((trail) => {
          const open = trail.entries.filter((e) => e.status === 'offen').length;
          return (
            <div key={trail.id} className={`trail-item ${trail.id === activeTrailId ? 'active' : ''}`}>
              <button className="trail-select" onClick={() => onSelect(trail.id)}>
                <span className="trail-title">{trail.title || 'Ohne Titel'}</span>
                <span className="trail-stats">
                  {trail.entries.length} Einträge · {open} offen
                </span>
              </button>
              <button
                className="icon-button"
                title="Recherche löschen"
                aria-label={`Recherche „${trail.title}“ löschen`}
                onClick={() => {
                  if (window.confirm(`Recherche „${trail.title}“ endgültig löschen?`)) onDelete(trail.id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </nav>

      <label className="import-button">
        Recherche importieren …
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = '';
          }}
        />
      </label>
    </aside>
  );
}
