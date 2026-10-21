import { HILL_CENTER_Z, getStreamCenterZ } from "../world/terrain.js";

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function createNoiseBuffer(context) {
  const duration = 6;
  const length = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let low = 0;
  let mid = 0;

  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    low = low * 0.985 + white * 0.015;
    mid = mid * 0.82 + white * 0.18;
    const fadeIn = Math.min(1, i / 600);
    const fadeOut = Math.min(1, (length - i) / 600);
    data[i] = (low * 5.2 + mid * 0.62) * fadeIn * fadeOut;
  }

  return buffer;
}

export function createAmbience() {
  let context = null;
  let master = null;
  let riverLevel = null;
  let birdLevel = null;
  let started = false;
  let muted = false;
  let birdTimer = 0;
  let lastMixTime = -1;

  function playBirdNote(time, frequency, pan, duration) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = context.createStereoPanner();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 1.32,
      time + duration * 0.42,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 0.84,
      time + duration,
    );

    panner.pan.value = pan;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.034, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(birdLevel);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  function playBirdCall() {
    if (!context) {
      return;
    }
    const now = context.currentTime + 0.03;
    const pan = Math.random() * 1.4 - 0.7;
    const base = 1750 + Math.random() * 1750;
    const noteCount = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < noteCount; i += 1) {
      playBirdNote(
        now + i * (0.09 + Math.random() * 0.035),
        base * (0.94 + i * 0.055 + Math.random() * 0.06),
        pan,
        0.09 + Math.random() * 0.09,
      );
    }
  }

  function scheduleBirdCall() {
    birdTimer = window.setTimeout(
      () => {
        playBirdCall();
        scheduleBirdCall();
      },
      1400 + Math.random() * 3600,
    );
  }

  function startAudio() {
    if (started) {
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    context = new AudioContextClass();
    context.resume().catch(() => {});
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(context.destination);

    riverLevel = context.createGain();
    riverLevel.gain.value = 0.7;
    riverLevel.connect(master);
    birdLevel = context.createGain();
    birdLevel.gain.value = 0.8;
    birdLevel.connect(master);

    const noiseBuffer = createNoiseBuffer(context);
    const streamSource = context.createBufferSource();
    const streamHigh = context.createBiquadFilter();
    const streamLow = context.createBiquadFilter();
    const streamGain = context.createGain();
    const streamPan = context.createStereoPanner();
    const trickleSource = context.createBufferSource();
    const trickleFilter = context.createBiquadFilter();
    const trickleGain = context.createGain();
    const tricklePan = context.createStereoPanner();
    const ripple = context.createOscillator();
    const rippleDepth = context.createGain();

    streamSource.buffer = noiseBuffer;
    streamSource.loop = true;
    streamHigh.type = "highpass";
    streamHigh.frequency.value = 110;
    streamLow.type = "lowpass";
    streamLow.frequency.value = 880;
    streamLow.Q.value = 0.45;
    streamGain.gain.value = 0.074;
    streamPan.pan.value = -0.12;

    streamSource.connect(streamHigh);
    streamHigh.connect(streamLow);
    streamLow.connect(streamGain);
    streamGain.connect(streamPan);
    streamPan.connect(riverLevel);
    streamSource.start();

    trickleSource.buffer = noiseBuffer;
    trickleSource.loop = true;
    trickleFilter.type = "bandpass";
    trickleFilter.frequency.value = 2100;
    trickleFilter.Q.value = 0.85;
    trickleGain.gain.value = 0.016;
    tricklePan.pan.value = 0.2;

    trickleSource.connect(trickleFilter);
    trickleFilter.connect(trickleGain);
    trickleGain.connect(tricklePan);
    tricklePan.connect(riverLevel);
    trickleSource.start(0, 2.7);

    ripple.type = "sine";
    ripple.frequency.value = 0.13;
    rippleDepth.gain.value = 0.017;
    ripple.connect(rippleDepth);
    rippleDepth.connect(streamGain.gain);
    ripple.start();

    started = true;
    startEvents.forEach((type) => {
      window.removeEventListener(type, startAudio, { capture: true });
    });
    scheduleBirdCall();
  }

  function toggleMute() {
    muted = !muted;
    if (master && context) {
      master.gain.setTargetAtTime(muted ? 0 : 0.7, context.currentTime, 0.08);
    }
  }

  function onKeyDown(event) {
    if (event.code === "KeyM" && !event.repeat) {
      toggleMute();
    }
  }

  const startEvents = ["pointerdown", "keydown", "touchstart"];
  startEvents.forEach((type) => {
    window.addEventListener(type, startAudio, { capture: true });
  });
  window.addEventListener("keydown", onKeyDown);

  return {
    update(position) {
      if (!started || !position || !context) {
        return;
      }
      const streamDistance = Math.abs(
        position.z - getStreamCenterZ(position.x),
      );
      const treeDistance = Math.hypot(position.x, position.z - HILL_CENTER_Z);
      const streamFactor = 1 - smoothstep(8, 65, streamDistance);
      const treeFactor = 1 - smoothstep(10, 75, treeDistance);
      const now = context.currentTime;
      if (now - lastMixTime < 0.15) {
        return;
      }
      lastMixTime = now;

      riverLevel.gain.setTargetAtTime(streamFactor, now, 0.35);
      birdLevel.gain.setTargetAtTime(treeFactor, now, 0.4);
    },
    get muted() {
      return muted;
    },
    dispose() {
      startEvents.forEach((type) => {
        window.removeEventListener(type, startAudio, { capture: true });
      });
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(birdTimer);
      context?.close();
      context = null;
      started = false;
    },
  };
}
