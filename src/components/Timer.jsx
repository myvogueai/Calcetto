import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { formatTime } from '../utils/helpers';
import { playWhistle } from '../utils/audio';

const DURATIONS = [20, 30, 45, 60, 90];

export default function Timer({ isAdmin }) {
  const {
    game,
    isFull,
    startTimer,
    pauseTimer,
    resumeTimer,
    addFiveMinutes,
    resetTimer,
    markTimerFinished,
  } = useGame();

  const [remaining, setRemaining] = useState(0);
  const whistlePlayedRef = useRef(false);
  const timer = game?.timer;

  // Client-side countdown
  useEffect(() => {
    if (!timer) return;

    const tick = () => {
      if (timer.isFinished) {
        setRemaining(0);
        return;
      }
      if (!timer.isRunning) {
        setRemaining(timer.remainingAtPause ?? 0);
        return;
      }
      const secs = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
      setRemaining(secs);
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timer]);

  // Fire whistle when timer hits zero
  useEffect(() => {
    if (!timer?.isRunning) {
      whistlePlayedRef.current = false;
      return;
    }
    if (remaining === 0 && !whistlePlayedRef.current) {
      whistlePlayedRef.current = true;
      playWhistle();
      markTimerFinished();
    }
  }, [remaining, timer, markTimerFinished]);

  // Nothing to show if no timer and field not full
  if (!isFull && (!timer || timer.durationSeconds === 0)) return null;

  const hasTimer = timer && timer.durationSeconds > 0;
  const isRunning = timer?.isRunning;
  const isFinished = timer?.isFinished;

  return (
    <div className="timer-section">
      {isFull && !hasTimer && (
        <div className="all-full-banner">
          <span>🎉 Tutti in campo! Buona partita!</span>
        </div>
      )}

      {isFinished && (
        <div className="timer-finished-banner">
          <span>🏁 Fine partita!</span>
        </div>
      )}

      {hasTimer && !isFinished && (
        <div className={`timer-display${remaining <= 60 && remaining > 0 ? ' timer-warning' : ''}`}>
          <span className="timer-digits">{formatTime(remaining)}</span>
        </div>
      )}

      {isAdmin && isFull && (
        <div className="timer-controls">
          {!hasTimer && (
            <div className="timer-start-row">
              <span className="timer-label">Durata partita:</span>
              <div className="timer-duration-btns">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => startTimer(d)}
                    className="btn btn-duration"
                  >
                    {d}'
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasTimer && !isFinished && (
            <div className="timer-admin-btns">
              <button
                onClick={isRunning ? pauseTimer : resumeTimer}
                className={`btn ${isRunning ? 'btn-warning' : 'btn-success'}`}
              >
                {isRunning ? '⏸ Pausa' : '▶ Riprendi'}
              </button>
              <button onClick={addFiveMinutes} className="btn btn-secondary">
                +5 min
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Azzerare il timer?')) resetTimer();
                }}
                className="btn btn-danger-outline"
              >
                ↺ Azzera
              </button>
            </div>
          )}

          {isFinished && (
            <button
              onClick={() => {
                if (window.confirm('Iniziare una nuova partita?')) resetTimer();
              }}
              className="btn btn-primary"
            >
              Nuova partita ▶
            </button>
          )}
        </div>
      )}
    </div>
  );
}
