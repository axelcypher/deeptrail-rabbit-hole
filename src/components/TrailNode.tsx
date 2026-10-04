import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { hostOf } from '../graph';
import { typeLabel, type Entry } from '../types';

export type TrailNodeData = {
  entry: Entry;
  isRoot: boolean;
  onPath: boolean;
  dimmed: boolean;
};

export type TrailFlowNode = Node<TrailNodeData, 'trail'>;

function TrailNode({ data, selected }: NodeProps<TrailFlowNode>) {
  const { entry, isRoot, onPath, dimmed } = data;
  const host = entry.url ? hostOf(entry.url) : null;
  const classes = [
    'trail-node',
    `type-${entry.type}`,
    `status-${entry.status}`,
    isRoot && 'is-root',
    onPath && 'on-path',
    dimmed && 'dimmed',
    selected && 'selected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <Handle type="target" position={Position.Left} />
      <div className="trail-node-head">
        <span className="type-chip">{isRoot ? 'Ausgangsthema' : typeLabel(entry.type)}</span>
        <span className="status-dot" title={entry.status === 'besucht' ? 'Besucht' : 'Offen'} />
      </div>
      <div className="trail-node-title">{entry.title || 'Ohne Titel'}</div>
      {(host || entry.note) && (
        <div className="trail-node-meta">
          {host && <span className="host">{host}</span>}
          {entry.note && <span className="note-mark" title={entry.note}>Notiz</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(TrailNode);
