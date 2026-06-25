export const playWhistle = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playBlast = (startTime, duration, freq = 2800) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Bandpass filtered noise for realism
      const bufSize = Math.floor(ctx.sampleRate * duration);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 20;

      const noiseGain = ctx.createGain();
      noise.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.linearRampToValueAtTime(freq * 0.95, startTime + duration);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.22, startTime + 0.02);
      gain.gain.setValueAtTime(0.22, startTime + duration - 0.04);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);

      noiseGain.gain.setValueAtTime(0, startTime);
      noiseGain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      noiseGain.gain.setValueAtTime(0.12, startTime + duration - 0.04);
      noiseGain.gain.linearRampToValueAtTime(0, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
      noise.start(startTime);
      noise.stop(startTime + duration);
    };

    const t = ctx.currentTime;
    playBlast(t, 0.25, 2900);
    playBlast(t + 0.35, 0.25, 2800);
    playBlast(t + 0.70, 0.85, 2900);

    setTimeout(() => ctx.close().catch(() => {}), 4000);
  } catch (e) {
    console.warn('Web Audio API non disponibile:', e);
  }
};
