import React from 'react';
import { useGame } from '../context/GameContext';

export default function ShuffleVote() {
  const {
    currentSlot,
    hasVotedShuffle,
    shuffleVoteCount,
    shuffleVoteThreshold,
    totalPlayers,
    voteForShuffle,
  } = useGame();

  // Only players on the field can vote
  if (!currentSlot || totalPlayers < 2) return null;

  const progress = Math.min(1, shuffleVoteCount / shuffleVoteThreshold);

  return (
    <div className="shuffle-section">
      <div className="shuffle-bar-container">
        <div
          className="shuffle-bar-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="shuffle-info">
        <span className="shuffle-count">
          🔀 Mischia squadre: {shuffleVoteCount}/{shuffleVoteThreshold} voti
        </span>
        <button
          onClick={voteForShuffle}
          className={`btn btn-shuffle${hasVotedShuffle ? ' voted' : ''}`}
        >
          {hasVotedShuffle ? '✓ Hai votato' : 'Vota mischia'}
        </button>
      </div>
    </div>
  );
}
