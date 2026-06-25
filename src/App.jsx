import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  doc, onSnapshot, setDoc, updateDoc, runTransaction, getDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { playWhistle } from './utils/audio';

// ─── Helpers ────────────────────────────────────────────────────────────────
const uid = () => {
  const k = 'calcettoUserId';
  const s = localStorage.getItem(k);
  if (s) return s;
  const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(k, id);
  return id;
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const fmt = (s) => {
  const t = Math.max(0, Math.round(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const FAKE = ['Ronaldo', 'Messi', 'Neymar', 'Mbappé', 'Modric', 'Kroos', 'Benzema', 'Salah', 'De Bruyne', 'Lewandowski'];
const DURATIONS = [20, 30, 45, 60, 90];
const DEFAULT = {
  groupPin: 'CALCE2026',
  adminPin: '',
  teamA: [null, null, null, null, null],
  teamB: [null, null, null, null, null],
  waitingList: [],
  shuffleVotes: {},
  timer: { durationSeconds: 0, endTime: null, pausedAt: null, remainingAtPause: 0, isRunning: false, isFinished: false },
};

const gameRef = doc(db, 'calcetto', 'main');

// ─── Modal wrapper ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── PIN Screen ─────────────────────────────────────────────────────────────
function PinScreen({ groupPin, loading, error, onSuccess }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

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
        </div>
      </div>
    );
  }

  return (
    <div className="pin-screen">
      <div className="pin-card">
        <div className="pin-logo">⚽</div>
        <h1 className="pin-title">Calcetto 5v5</h1>
        <p className="text-muted">Inserisci il PIN del gruppo</p>
        <form
          className="pin-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.toUpperCase() === groupPin) {
              sessionStorage.setItem('calcettoPinVerified', 'true');
              onSuccess();
            } else {
              setErr('PIN errato');
              setPin('');
            }
          }}
        >
          <input
            className={`pin-input${err ? ' input-error' : ''}`}
            value={pin}
            onChange={(e) => { setPin(e.target.value.toUpperCase()); setErr(''); }}
            placeholder="PIN GRUPPO"
            autoFocus
            maxLength={20}
          />
          {err && <p className="pin-error">{err}</p>}
          <button type="submit" className="btn btn-primary btn-full">Entra</button>
        </form>
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const userId = useMemo(() => uid(), []);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pinOk, setPinOk] = useState(() => sessionStorage.getItem('calcettoPinVerified') === 'true');
  const [isAdmin, setIsAdmin] = useState(false);

  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pendingName, setPendingName] = useState(null);
  const [claimErr, setClaimErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [adminErr, setAdminErr] = useState('');
  const [groupPinVal, setGroupPinVal] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [newAdminConfirm, setNewAdminConfirm] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  const [remaining, setRemaining] = useState(0);
  const whistleRef = useRef(false);

  // Firestore sync
  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const snap = await getDoc(gameRef);
        if (!snap.exists()) await setDoc(gameRef, DEFAULT);
        unsub = onSnapshot(gameRef, (s) => {
          if (s.exists()) setGame(s.data());
          setLoading(false);
        }, (e) => { setError(e.message); setLoading(false); });
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    })();
    return () => unsub?.();
  }, []);

  // Derived
  const currentSlot = useMemo(() => {
    if (!game) return null;
    for (let i = 0; i < 5; i++) {
      if (game.teamA?.[i]?.userId === userId) return { team: 'teamA', index: i };
      if (game.teamB?.[i]?.userId === userId) return { team: 'teamB', index: i };
    }
    return null;
  }, [game, userId]);

  const waitingIdx = game?.waitingList?.findIndex((p) => p.userId === userId) ?? -1;
  const total = (game?.teamA?.filter(Boolean).length ?? 0) + (game?.teamB?.filter(Boolean).length ?? 0);
  const isFull = total === 10;
  const voteCount = Object.keys(game?.shuffleVotes ?? {}).length;
  const voteNeed = Math.max(2, Math.ceil(total * 0.6));
  const hasVoted = !!game?.shuffleVotes?.[userId];
  const timer = game?.timer;
  const isSelecting = !!pendingName && !isFull;

  // Timer tick
  useEffect(() => {
    if (!timer) return;
    const tick = () => {
      if (timer.isFinished) { setRemaining(0); return; }
      if (!timer.isRunning) { setRemaining(timer.remainingAtPause ?? 0); return; }
      setRemaining(Math.max(0, Math.round((timer.endTime - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!timer?.isRunning) { whistleRef.current = false; return; }
    if (remaining === 0 && !whistleRef.current) {
      whistleRef.current = true;
      playWhistle();
      updateDoc(gameRef, { 'timer.isRunning': false, 'timer.isFinished': true, 'timer.remainingAtPause': 0 });
    }
  }, [remaining, timer]);

  // Actions
  const claimSlot = useCallback(async (team, index, playerName) => {
    try {
      await runTransaction(db, async (tx) => {
        const data = (await tx.get(gameRef)).data();
        if (data[team][index]) throw new Error('Posto già occupato');
        if ([...data.teamA, ...data.teamB].some((s) => s?.userId === userId)) throw new Error('Hai già un posto');
        const newTeam = [...data[team]];
        newTeam[index] = { name: playerName, userId };
        tx.update(gameRef, { [team]: newTeam, waitingList: data.waitingList.filter((p) => p.userId !== userId) });
      });
      setPendingName(null);
      setClaimErr('');
    } catch (e) {
      setClaimErr(e.message);
    }
  }, [userId]);

  const exitSlot = useCallback(async () => {
    if (!currentSlot || !window.confirm('Liberare il tuo posto?')) return;
    await runTransaction(db, async (tx) => {
      const data = (await tx.get(gameRef)).data();
      const newTeam = [...data[currentSlot.team]];
      const votes = { ...data.shuffleVotes };
      delete votes[userId];
      const updates = { shuffleVotes: votes };
      if (data.waitingList.length) {
        const [p, ...rest] = data.waitingList;
        newTeam[currentSlot.index] = { name: p.name, userId: p.userId };
        updates.waitingList = rest;
      } else {
        newTeam[currentSlot.index] = null;
        updates.waitingList = data.waitingList;
      }
      updates[currentSlot.team] = newTeam;
      tx.update(gameRef, updates);
    });
  }, [currentSlot, userId]);

  const voteShuffle = useCallback(async () => {
    await runTransaction(db, async (tx) => {
      const data = (await tx.get(gameRef)).data();
      const votes = { ...data.shuffleVotes };
      if (votes[userId]) { delete votes[userId]; tx.update(gameRef, { shuffleVotes: votes }); return; }
      votes[userId] = true;
      const onField = [...data.teamA, ...data.teamB].filter(Boolean);
      const need = Math.max(2, Math.ceil(onField.length * 0.6));
      if (Object.keys(votes).length >= need && onField.length >= 2) {
        const players = shuffle(onField);
        const slotsA = data.teamA.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
        const slotsB = data.teamB.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
        const newA = Array(5).fill(null);
        const newB = Array(5).fill(null);
        let pi = 0;
        slotsA.forEach((s) => { if (pi < players.length) newA[s] = players[pi++]; });
        slotsB.forEach((s) => { if (pi < players.length) newB[s] = players[pi++]; });
        tx.update(gameRef, { teamA: newA, teamB: newB, shuffleVotes: {} });
      } else {
        tx.update(gameRef, { shuffleVotes: votes });
      }
    });
  }, [userId]);

  const notify = (msg) => { setAdminMsg(msg); setTimeout(() => setAdminMsg(''), 3000); };

  const renderSlot = (team, index) => {
    const slot = game?.[team]?.[index];
    const isMine = slot?.userId === userId;
    const teamCls = team === 'teamA' ? 'team-a' : 'team-b';
    const empty = !slot;
    const canPick = empty && isSelecting;

    if (isMine && editing) {
      return (
        <div key={`${team}-${index}`} className="slot-cell">
          <div className={`player-slot ${teamCls} occupied mine editing`}>
            <input
              className="slot-edit-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && editName.trim()) {
                  const data = (await getDoc(gameRef)).data();
                  const t = [...data[currentSlot.team]];
                  t[currentSlot.index] = { ...t[currentSlot.index], name: editName.trim() };
                  await updateDoc(gameRef, { [currentSlot.team]: t });
                  setEditing(false);
                }
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
              maxLength={20}
            />
          </div>
        </div>
      );
    }

    return (
      <div key={`${team}-${index}`} className="slot-cell">
        <div
          className={['player-slot', teamCls, empty ? 'empty' : 'occupied', isMine ? 'mine' : '', canPick ? 'selectable' : ''].filter(Boolean).join(' ')}
          onClick={() => canPick && claimSlot(team, index, pendingName)}
          role="button"
          tabIndex={canPick ? 0 : -1}
        >
          {empty ? '+' : <span className="slot-name">{slot.name}</span>}
        </div>
        {isMine && !empty && (
          <div className="slot-mini-actions">
            <button type="button" className="btn-mini btn-edit" onClick={() => { setEditName(slot.name); setEditing(true); }}>✏️</button>
            <button type="button" className="btn-mini btn-exit" onClick={exitSlot}>🚪</button>
          </div>
        )}
      </div>
    );
  };

  if (!pinOk) {
    return (
      <PinScreen
        groupPin={game?.groupPin ?? 'CALCE2026'}
        loading={loading}
        error={error}
        onSuccess={() => setPinOk(true)}
      />
    );
  }

  const needsEntry = !currentSlot && waitingIdx < 0 && !pendingName;

  return (
    <div className="main-game">
      <header className="game-header">
        <div className="game-header-left">
          <span className="game-logo">⚽</span>
          <span className="game-title">Calcetto 5v5</span>
        </div>
        <div className="game-header-right">
          <span className="player-count">{total}/10</span>
          <button
            type="button"
            className={`btn-icon${isAdmin ? ' btn-icon-admin' : ''}`}
            onClick={() => (isAdmin ? setShowAdminPanel(true) : setShowAdminLogin(true))}
          >
            ⚙️
          </button>
        </div>
      </header>

      {isSelecting && (
        <div className="selecting-banner">
          <span>👇 Tocca un <strong>+</strong> per schierarti come <strong>{pendingName}</strong></span>
          <button type="button" className="btn-mini btn-cancel" onClick={() => { setPendingName(null); setClaimErr(''); }}>✕</button>
        </div>
      )}
      {claimErr && <div className="claim-error">{claimErr}</div>}

      {/* Timer */}
      <div className="timer-section">
        {isFull && !(timer?.durationSeconds) && (
          <div className="all-full-banner">🎉 Tutti in campo! Buona partita!</div>
        )}
        {timer?.isFinished && <div className="timer-finished-banner">🏁 Fine partita!</div>}
        {timer?.durationSeconds > 0 && !timer.isFinished && (
          <div className={`timer-display${remaining <= 60 && remaining > 0 ? ' timer-warning' : ''}`}>
            <span className="timer-digits">{fmt(remaining)}</span>
          </div>
        )}
        {isAdmin && isFull && (
          <div className="timer-controls">
            {!timer?.durationSeconds && (
              <div className="timer-start-row">
                <span className="timer-label">Durata partita:</span>
                <div className="timer-duration-btns">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="btn btn-duration"
                      onClick={() => updateDoc(gameRef, {
                        timer: { durationSeconds: d * 60, endTime: Date.now() + d * 60000, pausedAt: null, remainingAtPause: d * 60, isRunning: true, isFinished: false },
                      })}
                    >
                      {d}&apos;
                    </button>
                  ))}
                </div>
              </div>
            )}
            {timer?.durationSeconds > 0 && !timer.isFinished && (
              <div className="timer-admin-btns">
                <button
                  type="button"
                  className={`btn ${timer.isRunning ? 'btn-warning' : 'btn-success'}`}
                  onClick={async () => {
                    if (timer.isRunning) {
                      const r = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
                      await updateDoc(gameRef, { 'timer.isRunning': false, 'timer.pausedAt': Date.now(), 'timer.remainingAtPause': r });
                    } else {
                      await updateDoc(gameRef, { 'timer.isRunning': true, 'timer.endTime': Date.now() + (timer.remainingAtPause ?? 0) * 1000, 'timer.pausedAt': null });
                    }
                  }}
                >
                  {timer.isRunning ? '⏸ Pausa' : '▶ Riprendi'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    if (timer.isRunning) {
                      await updateDoc(gameRef, { 'timer.endTime': timer.endTime + 300000, 'timer.durationSeconds': timer.durationSeconds + 300 });
                    } else {
                      await updateDoc(gameRef, { 'timer.remainingAtPause': (timer.remainingAtPause ?? 0) + 300, 'timer.durationSeconds': timer.durationSeconds + 300 });
                    }
                  }}
                >
                  +5 min
                </button>
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => window.confirm('Azzerare il timer?') && updateDoc(gameRef, { timer: DEFAULT.timer })}
                >
                  ↺ Azzera
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Field */}
      <div className="playing-field">
        <div className="field-bg">
          <div className="field-center-line" />
          <div className="field-center-circle" />
          <div className="field-goal field-goal-left" />
          <div className="field-goal field-goal-right" />
        </div>
        <div className="teams-header">
          <div className="team-header team-a-header"><span className="team-dot team-a-dot" />Squadra A</div>
          <div className="team-header team-b-header">Squadra B<span className="team-dot team-b-dot" /></div>
        </div>
        <div className="slots-grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <React.Fragment key={i}>
              {renderSlot('teamA', i)}
              {renderSlot('teamB', i)}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Shuffle */}
      {currentSlot && total >= 2 && (
        <div className="shuffle-section">
          <div className="shuffle-bar-container">
            <div className="shuffle-bar-fill" style={{ width: `${Math.min(1, voteCount / voteNeed) * 100}%` }} />
          </div>
          <div className="shuffle-info">
            <span className="shuffle-count">🔀 Mischia: {voteCount}/{voteNeed}</span>
            <button type="button" className={`btn btn-shuffle${hasVoted ? ' voted' : ''}`} onClick={voteShuffle}>
              {hasVoted ? '✓ Hai votato' : 'Vota mischia'}
            </button>
          </div>
        </div>
      )}

      {/* Waiting list */}
      {(game?.waitingList?.length ?? 0) > 0 && (
        <div className="waiting-list">
          <h3 className="waiting-title">⏳ Lista d&apos;attesa ({game.waitingList.length})</h3>
          <ol className="waiting-ol">
            {game.waitingList.map((p, i) => (
              <li key={p.userId} className={`waiting-item${p.userId === userId ? ' waiting-mine' : ''}`}>
                <span className="waiting-pos">{i + 1}.</span>
                <span className="waiting-name">{p.name}</span>
                {p.userId === userId && (
                  <button
                    type="button"
                    className="btn-mini btn-exit"
                    onClick={async () => {
                      const data = (await getDoc(gameRef)).data();
                      await updateDoc(gameRef, { waitingList: data.waitingList.filter((x) => x.userId !== userId) });
                    }}
                  >
                    🚪
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Name entry */}
      {needsEntry && (
        <div className="name-entry">
          {!confirming ? (
            <form
              className="name-entry-form"
              onSubmit={(e) => { e.preventDefault(); if (name.trim()) setConfirming(true); }}
            >
              <input className="name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Il tuo nome" maxLength={20} />
              <button type="submit" className="btn btn-primary">{isFull ? 'Lista attesa' : 'Aggiungi'}</button>
            </form>
          ) : (
            <div className="name-confirm">
              <span className="name-confirm-label">
                {isFull ? <>In lista come <strong>{name}</strong>?</> : <>Schierati come <strong>{name}</strong>?</>}
              </span>
              <div className="name-confirm-btns">
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={async () => {
                    if (isFull) {
                      await runTransaction(db, async (tx) => {
                        const data = (await tx.get(gameRef)).data();
                        if (data.waitingList.some((p) => p.userId === userId)) return;
                        tx.update(gameRef, { waitingList: [...data.waitingList, { name: name.trim(), userId, addedAt: Date.now() }] });
                      });
                    } else {
                      setPendingName(name.trim());
                    }
                    setConfirming(false);
                    setName('');
                  }}
                >
                  ✓ Conferma
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>✕ Annulla</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="admin-logout-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAdmin(false)}>🔓 Esci da admin</button>
        </div>
      )}

      {/* Admin login */}
      {showAdminLogin && (
        <Modal title={!game?.adminPin ? '🛡️ Crea PIN Admin' : '🛡️ Accesso Admin'} onClose={() => setShowAdminLogin(false)}>
          {!game?.adminPin && <p className="text-muted modal-desc">Primo accesso: scegli un PIN admin.</p>}
          <form
            className="admin-form-col"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!game?.adminPin) {
                if (!adminPin.trim()) return setAdminErr('Inserisci un PIN');
                if (adminPin !== adminConfirm) return setAdminErr('I PIN non coincidono');
                await updateDoc(gameRef, { adminPin: adminPin.trim() });
                setIsAdmin(true);
                setShowAdminLogin(false);
              } else if (game.adminPin === adminPin) {
                setIsAdmin(true);
                setShowAdminLogin(false);
              } else {
                setAdminErr('PIN errato');
                setAdminPin('');
              }
            }}
          >
            <input className="admin-input" type="password" value={adminPin} onChange={(e) => { setAdminPin(e.target.value); setAdminErr(''); }} placeholder="PIN admin" autoFocus />
            {!game?.adminPin && <input className="admin-input" type="password" value={adminConfirm} onChange={(e) => setAdminConfirm(e.target.value)} placeholder="Conferma PIN" />}
            {adminErr && <p className="pin-error">{adminErr}</p>}
            <button type="submit" className="btn btn-primary">{!game?.adminPin ? 'Imposta e accedi' : 'Accedi'}</button>
          </form>
        </Modal>
      )}

      {/* Admin panel */}
      {showAdminPanel && isAdmin && (
        <Modal title="⚙️ Pannello Admin" onClose={() => setShowAdminPanel(false)}>
          <div className="admin-panel">
            {adminMsg && <div className="admin-msg admin-msg-success">{adminMsg}</div>}
            <section className="admin-section">
              <h3>🔑 PIN Gruppo</h3>
              <form
                className="admin-form-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await updateDoc(gameRef, { groupPin: groupPinVal.trim().toUpperCase() });
                  notify('PIN gruppo aggiornato ✓');
                }}
              >
                <input className="admin-input" value={groupPinVal || game?.groupPin || ''} onChange={(e) => setGroupPinVal(e.target.value.toUpperCase())} />
                <button type="submit" className="btn btn-primary">Salva</button>
              </form>
            </section>
            <section className="admin-section">
              <h3>🛡️ PIN Admin</h3>
              <form
                className="admin-form-col"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newAdminPin !== newAdminConfirm) return notify('I PIN non coincidono');
                  await updateDoc(gameRef, { adminPin: newAdminPin.trim() });
                  notify('PIN admin aggiornato ✓');
                }}
              >
                <input className="admin-input" type="password" value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} placeholder="Nuovo PIN admin" />
                <input className="admin-input" type="password" value={newAdminConfirm} onChange={(e) => setNewAdminConfirm(e.target.value)} placeholder="Conferma" />
                <button type="submit" className="btn btn-primary">Aggiorna PIN admin</button>
              </form>
            </section>
            <div className="admin-divider" />
            <section className="admin-section">
              <h3>🗑️ Gestione Partita</h3>
              <div className="admin-action-btns">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    if (!window.confirm('Nuova partita?')) return;
                    await updateDoc(gameRef, { teamA: Array(5).fill(null), teamB: Array(5).fill(null), waitingList: [], shuffleVotes: {}, timer: DEFAULT.timer });
                    notify('Nuova partita ✓');
                  }}
                >
                  🔄 Nuova Partita
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    if (!window.confirm('Riempire con nomi finti?')) return;
                    const names = shuffle([...FAKE]);
                    await updateDoc(gameRef, {
                      teamA: names.slice(0, 5).map((n, i) => ({ name: n, userId: `fake_a${i}_${Date.now()}` })),
                      teamB: names.slice(5, 10).map((n, i) => ({ name: n, userId: `fake_b${i}_${Date.now()}` })),
                    });
                    notify('Campo riempito ✓');
                  }}
                >
                  🤖 Riempi (Test)
                </button>
              </div>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
