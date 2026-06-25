import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { shuffleArray, FAKE_NAMES, generateUserId } from '../utils/helpers';

const GameContext = createContext(null);

const DEFAULT_GAME = {
  groupPin: 'CALCE2026',
  adminPin: '',
  teamA: [null, null, null, null, null],
  teamB: [null, null, null, null, null],
  waitingList: [],
  shuffleVotes: {},
  timer: {
    durationSeconds: 0,
    endTime: null,
    pausedAt: null,
    remainingAtPause: 0,
    isRunning: false,
    isFinished: false,
  },
};

export function GameProvider({ children }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userId = useMemo(() => generateUserId(), []);
  const gameRef = useMemo(() => doc(db, 'calcetto', 'main'), []);

  useEffect(() => {
    let unsub;
    const init = async () => {
      try {
        const snap = await getDoc(gameRef);
        if (!snap.exists()) {
          await setDoc(gameRef, DEFAULT_GAME);
        }
        unsub = onSnapshot(
          gameRef,
          (snapshot) => {
            if (snapshot.exists()) setGame(snapshot.data());
            setLoading(false);
          },
          (err) => {
            setError('Errore di connessione Firebase: ' + err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        setError('Impossibile connettersi al database: ' + err.message);
        setLoading(false);
      }
    };
    init();
    return () => unsub?.();
  }, [gameRef]);

  // ─── Derived state ───────────────────────────────────────────
  const currentSlot = useMemo(() => {
    if (!game) return null;
    for (let i = 0; i < 5; i++) {
      if (game.teamA?.[i]?.userId === userId) return { team: 'teamA', index: i };
      if (game.teamB?.[i]?.userId === userId) return { team: 'teamB', index: i };
    }
    return null;
  }, [game, userId]);

  const waitingIndex = useMemo(
    () => game?.waitingList?.findIndex((p) => p.userId === userId) ?? -1,
    [game, userId]
  );

  const hasVotedShuffle = useMemo(
    () => !!game?.shuffleVotes?.[userId],
    [game, userId]
  );

  const totalPlayers = useMemo(() => {
    if (!game) return 0;
    return (
      (game.teamA?.filter(Boolean).length ?? 0) +
      (game.teamB?.filter(Boolean).length ?? 0)
    );
  }, [game]);

  const isFull = totalPlayers === 10;

  const shuffleVoteCount = useMemo(
    () => Object.keys(game?.shuffleVotes ?? {}).length,
    [game]
  );

  const shuffleVoteThreshold = useMemo(
    () => Math.max(2, Math.ceil(totalPlayers * 0.6)),
    [totalPlayers]
  );

  // ─── Actions ─────────────────────────────────────────────────
  const claimSlot = useCallback(
    async (team, slotIndex, playerName) => {
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(gameRef);
          const data = snap.data();

          if (data[team][slotIndex] !== null) throw new Error('Posto già occupato');

          const alreadyOn = [...data.teamA, ...data.teamB].some(
            (s) => s?.userId === userId
          );
          if (alreadyOn) throw new Error('Hai già un posto in campo');

          const newTeam = [...data[team]];
          newTeam[slotIndex] = { name: playerName, userId };

          const newWaiting = data.waitingList.filter((p) => p.userId !== userId);

          tx.update(gameRef, { [team]: newTeam, waitingList: newWaiting });
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [gameRef, userId]
  );

  const exitSlot = useCallback(async () => {
    if (!currentSlot) return;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(gameRef);
        const data = snap.data();

        const newTeam = [...data[currentSlot.team]];
        const newVotes = { ...data.shuffleVotes };
        delete newVotes[userId];

        const updates = { shuffleVotes: newVotes };

        if (data.waitingList.length > 0) {
          // Auto-promote first in waiting list
          const [promoted, ...rest] = data.waitingList;
          newTeam[currentSlot.index] = { name: promoted.name, userId: promoted.userId };
          updates.waitingList = rest;
        } else {
          newTeam[currentSlot.index] = null;
          updates.waitingList = data.waitingList;
        }
        updates[currentSlot.team] = newTeam;

        // If timer was running and field no longer full after exit, keep it running
        // (timer continues regardless — admin resets it manually)
        tx.update(gameRef, updates);
      });
    } catch (err) {
      setError(err.message);
    }
  }, [currentSlot, gameRef, userId]);

  const updatePlayerName = useCallback(
    async (newName) => {
      if (!currentSlot) return;
      try {
        const snap = await getDoc(gameRef);
        const data = snap.data();
        const newTeam = [...data[currentSlot.team]];
        newTeam[currentSlot.index] = { ...newTeam[currentSlot.index], name: newName };
        await updateDoc(gameRef, { [currentSlot.team]: newTeam });
      } catch (err) {
        setError(err.message);
      }
    },
    [currentSlot, gameRef]
  );

  const addToWaitingList = useCallback(
    async (playerName) => {
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(gameRef);
          const data = snap.data();

          if (data.waitingList.some((p) => p.userId === userId))
            throw new Error('Sei già in lista d\'attesa');

          const newList = [
            ...data.waitingList,
            { name: playerName, userId, addedAt: Date.now() },
          ];
          tx.update(gameRef, { waitingList: newList });
        });
      } catch (err) {
        setError(err.message);
      }
    },
    [gameRef, userId]
  );

  const removeFromWaitingList = useCallback(async () => {
    try {
      const snap = await getDoc(gameRef);
      const data = snap.data();
      await updateDoc(gameRef, {
        waitingList: data.waitingList.filter((p) => p.userId !== userId),
      });
    } catch (err) {
      setError(err.message);
    }
  }, [gameRef, userId]);

  const voteForShuffle = useCallback(async () => {
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(gameRef);
        const data = snap.data();
        const newVotes = { ...data.shuffleVotes };

        if (newVotes[userId]) {
          delete newVotes[userId];
          tx.update(gameRef, { shuffleVotes: newVotes });
          return;
        }

        newVotes[userId] = true;
        const onField = [...data.teamA, ...data.teamB].filter(Boolean);
        const threshold = Math.max(2, Math.ceil(onField.length * 0.6));

        if (Object.keys(newVotes).length >= threshold && onField.length >= 2) {
          const players = shuffleArray(onField);
          const slotsA = data.teamA.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
          const slotsB = data.teamB.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);

          const newTeamA = Array(5).fill(null);
          const newTeamB = Array(5).fill(null);
          let pi = 0;
          slotsA.forEach((slot) => { if (pi < players.length) newTeamA[slot] = players[pi++]; });
          slotsB.forEach((slot) => { if (pi < players.length) newTeamB[slot] = players[pi++]; });

          tx.update(gameRef, { teamA: newTeamA, teamB: newTeamB, shuffleVotes: {} });
        } else {
          tx.update(gameRef, { shuffleVotes: newVotes });
        }
      });
    } catch (err) {
      setError(err.message);
    }
  }, [gameRef, userId]);

  // ─── Timer actions (admin only) ───────────────────────────────
  const startTimer = useCallback(
    async (durationMinutes) => {
      const durationSeconds = durationMinutes * 60;
      await updateDoc(gameRef, {
        timer: {
          durationSeconds,
          endTime: Date.now() + durationSeconds * 1000,
          pausedAt: null,
          remainingAtPause: durationSeconds,
          isRunning: true,
          isFinished: false,
        },
      });
    },
    [gameRef]
  );

  const pauseTimer = useCallback(async () => {
    if (!game?.timer?.isRunning) return;
    const remaining = Math.max(0, Math.round((game.timer.endTime - Date.now()) / 1000));
    await updateDoc(gameRef, {
      'timer.isRunning': false,
      'timer.pausedAt': Date.now(),
      'timer.remainingAtPause': remaining,
    });
  }, [gameRef, game]);

  const resumeTimer = useCallback(async () => {
    if (game?.timer?.isRunning) return;
    const remaining = game?.timer?.remainingAtPause ?? 0;
    await updateDoc(gameRef, {
      'timer.isRunning': true,
      'timer.endTime': Date.now() + remaining * 1000,
      'timer.pausedAt': null,
    });
  }, [gameRef, game]);

  const addFiveMinutes = useCallback(async () => {
    if (!game?.timer) return;
    if (game.timer.isRunning) {
      await updateDoc(gameRef, {
        'timer.endTime': (game.timer.endTime ?? Date.now()) + 300_000,
        'timer.durationSeconds': game.timer.durationSeconds + 300,
      });
    } else {
      await updateDoc(gameRef, {
        'timer.remainingAtPause': (game.timer.remainingAtPause ?? 0) + 300,
        'timer.durationSeconds': game.timer.durationSeconds + 300,
      });
    }
  }, [gameRef, game]);

  const resetTimer = useCallback(async () => {
    await updateDoc(gameRef, {
      timer: {
        durationSeconds: 0,
        endTime: null,
        pausedAt: null,
        remainingAtPause: 0,
        isRunning: false,
        isFinished: false,
      },
    });
  }, [gameRef]);

  const markTimerFinished = useCallback(async () => {
    await updateDoc(gameRef, {
      'timer.isRunning': false,
      'timer.isFinished': true,
      'timer.remainingAtPause': 0,
    });
  }, [gameRef]);

  // ─── Admin actions ───────────────────────────────────────────
  const verifyAdminPin = useCallback(
    (pin) => {
      if (!game || !game.adminPin) return false;
      return game.adminPin === pin;
    },
    [game]
  );

  const setGroupPin = useCallback(
    async (newPin) => updateDoc(gameRef, { groupPin: newPin }),
    [gameRef]
  );

  const setAdminPin = useCallback(
    async (newPin) => updateDoc(gameRef, { adminPin: newPin }),
    [gameRef]
  );

  const newGame = useCallback(async () => {
    await updateDoc(gameRef, {
      teamA: [null, null, null, null, null],
      teamB: [null, null, null, null, null],
      waitingList: [],
      shuffleVotes: {},
      timer: {
        durationSeconds: 0,
        endTime: null,
        pausedAt: null,
        remainingAtPause: 0,
        isRunning: false,
        isFinished: false,
      },
    });
  }, [gameRef]);

  const fillWithFakePlayers = useCallback(async () => {
    const names = shuffleArray([...FAKE_NAMES]);
    const teamA = names.slice(0, 5).map((name, i) => ({
      name,
      userId: `fake_a${i}_${Date.now()}`,
    }));
    const teamB = names.slice(5, 10).map((name, i) => ({
      name,
      userId: `fake_b${i}_${Date.now()}`,
    }));
    await updateDoc(gameRef, { teamA, teamB });
  }, [gameRef]);

  // ─── Context value ────────────────────────────────────────────
  const value = {
    game,
    loading,
    error,
    userId,
    currentSlot,
    waitingIndex,
    hasVotedShuffle,
    totalPlayers,
    isFull,
    shuffleVoteCount,
    shuffleVoteThreshold,
    claimSlot,
    exitSlot,
    updatePlayerName,
    addToWaitingList,
    removeFromWaitingList,
    voteForShuffle,
    startTimer,
    pauseTimer,
    resumeTimer,
    addFiveMinutes,
    resetTimer,
    markTimerFinished,
    verifyAdminPin,
    setGroupPin,
    setAdminPin,
    newGame,
    fillWithFakePlayers,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};
