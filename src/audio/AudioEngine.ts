interface BgmState {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  drones: OscillatorNode[];
  interval: number;
}

let bgmPlaying: BgmState | null = null;
let cachedMineWavSrc: string | null = null;
let cachedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!cachedAudioCtx) {
    cachedAudioCtx = new AudioContextClass();
  }
  if (cachedAudioCtx.state === 'suspended') {
    cachedAudioCtx.resume();
  }
  return cachedAudioCtx;
}

export function startBgm(onUpdateStatus?: (playing: boolean) => void): boolean {
  const ctx = getAudioContext();
  if (!ctx || bgmPlaying) return false;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  
  const drones = [43.65, 65.41, 87.31].map((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index === 1 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.setValueAtTime(index === 2 ? -9 : index * 5, now);
    gain.gain.setValueAtTime(index === 0 ? 0.18 : 0.08, now);
    osc.connect(gain).connect(filter);
    osc.start(now);
    return osc;
  });

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(420, now);
  filter.Q.setValueAtTime(7, now);
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(0.055, now);
  lfoGain.gain.setValueAtTime(130, now);
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start(now);

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.18, now + 1.2);
  filter.connect(master).connect(ctx.destination);

  const pulse = () => {
    if (!bgmPlaying) return;
    const t = ctx.currentTime + 0.02;
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(54 + Math.random() * 8, t);
    boom.frequency.exponentialRampToValueAtTime(31, t + 0.5);
    boomGain.gain.setValueAtTime(0.0001, t);
    boomGain.gain.exponentialRampToValueAtTime(0.24, t + 0.035);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    boom.connect(boomGain).connect(master);
    boom.start(t);
    boom.stop(t + 0.75);

    if (Math.random() < 0.42) {
      const ring = ctx.createOscillator();
      const ringGain = ctx.createGain();
      ring.type = 'triangle';
      ring.frequency.setValueAtTime(180 + Math.random() * 80, t + 0.15);
      ringGain.gain.setValueAtTime(0.0001, t + 0.15);
      ringGain.gain.exponentialRampToValueAtTime(0.035, t + 0.22);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      ring.connect(ringGain).connect(master);
      ring.start(t + 0.15);
      ring.stop(t + 1.25);
    }
  };

  const intervalId = window.setInterval(pulse, 1850);
  bgmPlaying = { ctx, master, filter, lfo, drones, interval: intervalId };
  pulse();

  if (onUpdateStatus) onUpdateStatus(true);
  return true;
}

export function stopBgm(onUpdateStatus?: (playing: boolean) => void): void {
  if (!bgmPlaying) return;
  const bgm = bgmPlaying;
  const now = bgm.ctx.currentTime;
  clearInterval(bgm.interval);
  bgm.master.gain.cancelScheduledValues(now);
  bgm.master.gain.setTargetAtTime(0.0001, now, 0.25);
  setTimeout(() => {
    bgm.drones.forEach(osc => {
      try { osc.stop(); } catch {}
    });
    try { bgm.lfo.stop(); } catch {}
    bgmPlaying = null;
    if (onUpdateStatus) onUpdateStatus(false);
  }, 450);
}

export function isBgmPlaying(): boolean {
  return bgmPlaying !== null;
}

export function toggleBgm(onUpdateStatus?: (playing: boolean) => void): boolean {
  if (bgmPlaying) {
    stopBgm(onUpdateStatus);
    return false;
  } else {
    return startBgm(onUpdateStatus);
  }
}

export function playMineSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      playFallbackMineSound();
      return;
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.28, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    master.connect(ctx.destination);

    const ring = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ring.type = 'triangle';
    ring.frequency.setValueAtTime(880, now);
    ring.frequency.exponentialRampToValueAtTime(520, now + 0.16);
    ringGain.gain.setValueAtTime(0.32, now);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    ring.connect(ringGain).connect(master);
    ring.start(now);
    ring.stop(now + 0.22);

    const scrape = ctx.createOscillator();
    const scrapeGain = ctx.createGain();
    scrape.type = 'square';
    scrape.frequency.setValueAtTime(130, now + 0.035);
    scrape.frequency.exponentialRampToValueAtTime(75, now + 0.18);
    scrapeGain.gain.setValueAtTime(0.14, now + 0.035);
    scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    scrape.connect(scrapeGain).connect(master);
    scrape.start(now + 0.035);
    scrape.stop(now + 0.2);
  } catch {
    playFallbackMineSound();
  }
}

function playFallbackMineSound(): void {
  try {
    if (!cachedMineWavSrc) {
      cachedMineWavSrc = buildMineSoundWav();
    }
    const sound = new Audio(cachedMineWavSrc);
    sound.volume = 0.42;
    sound.play().catch(() => {});
  } catch {}
}

function buildMineSoundWav(): string {
  const sampleRate = 22050;
  const duration = 0.22;
  const samples = Math.floor(sampleRate * duration);
  const data = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-18 * t);
    const ring = Math.sin(2 * Math.PI * (880 - 1400 * t) * t) * decay;
    const crunch = ((Math.random() * 2 - 1) * Math.exp(-28 * Math.max(0, t - 0.035))) * 0.35;
    data[i] = Math.max(-1, Math.min(1, ring * 0.75 + crunch)) * 32767;
  }

  const bytes: number[] = [];
  const pushText = (text: string) => [...text].forEach(char => bytes.push(char.charCodeAt(0)));
  const push16 = (value: number) => { bytes.push(value & 255, (value >> 8) & 255); };
  const push32 = (value: number) => { bytes.push(value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255); };
  
  pushText("RIFF");
  push32(36 + data.length * 2);
  pushText("WAVEfmt ");
  push32(16);
  push16(1);
  push16(1);
  push32(sampleRate);
  push32(sampleRate * 2);
  push16(2);
  push16(16);
  pushText("data");
  push32(data.length * 2);
  for (const sample of data) push16(sample < 0 ? sample + 65536 : sample);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}
