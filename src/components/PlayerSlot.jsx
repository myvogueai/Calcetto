import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { POSITION_LABELS } from '../utils/helpers';

export default function PlayerSlot({ team, index, slot, isSelecting, onSelect }) {
  const { userId, updatePlayerName, exitSlot } = useGame();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const isMySlot = slot?.userId === userId;
  const isEmpty = !slot;
  const teamClass = team === 'teamA' ? 'team-a' : 'team-b';

  const handleEditStart = (e) => {
    e.stopPropagation();
    setEditName(slot.name);
    setEditing(true);
  };

  const handleEditConfirm = async (e) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    await updatePlayerName(editName.trim());
    setEditing(false);
  };

  const handleExit = async (e) => {
    e.stopPropagation();
    if (window.confirm('Vuoi davvero liberare il tuo posto?')) {
      await exitSlot();
    }
  };

  const handleClick = () => {
    if (isEmpty && isSelecting) onSelect();
  };

  const posLabel = POSITION_LABELS[index];

  if (editing) {
    return (
      <div className={`player-slot ${teamClass} occupied mine editing`}>
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEditConfirm(e);
            if (e.key === 'Escape') setEditing(false);
          }}
          className="slot-edit-input"
          maxLength={20}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="slot-mini-actions">
          <button onClick={handleEditConfirm} className="btn-mini btn-confirm" title="Conferma">
            ✓
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(false); }}
            className="btn-mini btn-cancel"
            title="Annulla"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        'player-slot',
        teamClass,
        isEmpty ? 'empty' : 'occupied',
        isMySlot ? 'mine' : '',
        isEmpty && isSelecting ? 'selectable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      title={isEmpty ? posLabel : slot.name}
    >
      {isEmpty ? (
        <div className="slot-empty-content">
          <span className="slot-pos-icon">
            {index === 0 ? '🧤' : index <= 2 ? '🛡️' : '⚡'}
          </span>
          <span className="slot-pos-label">{posLabel}</span>
          {isSelecting && <span className="slot-tap-hint">Tap!</span>}
        </div>
      ) : (
        <div className="slot-occupied-content">
          <span className="slot-name">{slot.name}</span>
          {isMySlot && (
            <div className="slot-mini-actions">
              <button onClick={handleEditStart} className="btn-mini btn-edit" title="Modifica nome">
                ✏️
              </button>
              <button onClick={handleExit} className="btn-mini btn-exit" title="Esci dal campo">
                🚪
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
