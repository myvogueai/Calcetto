export const generateUserId = () => {
  const stored = localStorage.getItem('calcettoUserId');
  if (stored) return stored;
  const id = `u_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  localStorage.setItem('calcettoUserId', id);
  return id;
};

export const FAKE_NAMES = [
  'Ronaldo', 'Messi', 'Neymar', 'Mbappé', 'Modric',
  'Kroos', 'Benzema', 'Salah', 'De Bruyne', 'Lewandowski',
];

export const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const formatTime = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export const POSITION_LABELS = ['Portiere', 'Difensore', 'Difensore', 'Attaccante', 'Attaccante'];
