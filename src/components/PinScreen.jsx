import React, { useState } from 'react';
import { useGame } from '../context/GameContext';

export default function PinScreen({ onSuccess }) {
  const { game, loading, error } = useGame();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!game) return;
    if (pin.toUpperCase() === game.groupPin) {
      sessionStorage.setItem('calcettoPinVerified', 'true');
      onSuccess();
    } else {
      setPinError('PIN errato. Riprova.');
      setPin('');
    }
  };

  if (loading) {
    return (
      <div className="pin-screen">
        <div className="pin-card">
          <div className="pin-logo">⚽</div>
          <div className="spinner" />
          <p className="text-muted">Connessione in corso…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pin-screen">
        <div className="pin-card">
          <div className="pin-logo">⚠️</div>
          <h2>Errore di connessione</h2>
          <p className="error-text">{error}</p>
          <p className="text-muted hint-box">
            Assicurati di aver incollato il tuo <strong>firebaseConfig</strong> in{' '}
            <code>src/firebase.js</code> e di aver abilitato Firestore nel tuo progetto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pin-screen">
      <div className="pin-card">
        <div className="pin-logo">⚽</div>
        <h1 className="pin-title">Calcetto 5v5</h1>
        <p className="text-muted">Inserisci il PIN del gruppo per accedere</p>

        <form onSubmit={handleSubmit} className="pin-form">
          <input
            type="text"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.toUpperCase());
              setPinError('');
            }}
            placeholder="PIN GRUPPO"
            className={`pin-input${pinError ? ' input-error' : ''}`}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
          />
          {pinError && <p className="pin-error">{pinError}</p>}
          <button type="submit" className="btn btn-primary btn-full">
            Entra
          </button>
        </form>
      </div>
    </div>
  );
}
