import { useState, useEffect, useCallback, useRef } from "react";
import { storage } from "./firebase.js";

const C = {
  bg: "#0d1f14", panel: "#12281a", line: "#1f3d29",
  chalk: "#e8efe6", muted: "#7d9b85", amber: "#f5a623", amberDim: "#3a2f12",
  green: "#3ddc84", red: "#e2614a", teamA: "#4a9ee2", teamB: "#e2614a",
};

const SLOT_Y = [0.12, 0.31, 0.5, 0.69, 0.88];
const SLOTS_PER_SIDE = 5;
const DURATIONS = [20, 30, 45, 60, 90];
const TEST_MODE = true;

export default function Calcetto() {
  const [config, setConfig] = useState(null);
  const [match, setMatch] = useState({ title: "Calcetto del Giovedì", place: "Centro Sportivo", when: "Giovedì 21:00" });
  const [slots, setSlots] = useState({ A: Array(SLOTS_PER_SIDE).fill(null), B: Array(SLOTS_PER_SIDE).fill(null) });
  const [waitlist, setWaitlist] = useState([]);
  const [votes, setVotes] = useState([]);
  const [timer, setTimer] = useState({ duration: 30, endsAt: null, pausedRemaining: null, status: "idle" });
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState("");
  const [me, setMe] = useState("");
  const [nameError, setNameError] = useState("");
  const [entering, setEntering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
  const [newGroupPin, setNewGroupPin] = useState("");
  const [newAdminPin, setNewAdminPin] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const adminOpenRef = useRef(false);
  const whistledRef = useRef(false);
  const audioCtxRef = useRef(null);
  const TOTAL = SLOTS_PER_SIDE * 2;
  const applyMatch = useCallback((value) => {
    try {
      const d = JSON.parse(value);
      if (d.match) setMatch(d.match);
      if (d.slots) setSlots(d.slots);
      setWaitlist(d.waitlist || []); setVotes(d.votes || []);
      if (d.timer) setTimer(d.timer);
    } catch (e) {}
  }, []);

  const load = useCallback(async () => {
    try {
      const rc = await storage.get("config");
      if (rc) setConfig(JSON.parse(rc.value));
      else setConfig(prev => prev || { groupPin: "CALCE2026", adminPin: null });
    } catch (e) { setConfig(prev => prev || { groupPin: "CALCE2026", adminPin: null }); }
    try {
      const r = await storage.get("match4");
      if (r) applyMatch(r.value);
    } catch (e) {}
    setLoading(false);
  }, [applyMatch]);

  useEffect(() => {
    load();
    const unsubMatch = storage.subscribe("match4", (d) => applyMatch(d.value));
    const unsubConfig = storage.subscribe("config", (d) => {
      if (!adminOpenRef.current) { try { setConfig(JSON.parse(d.value)); } catch (e) {} }
    });
    return () => { unsubMatch && unsubMatch(); unsubConfig && unsubConfig(); };
  }, [load, applyMatch]);

  useEffect(() => { adminOpenRef.current = showAdmin; }, [showAdmin]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const save = async (m, s, w, v, tm) => {
    try { await storage.set("match4", JSON.stringify({ match: m, slots: s, waitlist: w, votes: v, timer: tm })); }
    catch (e) { console.error(e); }
  };
  const saveConfig = async (cfg) => {
    setConfig(cfg);
    try { await storage.set("config", JSON.stringify(cfg)); } catch (e) { console.error(e); }
  };

  const allNames = (s) => [...s.A, ...s.B].filter(Boolean);
  const isOnField = (s, n) => allNames(s).some(x => x.toLowerCase() === n.toLowerCase());

  const tryEnter = () => {
    if (!config) return;
    if (pinInput.trim().toUpperCase() === config.groupPin.toUpperCase()) { setAuthed(true); setPinError(""); }
    else setPinError("PIN errato. Chiedilo all'organizzatore.");
  };

  const enterAdmin = () => {
    if (!config.adminPin) {
      const p = adminPinInput.trim();
      if (p.length < 4) { setAdminMsg("Scegli un PIN admin di almeno 4 caratteri."); return; }
      saveConfig({ ...config, adminPin: p }); setAdminAuthed(true); setAdminMsg("PIN admin impostato."); setAdminPinInput("");
    } else if (adminPinInput.trim() === config.adminPin) { setAdminAuthed(true); setAdminMsg(""); setAdminPinInput(""); }
    else setAdminMsg("PIN admin errato.");
  };

  const changeGroupPin = () => {
    const p = newGroupPin.trim();
    if (p.length < 3) { setAdminMsg("PIN gruppo troppo corto."); return; }
    saveConfig({ ...config, groupPin: p }); setNewGroupPin(""); setAdminMsg(`PIN gruppo aggiornato in "${p}".`);
  };
  const changeAdminPin = () => {
    const p = newAdminPin.trim();
    if (p.length < 4) { setAdminMsg("PIN admin troppo corto."); return; }
    saveConfig({ ...config, adminPin: p }); setNewAdminPin(""); setAdminMsg("PIN admin aggiornato.");
  };

  const setIdentity = async () => {
    const n = name.trim(); if (!n) return;
    const oldMe = me;
    const conflict = [...slots.A, ...slots.B].some(x => x && x.toLowerCase() === n.toLowerCase() && (!oldMe || x.toLowerCase() !== oldMe.toLowerCase()));
    if (conflict) { setNameError(`"${n}" è già in campo.`); return; }
    setNameError("");
    if (oldMe && isOnField(slots, oldMe)) {
      const s = { A: [...slots.A], B: [...slots.B] };
      for (const t of ["A", "B"]) { const i = s[t].findIndex(x => x && x.toLowerCase() === oldMe.toLowerCase()); if (i >= 0) s[t][i] = n; }
      const v = votes.map(x => x.toLowerCase() === oldMe.toLowerCase() ? n : x);
      setSlots(s); setVotes(v); setMe(n); setName(""); setEntering(false);
      await save(match, s, waitlist, v, timer); return;
    }
    setMe(n); setName(""); setEntering(false);
  };

  const tapSlot = async (team, idx) => {
    if (timer.status === "running") return;
    const occupant = slots[team][idx];
    if (occupant && me && occupant.toLowerCase() === me.toLowerCase()) {
      const s = { A: [...slots.A], B: [...slots.B] }; s[team][idx] = null;
      setSlots(s); await save(match, s, waitlist, votes, timer); return;
    }
    if (occupant) return;
    if (!me) return;
    const s = { A: [...slots.A], B: [...slots.B] };
    for (const t of ["A", "B"]) { const i = s[t].findIndex(x => x && x.toLowerCase() === me.toLowerCase()); if (i >= 0) s[t][i] = null; }
    const w = waitlist.filter(x => x.name.toLowerCase() !== me.toLowerCase());
    s[team][idx] = me;
    setSlots(s); setWaitlist(w); setName("");
    await save(match, s, w, votes, timer);
  };

  const exitField = async () => {
    if (!me || timer.status === "running") return;
    const s = { A: [...slots.A], B: [...slots.B] };
    for (const t of ["A", "B"]) { const i = s[t].findIndex(x => x && x.toLowerCase() === me.toLowerCase()); if (i >= 0) s[t][i] = null; }
    const v = votes.filter(x => x.toLowerCase() !== me.toLowerCase());
    setSlots(s); setVotes(v); await save(match, s, waitlist, v, timer);
  };

  const joinWaitlist = async () => {
    const n = name.trim(); if (!n) return;
    if (isOnField(slots, n) || waitlist.some(x => x.name.toLowerCase() === n.toLowerCase())) { setMe(n); setName(""); return; }
    const w = [...waitlist, { name: n }]; setWaitlist(w); setMe(n); setName("");
    await save(match, slots, w, votes, timer);
  };
  const leaveWaitlist = async (n) => {
    const w = waitlist.filter(x => x.name !== n); setWaitlist(w); await save(match, slots, w, votes, timer);
  };

  const onField = allNames(slots);
  const needed = Math.max(2, Math.ceil(onField.length * 0.6));
  const iVoted = me && votes.includes(me);
  const canVote = me && isOnField(slots, me);

  const toggleVote = async () => {
    if (!canVote || timer.status === "running") return;
    let v = votes.includes(me) ? votes.filter(x => x !== me) : [...votes, me];
    if (v.length >= needed) {
      const shuffled = shuffle(onField); const half = Math.ceil(shuffled.length / 2);
      const s = { A: Array(SLOTS_PER_SIDE).fill(null), B: Array(SLOTS_PER_SIDE).fill(null) };
      shuffled.forEach((nm, i) => { if (i < half) s.A[i] = nm; else s.B[i - half] = nm; });
      setSlots(s); setVotes([]); await save(match, s, waitlist, [], timer); return;
    }
    setVotes(v); await save(match, slots, waitlist, v, timer);
  };

  const saveMatch = async () => { setEditing(false); await save(match, slots, waitlist, votes, timer); };

  const resetMatch = async () => {
    const s = { A: Array(SLOTS_PER_SIDE).fill(null), B: Array(SLOTS_PER_SIDE).fill(null) };
    const tm = { duration: timer.duration, endsAt: null, pausedRemaining: null, status: "idle" };
    whistledRef.current = false;
    setSlots(s); setWaitlist([]); setVotes([]); setTimer(tm);
    await save(match, s, [], [], tm);
  };

  const fillTest = async () => {
    const names = ["Luca", "Marco", "Gigi", "Paolo", "Dario", "Enzo", "Rino", "Tonino", "Beppe", "Nico"];
    const s = { A: [...slots.A], B: [...slots.B] }; let k = 0;
    for (const t of ["A", "B"]) for (let i = 0; i < SLOTS_PER_SIDE; i++) {
      if (!s[t][i]) { s[t][i] = names[k % names.length]; k++; }
    }
    setSlots(s); await save(match, s, waitlist, votes, timer);
  };

  const startTimer = async (mins) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
      const o = audioCtxRef.current.createOscillator(); const g = audioCtxRef.current.createGain();
      g.gain.value = 0.0001; o.connect(g); g.connect(audioCtxRef.current.destination);
      o.start(); o.stop(audioCtxRef.current.currentTime + 0.05);
    } catch (e) {}
    const tm = { duration: mins, endsAt: Date.now() + mins * 60000, pausedRemaining: null, status: "running" };
    whistledRef.current = false;
    setTimer(tm); await save(match, slots, waitlist, votes, tm);
  };
  const pauseTimer = async () => {
    if (timer.status !== "running") return;
    const remaining = Math.max(0, timer.endsAt - Date.now());
    const tm = { ...timer, endsAt: null, pausedRemaining: remaining, status: "paused" };
    setTimer(tm); await save(match, slots, waitlist, votes, tm);
  };
  const resumeTimer = async () => {
    if (timer.status !== "paused") return;
    const tm = { ...timer, endsAt: Date.now() + timer.pausedRemaining, pausedRemaining: null, status: "running" };
    setTimer(tm); await save(match, slots, waitlist, votes, tm);
  };
  const addMinutes = async (m) => {
    let tm;
    if (timer.status === "running") tm = { ...timer, endsAt: timer.endsAt + m * 60000 };
    else if (timer.status === "paused") tm = { ...timer, pausedRemaining: (timer.pausedRemaining || 0) + m * 60000 };
    else if (timer.status === "finished") tm = { ...timer, endsAt: Date.now() + m * 60000, pausedRemaining: null, status: "running" };
    else return;
    whistledRef.current = false;
    setTimer(tm); await save(match, slots, waitlist, votes, tm);
  };
  const setDuration = async (mins) => { const tm = { ...timer, duration: mins }; setTimer(tm); await save(match, slots, waitlist, votes, tm); };
  const resetTimer = async () => {
    whistledRef.current = false;
    const tm = { duration: timer.duration, endsAt: null, pausedRemaining: null, status: "idle" };
    setTimer(tm); await save(match, slots, waitlist, votes, tm);
  };

  const remainingMs = timer.status === "running" ? Math.max(0, timer.endsAt - now)
    : timer.status === "paused" ? (timer.pausedRemaining || 0) : timer.duration * 60000;
  const finished = timer.status === "running" && remainingMs <= 0;

  useEffect(() => {
    if (finished && !whistledRef.current) {
      whistledRef.current = true;
      playWhistle(audioCtxRef.current);
      const tm = { ...timer, status: "finished", endsAt: null };
      setTimer(tm); save(match, slots, waitlist, votes, tm);
    }
  }, [finished]);

  if (loading || !config) return <Screen><div style={{ color: C.muted }}>caricamento…</div></Screen>;

  if (!authed) {
    return (
      <Screen>
        <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚽</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px" }}>{match.title}</h1>
          <p style={{ color: C.muted, marginBottom: 24 }}>Inserisci il PIN del gruppo per entrare.</p>
          <input value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key === "Enter" && tryEnter()} placeholder="PIN" style={{ ...inp, width: "100%", textAlign: "center", fontSize: 20, letterSpacing: 2, marginBottom: 12, boxSizing: "border-box" }} />
          {pinError && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{pinError}</div>}
          <button onClick={tryEnter} style={{ ...btnPrimary, width: "100%" }}>Entra</button>
          <button onClick={() => setShowAdmin(true)} style={{ ...linkBtn, marginTop: 18 }}>Sei l'organizzatore?</button>
        </div>
        {showAdmin && <AdminModal {...adminProps()} />}
      </Screen>
    );
  }

  const free = TOTAL - onField.length;
  const full = free === 0;
  const timerActive = timer.status === "running" || timer.status === "paused";
  const isAdmin = adminAuthed;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 14px", fontFamily: "system-ui, sans-serif", color: C.chalk, boxSizing: "border-box", overflowX: "hidden" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: C.amber, fontWeight: 700, textTransform: "uppercase" }}>⚽ Prenotazioni</div>
          {editing ? (
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <input value={match.title} onChange={e => setMatch({ ...match, title: e.target.value })} style={inp} placeholder="Titolo" />
              <input value={match.when} onChange={e => setMatch({ ...match, when: e.target.value })} style={inp} placeholder="Quando" />
              <input value={match.place} onChange={e => setMatch({ ...match, place: e.target.value })} style={inp} placeholder="Dove" />
              <button onClick={saveMatch} style={btnPrimary}>Salva</button>
            </div>
          ) : (
            <>
              <h1 style={{ margin: "8px 0 4px", fontSize: 24, fontWeight: 800 }}>{match.title}</h1>
              <div style={{ color: C.muted, fontSize: 14 }}>{match.when} · {match.place}</div>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 6 }}>
                <button onClick={() => setEditing(true)} style={linkBtn}>modifica partita</button>
                <button onClick={() => setShowAdmin(true)} style={{ ...linkBtn, color: isAdmin ? C.green : C.amber }}>{isAdmin ? "✓ admin" : "admin"}</button>
              </div>
            </>
          )}
        </div>

        {timer.status === "finished" ? (
          <div style={{ background: C.red, borderRadius: 16, padding: "18px 16px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#fff" }}>🔔 Fine partita!</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
              <button onClick={() => playWhistle(audioCtxRef.current)} style={{ ...btnGhost, color: "#fff", borderColor: "#fff8" }}>🔊 Risuona</button>
              {isAdmin && <button onClick={resetTimer} style={{ ...btnGhost, color: "#fff", borderColor: "#fff8" }}>↺ Nuovo timer</button>}
              {isAdmin && <button onClick={() => setShowAdmin(true)} style={{ ...btnGhost, color: "#fff", borderColor: "#fff8" }}>Admin</button>}
            </div>
          </div>
        ) : timerActive ? (
          <div style={{ background: C.panel, border: `2px solid ${timer.status === "paused" ? C.amber : C.green}`, borderRadius: 16, padding: 16, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>{timer.status === "paused" ? "⏸ In pausa" : "🟢 Partita in corso"}</div>
            <div style={{ fontSize: 52, fontWeight: 900, color: timer.status === "paused" ? C.amber : C.chalk, lineHeight: 1.1 }}>{fmt(remainingMs)}</div>
            {isAdmin ? (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
                {timer.status === "running" ? <button onClick={pauseTimer} style={btnGhost}>⏸ Pausa</button> : <button onClick={resumeTimer} style={btnPrimary}>▶ Riprendi</button>}
                <button onClick={() => addMinutes(5)} style={btnGhost}>+5 min</button>
                <button onClick={resetTimer} style={{ ...btnGhost, color: C.red, borderColor: C.red }}>↺ Azzera</button>
              </div>
            ) : <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Solo l'organizzatore gestisce il tempo.</div>}
          </div>
        ) : full ? (
          <div style={{ background: C.green + "1a", border: `2px solid ${C.green}`, borderRadius: 16, padding: 16, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.green }}>⚽ Tutti in campo!</div>
            <div style={{ color: C.chalk, fontSize: 14, marginTop: 2 }}>Buona partita.</div>
            {isAdmin ? (
              <>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 12, marginBottom: 6 }}>Scegli la durata e avvia:</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  {DURATIONS.map(d => <button key={d} onClick={() => setDuration(d)} style={{ ...chip, background: timer.duration === d ? C.amber : C.bg, color: timer.duration === d ? "#1a1206" : C.chalk, borderColor: timer.duration === d ? C.amber : C.line }}>{d}'</button>)}
                  {TEST_MODE && <button onClick={() => startTimer(10 / 60)} style={{ ...chip, color: C.green, borderColor: C.green }}>test 10s</button>}
                </div>
                <button onClick={() => startTimer(timer.duration)} style={{ ...btnPrimary, width: "100%" }}>▶ Inizia partita ({Math.round(timer.duration)} min)</button>
              </>
            ) : <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>L'organizzatore farà partire il timer.</div>}
          </div>
        ) : null}

        {!timerActive && timer.status !== "finished" && (
          <>
            {entering ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && setIdentity()} placeholder="Scrivi il tuo nome" style={{ ...inp, flex: 1, minWidth: 0 }} />
                <button onClick={setIdentity} style={{ ...btnPrimary, flexShrink: 0 }}>Conferma</button>
              </div>
            ) : me ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                <div style={{ ...inp, flex: 1, minWidth: 0, display: "flex", alignItems: "center", opacity: 0.85 }}>{me}</div>
                <button onClick={() => { setName(me); setEntering(true); setNameError(""); }} style={{ ...btnGhost, flexShrink: 0 }}>Modifica</button>
                {isOnField(slots, me) && <button onClick={exitField} style={{ ...btnGhost, flexShrink: 0, color: C.red, borderColor: C.red }}>Esci</button>}
              </div>
            ) : (
              <button onClick={() => { setName(""); setEntering(true); setNameError(""); }} style={{ ...btnPrimary, width: "100%", marginBottom: 12 }}>＋ Aggiungi giocatore</button>
            )}
            {nameError && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{nameError}</div>}
            {me && !isOnField(slots, me) && (
              <div style={{ background: C.amber, borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 15, color: "#1a1206", textAlign: "center", fontWeight: 700 }}>
                👇 Scegli la posizione<br /><span style={{ fontWeight: 500, fontSize: 13 }}>tocca una casella libera del campo</span>
              </div>
            )}
          </>
        )}

        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
          <span style={{ color: C.teamA }}>SQUADRA A · {slots.A.filter(Boolean).length}/5</span>
          <span style={{ color: C.muted }}>{full ? "completo" : `${free} liberi`}</span>
          <span style={{ color: C.teamB }}>SQUADRA B · {slots.B.filter(Boolean).length}/5</span>
        </div>

        <div style={{ position: "relative", width: "100%", aspectRatio: "1/1.15", maxHeight: "56vh",
          background: `linear-gradient(90deg, ${C.teamA}12 0%, ${C.teamA}12 50%, ${C.teamB}12 50%, ${C.teamB}12 100%), repeating-linear-gradient(0deg, ${C.panel}, ${C.panel} 8%, #163020 8%, #163020 16%)`,
          border: `2px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, background: C.chalk, opacity: 0.35 }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 70, height: 70, marginLeft: -35, marginTop: -35, border: `2px solid ${C.chalk}`, opacity: 0.25, borderRadius: "50%" }} />
          <div style={{ position: "absolute", top: "38%", left: -1, width: 26, height: "24%", border: `2px solid ${C.chalk}`, borderLeft: "none", opacity: 0.25 }} />
          <div style={{ position: "absolute", top: "38%", right: -1, width: 26, height: "24%", border: `2px solid ${C.chalk}`, borderRight: "none", opacity: 0.25 }} />
          {["A", "B"].map(team => slots[team].map((occupant, idx) => {
            const xPct = team === "A" ? 26 : 74; const yPct = SLOT_Y[idx] * 100;
            const mine = me && occupant && occupant.toLowerCase() === me.toLowerCase();
            const teamColor = team === "A" ? C.teamA : C.teamB;
            const locked = timer.status === "running";
            return (
              <button key={team + idx} onClick={() => tapSlot(team, idx)} disabled={locked}
                style={{ position: "absolute", left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%,-50%)", background: "none", border: "none", padding: 0, cursor: locked ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: 64 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: occupant ? teamColor : "transparent",
                  border: mine ? `3px solid ${C.amber}` : occupant ? `2px solid ${C.chalk}` : `2px dashed ${teamColor}99`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: occupant ? "#0d1f14" : `${teamColor}99`, boxShadow: occupant ? "0 2px 6px rgba(0,0,0,.4)" : "none" }}>
                  {occupant ? initials(occupant) : "+"}
                </div>
                {occupant && <span style={{ fontSize: 10, fontWeight: 600, background: "#0d1f14cc", padding: "1px 5px", borderRadius: 6, maxWidth: 62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{occupant}</span>}
              </button>
            );
          }))}
        </div>

        {!timerActive && timer.status !== "finished" && (
          <div style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 8 }}>
            Tocca un <b style={{ color: C.chalk }}>+</b> per occupare un posto. Tocca il tuo per liberarlo.
          </div>
        )}

        {!timerActive && timer.status !== "finished" && onField.length >= 2 && (
          <div style={{ marginTop: 16, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🎲 Mischia squadre</div>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>Servono <b style={{ color: C.amber }}>{needed}</b> voti su {onField.length}.</div>
            <button onClick={toggleVote} disabled={!canVote} style={{ ...btnPrimary, width: "100%", background: iVoted ? C.line : C.amber, color: iVoted ? C.chalk : "#1a1206", opacity: canVote ? 1 : 0.5 }}>
              {!canVote ? "Occupa un posto per votare" : iVoted ? "Ritira voto" : "Vota mischia"}
            </button>
            <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800, color: votes.length >= needed ? C.green : C.amber }}>{votes.length}/{needed}</div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, justifyContent: "center" }}>
              {Array.from({ length: needed }).map((_, i) => <div key={i} style={{ width: 16, height: 8, borderRadius: 4, background: i < votes.length ? C.green : C.line }} />)}
            </div>
            {votes.length > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Hanno votato: {votes.join(", ")}</div>}
          </div>
        )}

        {full && !timerActive && timer.status !== "finished" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && joinWaitlist()} placeholder="Campo pieno: mettiti in lista" style={{ ...inp, flex: 1, minWidth: 0 }} />
              <button onClick={joinWaitlist} style={{ ...btnPrimary, flexShrink: 0 }}>In lista</button>
            </div>
            {waitlist.map((p, i) => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", marginBottom: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.bg, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
                <div style={{ flex: 1, fontWeight: 500 }}>{p.name}</div>
                <button onClick={() => leaveWaitlist(p.name)} style={{ background: "none", border: "none", color: C.red, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>esci</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {showAdmin && <AdminModal {...adminProps()} />}
    </div>
  );

  function adminProps() {
    return {
      config, adminAuthed, adminPinInput, setAdminPinInput, enterAdmin, adminMsg,
      newGroupPin, setNewGroupPin, changeGroupPin, newAdminPin, setNewAdminPin, changeAdminPin,
      confirmReset, setConfirmReset, resetMatch, fillTest,
      close: () => { setShowAdmin(false); setAdminMsg(""); setConfirmReset(false); },
    };
  }
}

function AdminModal({ config, adminAuthed, adminPinInput, setAdminPinInput, enterAdmin, adminMsg, newGroupPin, setNewGroupPin, changeGroupPin, newAdminPin, setNewAdminPin, changeAdminPin, confirmReset, setConfirmReset, resetMatch, fillTest, close }) {
  const firstTime = !config.adminPin;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={close}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, width: "100%", maxWidth: 380, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.chalk }}>Pannello organizzatore</h2>
          <button onClick={close} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {!adminAuthed ? (
          <>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 0 }}>{firstTime ? "Primo accesso: scegli il tuo PIN admin." : "Inserisci il tuo PIN admin."}</p>
            <input value={adminPinInput} onChange={e => setAdminPinInput(e.target.value)} onKeyDown={e => e.key === "Enter" && enterAdmin()} placeholder={firstTime ? "Nuovo PIN admin" : "PIN admin"} style={{ ...inp, width: "100%", marginBottom: 10, boxSizing: "border-box" }} />
            <button onClick={enterAdmin} style={{ ...btnPrimary, width: "100%" }}>{firstTime ? "Imposta ed entra" : "Entra"}</button>
            {adminMsg && <div style={{ color: C.amber, fontSize: 12, marginTop: 10 }}>{adminMsg}</div>}
          </>
        ) : (
          <>
            <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted }}>PIN gruppo attuale:</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.amber, letterSpacing: 2 }}>{config.groupPin}</div>
            </div>
            <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Cambia PIN gruppo</div>
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <input value={newGroupPin} onChange={e => setNewGroupPin(e.target.value)} placeholder="Nuovo PIN gruppo" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
              <button onClick={changeGroupPin} style={{ ...btnPrimary, width: "100%" }}>Salva PIN gruppo</button>
            </div>
            <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Cambia PIN admin</div>
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <input value={newAdminPin} onChange={e => setNewAdminPin(e.target.value)} placeholder="Nuovo PIN admin" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
              <button onClick={changeAdminPin} style={{ ...btnPrimary, width: "100%" }}>Salva PIN admin</button>
            </div>
            {adminMsg && <div style={{ color: C.green, fontSize: 12, marginBottom: 16 }}>{adminMsg}</div>}
            <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Nuova partita</div>
            <button onClick={() => { fillTest(); close(); }} style={{ ...btnGhost, width: "100%", marginBottom: 10, color: C.green, borderColor: C.green }}>🧪 Riempi posti finti</button>
            {!confirmReset ? (
              <button onClick={() => setConfirmReset(true)} style={{ ...btnGhost, width: "100%", color: C.red, borderColor: C.red }}>🗑 Svuota campo e ricomincia</button>
            ) : (
              <div style={{ background: C.bg, border: `1px solid ${C.red}`, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 10, textAlign: "center" }}>Sicuro? Cancella tutto.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmReset(false)} style={{ ...btnGhost, flex: 1 }}>Annulla</button>
                  <button onClick={() => { resetMatch(); close(); }} style={{ ...btnPrimary, flex: 1, background: C.red, color: "#fff" }}>Sì, azzera</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Screen({ children }) {
  return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui, sans-serif", color: C.chalk, boxSizing: "border-box" }}>{children}</div>;
}
function shuffle(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
function initials(n) { const p = n.trim().split(/\s+/); return (p[0][0] + (p[1]?.[0] || "")).toUpperCase(); }
function fmt(ms) { const s = Math.max(0, Math.round(ms / 1000)); const m = Math.floor(s / 60); const ss = s % 60; return `${m}:${ss.toString().padStart(2, "0")}`; }
function playWhistle(sharedCtx) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = sharedCtx || new Ctx();
    if (ctx.state === "suspended") ctx.resume();
    const trill = (start, dur, vol = 0.5) => {
      const t0 = ctx.currentTime + start;
      const o1 = ctx.createOscillator(); const o2 = ctx.createOscillator();
      o1.type = "sawtooth"; o2.type = "square"; o1.frequency.value = 2950; o2.frequency.value = 3100;
      const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
      lfo.type = "sine"; lfo.frequency.value = 45; lfoG.gain.value = 380;
      lfo.connect(lfoG); lfoG.connect(o1.frequency); lfoG.connect(o2.frequency);
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3000; bp.Q.value = 5;
      const g = ctx.createGain();
      o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
      g.gain.setValueAtTime(vol, t0 + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      [o1, o2, lfo].forEach(o => { o.start(t0); o.stop(t0 + dur); });
    };
    trill(0, 0.22); trill(0.34, 0.22); trill(0.68, 0.8);
  } catch (e) {}
}
const inp = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", color: C.chalk, fontSize: 16, outline: "none" };
const btnPrimary = { background: C.amber, color: "#1a1206", border: "none", borderRadius: 12, padding: "12px 18px", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const btnGhost = { background: "none", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 12, padding: "12px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const linkBtn = { background: "none", border: "none", color: C.amber, fontSize: 13, cursor: "pointer" };
const chip = { border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 14, cursor: "pointer" };
