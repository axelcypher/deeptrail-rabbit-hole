import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type OnBeforeDelete,
  type OnConnect,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { ConnectionPanel, EntryPanel, OverviewPanel, type EntryDraft } from './components/DetailPanel';
import Sidebar from './components/Sidebar';
import TrailNode, { type TrailFlowNode } from './components/TrailNode';
import { childPosition, findPath, freePosition } from './graph';
import { exportTrail, loadState, makeEntry, newId, parseTrailFile, reducer, saveState, type EntryPatch } from './store';
import type { EntryStatus, Trail } from './types';

const nodeTypes = { trail: TrailNode };

type Selection = { kind: 'entry'; id: string } | { kind: 'connection'; id: string } | null;

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState());
  const [selection, setSelection] = useState<Selection>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [flowNodes, setFlowNodes] = useState<TrailFlowNode[]>([]);
  const { fitView, setCenter, getNode, getZoom } = useReactFlow();

  const trail = state.trails.find((t) => t.id === state.activeTrailId) ?? null;

  useEffect(() => saveState(state), [state]);

  // Beim Wechsel der Recherche: Auswahl zurücksetzen und Graph einpassen.
  useEffect(() => {
    setSelection(null);
    const timer = window.setTimeout(() => fitView({ padding: 0.25, maxZoom: 1.2 }), 50);
    return () => window.clearTimeout(timer);
  }, [state.activeTrailId, fitView]);

  const selectedEntry =
    trail && selection?.kind === 'entry' ? (trail.entries.find((e) => e.id === selection.id) ?? null) : null;
  const selectedConnection =
    trail && selection?.kind === 'connection'
      ? (trail.connections.find((c) => c.id === selection.id) ?? null)
      : null;

  const path = useMemo(
    () => (trail && selectedEntry ? findPath(trail, trail.rootId, selectedEntry.id) : null),
    [trail, selectedEntry],
  );

  // Flow-Knoten aus dem Store ableiten; gemessene Größen und laufende Drags bleiben erhalten.
  useEffect(() => {
    if (!trail) {
      setFlowNodes([]);
      return;
    }
    const onPath = new Set(path?.entryIds ?? []);
    setFlowNodes((previous) => {
      const byId = new Map(previous.map((n) => [n.id, n]));
      return trail.entries.map((entry) => {
        const prev = byId.get(entry.id);
        return {
          ...prev,
          id: entry.id,
          type: 'trail',
          position: prev?.dragging ? prev.position : entry.position,
          selected: selection?.kind === 'entry' && selection.id === entry.id,
          deletable: entry.id !== trail.rootId,
          data: {
            entry,
            isRoot: entry.id === trail.rootId,
            onPath: onPath.size > 1 && onPath.has(entry.id),
            dimmed: highlightOpen && entry.status === 'besucht' && entry.id !== trail.rootId,
          },
        };
      });
    });
  }, [trail, selection, path, highlightOpen]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!trail) return [];
    const onPath = new Set(path?.connectionIds ?? []);
    const byId = new Map(trail.entries.map((e) => [e.id, e]));
    return trail.connections.map((c) => ({
      id: c.id,
      source: c.source,
      target: c.target,
      selected: selection?.kind === 'connection' && selection.id === c.id,
      className: [
        onPath.has(c.id) && 'on-path',
        byId.get(c.target)?.status === 'offen' && 'leads-open',
      ]
        .filter(Boolean)
        .join(' '),
    }));
  }, [trail, path, selection]);

  // --- Graph-Interaktion ------------------------------------------------------

  const onNodesChange = useCallback((changes: NodeChange<TrailFlowNode>[]) => {
    setFlowNodes((nodes) => applyNodeChanges(changes, nodes));
    for (const change of changes) {
      if (change.type !== 'select') continue;
      if (change.selected) setSelection({ kind: 'entry', id: change.id });
      else setSelection((s) => (s?.kind === 'entry' && s.id === change.id ? null : s));
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type !== 'select') continue;
      if (change.selected) setSelection({ kind: 'connection', id: change.id });
      else setSelection((s) => (s?.kind === 'connection' && s.id === change.id ? null : s));
    }
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: TrailFlowNode, nodes: TrailFlowNode[]) => {
      if (!trail) return;
      const positions = Object.fromEntries(nodes.map((n) => [n.id, n.position]));
      dispatch({ type: 'moveEntries', trailId: trail.id, positions });
    },
    [trail],
  );

  const onConnect = useCallback<OnConnect>(
    ({ source, target }) => {
      if (!trail) return;
      dispatch({ type: 'connect', trailId: trail.id, connectionId: newId(), source, target, now: Date.now() });
    },
    [trail],
  );

  const onBeforeDelete = useCallback<OnBeforeDelete<TrailFlowNode, Edge>>(
    async ({ nodes, edges }) => ({ nodes: nodes.filter((n) => n.id !== trail?.rootId), edges }),
    [trail],
  );

  const onNodesDelete = useCallback(
    (nodes: TrailFlowNode[]) => {
      if (!trail) return;
      dispatch({ type: 'deleteEntries', trailId: trail.id, entryIds: nodes.map((n) => n.id), now: Date.now() });
      setSelection(null);
    },
    [trail],
  );

  const onEdgesDelete = useCallback(
    (edges: Edge[]) => {
      if (!trail) return;
      dispatch({
        type: 'deleteConnections',
        trailId: trail.id,
        connectionIds: edges.map((e) => e.id),
        now: Date.now(),
      });
      setSelection((s) => (s?.kind === 'connection' ? null : s));
    },
    [trail],
  );

  // --- Aktionen ---------------------------------------------------------------

  const focusEntry = useCallback(
    (entryId: string) => {
      setSelection({ kind: 'entry', id: entryId });
      const node = getNode(entryId);
      if (!node) return;
      const width = node.measured?.width ?? 200;
      const height = node.measured?.height ?? 80;
      setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        zoom: Math.max(getZoom(), 0.9),
        duration: 400,
      });
    },
    [getNode, getZoom, setCenter],
  );

  const addEntry = (activeTrail: Trail, parentId: string | null, draft: EntryDraft) => {
    const now = Date.now();
    const entry = makeEntry({
      id: newId(),
      title: draft.title,
      type: draft.type,
      url: draft.url,
      position: parentId ? childPosition(activeTrail, parentId) : freePosition(activeTrail),
      now,
    });
    dispatch({ type: 'addEntry', trailId: activeTrail.id, entry, parentId, connectionId: newId() });
    setSelection({ kind: 'entry', id: entry.id });
    window.setTimeout(() => focusEntry(entry.id), 60);
  };

  const updateEntry = (entryId: string, patch: EntryPatch) =>
    trail && dispatch({ type: 'updateEntry', trailId: trail.id, entryId, patch, now: Date.now() });

  const setStatus = (entryId: string, status: EntryStatus) =>
    trail && dispatch({ type: 'setStatus', trailId: trail.id, entryId, status, now: Date.now() });

  const downloadTrail = () => {
    if (!trail) return;
    const blob = new Blob([exportTrail(trail, Date.now())], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${slug(trail.title) || 'recherche'}.deeptrail.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importTrail = async (file: File) => {
    try {
      dispatch({ type: 'importTrail', trail: parseTrailFile(await file.text(), newId()) });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Import fehlgeschlagen.');
    }
  };

  // --- Darstellung ------------------------------------------------------------

  return (
    <div className="app">
      <Sidebar
        trails={state.trails}
        activeTrailId={state.activeTrailId}
        onCreate={(title) =>
          dispatch({ type: 'createTrail', trailId: newId(), rootId: newId(), title, now: Date.now() })
        }
        onSelect={(trailId) => dispatch({ type: 'selectTrail', trailId })}
        onDelete={(trailId) => dispatch({ type: 'deleteTrail', trailId })}
        onImport={importTrail}
      />

      <main className="canvas">
        {trail ? (
          <>
            <div className="toolbar">
              <button
                onClick={() => addEntry(trail, null, { title: 'Neuer Eintrag', type: 'begriff', url: '' })}
                title="Eintrag ohne Verbindung anlegen"
              >
                + Freier Eintrag
              </button>
              <button
                className={highlightOpen ? 'on' : ''}
                aria-pressed={highlightOpen}
                onClick={() => setHighlightOpen((v) => !v)}
              >
                Offene hervorheben
              </button>
              <button onClick={() => fitView({ padding: 0.25, maxZoom: 1.2, duration: 300 })}>Einpassen</button>
              <button onClick={downloadTrail}>Exportieren</button>
            </div>
            <ReactFlow<TrailFlowNode, Edge>
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              onBeforeDelete={onBeforeDelete}
              onNodesDelete={onNodesDelete}
              onEdgesDelete={onEdgesDelete}
              onPaneClick={() => setSelection(null)}
              deleteKeyCode={['Delete', 'Backspace']}
              defaultEdgeOptions={{ type: 'smoothstep' }}
              fitView
              fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
              minZoom={0.15}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeClassName={(n) => `minimap-${(n as TrailFlowNode).data.entry.status}`} />
            </ReactFlow>
          </>
        ) : (
          <div className="empty">
            <h2>Wohin führt der Kaninchenbau heute?</h2>
            <p>
              Starte links eine neue Recherche mit einem Ausgangsthema. Von dort aus hängst du Links, Personen,
              Begriffe, Orte, Medien und Quellen an – und siehst später genau, wie du von A nach Z gekommen bist.
            </p>
          </div>
        )}
      </main>

      {trail && (
        <aside className="details">
          {selectedEntry ? (
            <EntryPanel
              trail={trail}
              entry={selectedEntry}
              path={path ? path.entryIds.map((id) => trail.entries.find((e) => e.id === id)!) : null}
              onUpdate={(patch) => updateEntry(selectedEntry.id, patch)}
              onSetStatus={(status) => setStatus(selectedEntry.id, status)}
              onOpenUrl={() => {
                window.open(selectedEntry.url, '_blank', 'noopener,noreferrer');
                setStatus(selectedEntry.id, 'besucht');
              }}
              onAddChild={(draft) => addEntry(trail, selectedEntry.id, draft)}
              onDelete={() => {
                dispatch({ type: 'deleteEntries', trailId: trail.id, entryIds: [selectedEntry.id], now: Date.now() });
                setSelection(null);
              }}
              onFocus={focusEntry}
            />
          ) : selectedConnection ? (
            <ConnectionPanel
              connection={selectedConnection}
              from={trail.entries.find((e) => e.id === selectedConnection.source)}
              to={trail.entries.find((e) => e.id === selectedConnection.target)}
              onDelete={() => {
                dispatch({
                  type: 'deleteConnections',
                  trailId: trail.id,
                  connectionIds: [selectedConnection.id],
                  now: Date.now(),
                });
                setSelection(null);
              }}
              onFocus={focusEntry}
            />
          ) : (
            <OverviewPanel
              trail={trail}
              onRename={(title) => dispatch({ type: 'renameTrail', trailId: trail.id, title, now: Date.now() })}
              onFocus={focusEntry}
            />
          )}
        </aside>
      )}
    </div>
  );
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
