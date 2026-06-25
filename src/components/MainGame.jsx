import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import PlayingField from './PlayingField';
import WaitingList from './WaitingList';
import Timer from './Timer';
import ShuffleVote from './ShuffleVote';
import AdminPanel from './AdminPanel';

// Prompt for admin access (first setup or unlock)
function AdminLogin({ onSuccess, onCancel, needsSetup }) {
  const { game, setAdminPin, verifyAdminPin } = useGame();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (needsSetup) {
      if (!pin.trim()) return setErr('Inserisci un PIN');
      if (pin !== confirm) return setErr('I PIN non coincidono');
      await setAdminPin(pin.trim());
      onSuccess();
    } else {
      if (verifyAdminPin(pin)) {
        onSuccess();
      } else {
        setErr('PIN errato');
        setPin('');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{needsSetup ? '🛡️ Crea PIN Admin' : '🛡️ Accesso Admin'}</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        {needsSetup && (
          <p className="text-muted modal-desc">
            È il tuo primo accesso. Scegli un PIN admin per proteggere il pannello organizzatore.
          </p>
        )}
        <form onSubmit={handleSubmit} className="admin-form-col">
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setErr(''); }}
            placeholder={needsSetup ? 'Scegli PIN admin' : 'Inserisci PIN admin'}
            className={`admin-input${err ? ' input-error' : ''}`}
            autoFocus
            autoComplete="off"
          />
          {needsSetup && (
            <input
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setErr(''); }}
              placeholder="Conferma PIN admin"
              className="admin-input"
              autoComplete="off"
            />
          )}
          {err && <p className="pin-error">{err}</p>}
          <button type="submit" className="btn btn-primary">
            {needsSetup ? 'Imposta PIN e accedi' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Name entry prompt at the bottom
function NameEntry({ onConfirm, isFull }) {
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setConfirming(true);
  };

  const handleConfirm = () => {
    onConfirm(name.trim());
  };

  return (
    <div className="name-entry">
      {!confirming ? (
        <form onSubmit={handleAdd} className="name-entry-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Il tuo nome"
            className="name-input"
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-primary">
            {isFull ? 'Lista attesa' : 'Aggiungi'}
          </button>
        </form>
      ) : (
        <div className="name-confirm">
          <span className="name-confirm-label">
            {isFull ? (
              <>Mettersi in lista come <strong>{name}</strong>?</>
            ) : (
              <>Schierati come <strong>{name}</strong>?</>
            )}
          </span>
          <div className="name-confirm-btns">
            <button onClick={handleConfirm} className="btn btn-success">
              ✓ Conferma
            </button>
            <button
              onClick={() => { setConfirming(false); }}
              className="btn btn-secondary"
            >
              ✕ Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MainGame({ isAdmin, onAdminLogout }) {
  const {
    game,
    isFull,
    currentSlot,
    waitingIndex,
    claimSlot,
    addToWaitingList,
  } = useGame();

  const [pendingName, setPendingName] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [claimError, setClaimError] = useState('');

  const needsAdminSetup = !game?.adminPin;
  const isSelecting = !!pendingName && !isFull;

  const handleNameConfirm = async (name) => {
    if (isFull) {
      await addToWaitingList(name);
    } else {
      // Enter selecting mode
      setPendingName(name);
    }
  };

  const handleSlotSelect = async (team, index) => {
    if (!pendingName) return;
    const result = await claimSlot(team, index, pendingName);
    if (result.success) {
      setPendingName(null);
      setClaimError('');
    } else {
      setClaimError(result.error);
    }
  };

  const handleAdminClick = () => {
    if (isAdmin) {
      setShowAdminPanel(true);
    } else {
      setShowAdminLogin(true);
    }
  };

  const handleAdminLoginSuccess = () => {
    setShowAdminLogin(false);
    // Propagate admin unlock to parent (App)
    if (typeof onAdminLogout === 'function') {
      // We reuse the parent's setter via a stable ref trick; simpler: just call a prop
      window._calcettoAdminUnlocked?.();
    }
  };

  const userOnField = !!currentSlot;
  const userInWaiting = waitingIndex >= 0;
  const userNeedsEntry = !userOnField && !userInWaiting && !pendingName;

  return (
    <div className="main-game">
      {/* Top bar */}
      <header className="game-header">
        <div className="game-header-left">
          <span className="game-logo">⚽</span>
          <span className="game-title">Calcetto 5v5</span>
        </div>
        <div className="game-header-right">
          <span className="player-count">
            {(game?.teamA?.filter(Boolean).length ?? 0) +
              (game?.teamB?.filter(Boolean).length ?? 0)}
            /10
          </span>
          <button
            onClick={handleAdminClick}
            className={`btn-icon${isAdmin ? ' btn-icon-admin' : ''}`}
            title="Pannello admin"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Selecting slot instruction */}
      {isSelecting && (
        <div className="selecting-banner">
          <span>👇 Tocca un posto libero per schierarti come <strong>{pendingName}</strong></span>
          <button
            onClick={() => { setPendingName(null); setClaimError(''); }}
            className="btn-mini btn-cancel"
          >
            ✕
          </button>
        </div>
      )}
      {claimError && (
        <div className="claim-error">{claimError}</div>
      )}

      {/* Timer */}
      <Timer isAdmin={isAdmin} />

      {/* Playing field */}
      <PlayingField isSelecting={isSelecting} onSlotSelect={handleSlotSelect} />

      {/* Shuffle vote */}
      <ShuffleVote />

      {/* Waiting list */}
      <WaitingList />

      {/* Name entry (shown only when needed) */}
      {userNeedsEntry && (
        <NameEntry onConfirm={handleNameConfirm} isFull={isFull} />
      )}

      {/* Admin logout button */}
      {isAdmin && (
        <div className="admin-logout-row">
          <button onClick={onAdminLogout} className="btn btn-secondary btn-sm">
            🔓 Esci da admin
          </button>
        </div>
      )}

      {/* Admin login modal */}
      {showAdminLogin && (
        <AdminLogin
          needsSetup={needsAdminSetup}
          onSuccess={handleAdminLoginSuccess}
          onCancel={() => setShowAdminLogin(false)}
        />
      )}

      {/* Admin panel modal */}
      {showAdminPanel && isAdmin && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
}
