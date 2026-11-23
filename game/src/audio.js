// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, chimes and a mission jingle, from oscillators.
export function createAudio() {
  const audio = {
    context: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenTimer: 0,
    sirenHigh: false,
  };

  /** Create the context on the first user gesture (browsers require one). */
  function ensure() {
    if (audio.context) {
      if (audio.context.state === 'suspended') audio.context.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audio.context = new Ctx();
      audio.master = audio.context.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.context.destination);
      audio.engineOsc = audio.context.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 50;
      audio.engineGain = audio.context.createGain();
      audio.engineGain.gain.value = 0;
      const filter = audio.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineOsc.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!audio.context || audio.muted) return;
    const now = audio.context.currentTime;
    const osc = audio.context.createOscillator();
    const gain = audio.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!audio.context || audio.muted) return;
    const now = audio.context.currentTime;
    const length = Math.floor(audio.context.sampleRate * duration);
    const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    const filter = audio.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = audio.context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start(now);
  }

  return {
    unlock: ensure,
    setMuted(muted) {
      audio.muted = muted;
      if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return audio.muted;
    },
    /** Engine pitch follows the car's speed; silent on foot. */
    setEngine(speed, driving) {
      if (!audio.context || audio.muted) return;
      const target = driving ? 0.03 + Math.min(0.1, Math.abs(speed) / 430 * 0.09) : 0;
      audio.engineGain.gain.setTargetAtTime(target, audio.context.currentTime, 0.08);
      audio.engineOsc.frequency.setTargetAtTime(46 + Math.abs(speed) * 0.16, audio.context.currentTime, 0.08);
    },
    /** A two-tone siren that alternates while police are near. */
    sirenTick(dt, policeNear) {
      if (!audio.context || audio.muted) return;
      if (!policeNear) return;
      audio.sirenTimer -= dt;
      if (audio.sirenTimer <= 0) {
        audio.sirenTimer = 0.42;
        audio.sirenHigh = !audio.sirenHigh;
        tone(audio.sirenHigh ? 880 : 660, 0.38, 'sine', 0.045);
      }
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 3200);
      tone(180, 0.09, 'square', 0.18, 60);
    },
    punch() {
      noiseBurst(0.08, 0.3, 900);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.16);
      setTimeout(() => tone(990, 0.12, 'sine', 0.16), 70);
    },
    cash() {
      tone(880, 0.1, 'triangle', 0.2);
      setTimeout(() => tone(1174, 0.14, 'triangle', 0.2), 80);
    },
    crash(intensity) {
      noiseBurst(0.2, Math.min(0.5, 0.15 + intensity * 0.3), 700);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.2), i * 90));
    },
    busted() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.12), i * 140));
    },
    denied() {
      tone(140, 0.16, 'square', 0.14, 90);
    },
  };
}
