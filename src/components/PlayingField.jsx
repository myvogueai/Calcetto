import React from 'react';
import { useGame } from '../context/GameContext';
import PlayerSlot from './PlayerSlot';

export default function PlayingField({ isSelecting, onSlotSelect }) {
  const { game } = useGame();

  if (!game) return null;

  return (
    <div className="playing-field">
      {/* Field background markings */}
      <div className="field-bg">
        <div className="field-center-line" />
        <div className="field-center-circle" />
        <div className="field-goal field-goal-left" />
        <div className="field-goal field-goal-right" />
      </div>

      {/* Teams header */}
      <div className="teams-header">
        <div className="team-header team-a-header">
          <span className="team-dot team-a-dot" />
          <span>Squadra A</span>
        </div>
        <div className="team-header team-b-header">
          <span>Squadra B</span>
          <span className="team-dot team-b-dot" />
        </div>
      </div>

      {/* Slots grid — 5 rows × 2 columns */}
      <div className="slots-grid">
        {[0, 1, 2, 3, 4].map((i) => (
          <React.Fragment key={i}>
            <PlayerSlot
              team="teamA"
              index={i}
              slot={game.teamA?.[i] ?? null}
              isSelecting={isSelecting}
              onSelect={() => onSlotSelect('teamA', i)}
            />
            <PlayerSlot
              team="teamB"
              index={i}
              slot={game.teamB?.[i] ?? null}
              isSelecting={isSelecting}
              onSelect={() => onSlotSelect('teamB', i)}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
