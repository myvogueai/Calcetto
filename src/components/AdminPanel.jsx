import React, { useState } from 'react';
import { useGame } from '../context/GameContext';

export default function AdminPanel({ onClose }) {
  const {
    game,
    setGroupPin,
    setAdminPin,
    newGame,
    fillWithFakePlayers,
  } = useGame();

  const [groupPinVal, setGroupPinVal] = useState(game?.groupPin ?? '');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [newAdminPinConfirm, setNewAdminPinConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');

  const notify = (text, type = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleGroupPin = async (e) => {
    e.preventDefault();
    if (!groupPinVal.trim()) return notify('Il PIN non può essere vuoto', 'error');
    await setGroupPin(groupPinVal.trim().toUpperCase());
    notify('PIN gruppo aggiornato ✓');
  };

  const handleAdminPin = async (e) => {
    e.preventDefault();
    if (!newAdminPin.trim()) return notify('Inserisci il nuovo PIN', 'error');
    if (newAdminPin !== newAdminPinConfirm)
      return notify('I PIN non coincidono', 'error');
    await setAdminPin(newAdminPin.trim());
    setNewAdminPin('');
    setNewAdminPinConfirm('');
    notify('PIN admin aggiornato ✓');
  };

  const handleNewGame = async () => {
    if (window.confirm('Sei sicuro? Verranno cancellati tutti i giocatori, la lista d\'attesa e il timer.')) {
      await newGame();
      notify('Nuova partita iniziata ✓');
    }
  };

  const handleFill = async () => {
    if (window.confirm('Riempire il campo con giocatori finti? (Modalità test)')) {
      await fillWithFakePlayers();
      notify('Campo riempito con nomi finti ✓');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Pannello Admin</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {msg && (
          <div className={`admin-msg admin-msg-${msgType}`}>{msg}</div>
        )}

        {/* PIN Gruppo */}
        <section className="admin-section">
          <h3>🔑 PIN Gruppo</h3>
          <p className="admin-section-desc">Tutti gli utenti useranno questo PIN per accedere all'app.</p>
          <form onSubmit={handleGroupPin} className="admin-form-row">
            <input
              type="text"
              value={groupPinVal}
              onChange={(e) => setGroupPinVal(e.target.value.toUpperCase())}
              className="admin-input"
              maxLength={20}
              autoComplete="off"
              placeholder="NUOVO PIN GRUPPO"
            />
            <button type="submit" className="btn btn-primary">
              Salva
            </button>
          </form>
          <p className="admin-hint">PIN attuale: <strong>{game?.groupPin}</strong></p>
        </section>

        {/* PIN Admin */}
        <section className="admin-section">
          <h3>🛡️ PIN Admin</h3>
          <p className="admin-section-desc">Cambia il PIN per accedere a questo pannello.</p>
          <form onSubmit={handleAdminPin} className="admin-form-col">
            <input
              type="password"
              value={newAdminPin}
              onChange={(e) => setNewAdminPin(e.target.value)}
              className="admin-input"
              placeholder="Nuovo PIN admin"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={newAdminPinConfirm}
              onChange={(e) => setNewAdminPinConfirm(e.target.value)}
              className="admin-input"
              placeholder="Conferma PIN admin"
              autoComplete="new-password"
            />
            <button type="submit" className="btn btn-primary">
              Aggiorna PIN admin
            </button>
          </form>
        </section>

        <div className="admin-divider" />

        {/* Gestione partita */}
        <section className="admin-section">
          <h3>🗑️ Gestione Partita</h3>
          <div className="admin-action-btns">
            <button onClick={handleNewGame} className="btn btn-danger">
              🔄 Nuova Partita
            </button>
            <button onClick={handleFill} className="btn btn-secondary">
              🤖 Riempi (Test)
            </button>
          </div>
          <p className="admin-hint">
            "Nuova Partita" svuota il campo, la lista d'attesa e il timer.<br />
            "Riempi" è solo per test — inserisce nomi finti.
          </p>
        </section>
      </div>
    </div>
  );
}
