import React from 'react';
import { useGame } from '../context/GameContext';

export default function WaitingList() {
  const { game, userId, waitingIndex, removeFromWaitingList } = useGame();
  const list = game?.waitingList ?? [];

  if (list.length === 0) return null;

  return (
    <div className="waiting-list">
      <h3 className="waiting-title">⏳ Lista d'attesa ({list.length})</h3>
      <ol className="waiting-ol">
        {list.map((p, i) => (
          <li
            key={p.userId}
            className={`waiting-item${p.userId === userId ? ' waiting-mine' : ''}`}
          >
            <span className="waiting-pos">{i + 1}.</span>
            <span className="waiting-name">{p.name}</span>
            {p.userId === userId && (
              <button
                onClick={removeFromWaitingList}
                className="btn-mini btn-exit"
                title="Esci dalla lista"
              >
                🚪
              </button>
            )}
          </li>
        ))}
      </ol>
      {waitingIndex >= 0 && (
        <p className="waiting-you-text">
          Sei #{waitingIndex + 1} in lista — verrai promosso automaticamente quando si libera un posto!
        </p>
      )}
    </div>
  );
}
