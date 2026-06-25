import React, { useState, useEffect, useRef } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import PinScreen from './components/PinScreen';
import MainGame from './components/MainGame';

function AppInner() {
  const { game } = useGame();
  const [pinVerified, setPinVerified] = useState(
    () => sessionStorage.getItem('calcettoPinVerified') === 'true'
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const adminCallbackRef = useRef(null);

  // Expose a callback so AdminLogin in MainGame can trigger admin mode
  useEffect(() => {
    window._calcettoAdminUnlocked = () => setIsAdmin(true);
    return () => { delete window._calcettoAdminUnlocked; };
  }, []);

  // If group PIN changed (e.g. admin reset it), re-verify
  useEffect(() => {
    if (!pinVerified) return;
    if (!game) return;
    // Session storage was set when user last entered pin — nothing to invalidate automatically
    // (they stay in unless they reload and PIN changed)
  }, [game, pinVerified]);

  if (!pinVerified) {
    return <PinScreen onSuccess={() => setPinVerified(true)} />;
  }

  return (
    <MainGame
      isAdmin={isAdmin}
      onAdminLogout={() => setIsAdmin(false)}
    />
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
