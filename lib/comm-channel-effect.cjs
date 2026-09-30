'use strict';

const assert = require('node:assert/strict');

// Comm-channel ("remote terminal") voice effect for Herta TTS output.
//
// `terminal` is the legacy clean tone. `terminal_textured` adds the faint,
// speech-following noise selected by listening on 2026-09-05. Different-text
// game references guide the tone but do not identify the game's exact filter
// or prove whether it adds noise. See docs/COMM_CHANNEL_EFFECT.md.
//
// Pure JavaScript, no external dependencies. Mono samples; 24/48 kHz tested.

const BUTTER4_Q = [0.5411961, 1.306563];

const COMM_CHANNEL_PRESETS = {
  terminal: {
    // Measured low-cut was 597 Hz / 4th order; softened after listening so a
    // nasal 嗯 keeps enough of its hum to stay recognizable.
    highpassHz: 400,
    highpassOrder: 2,
    peakHz: 1418,
    peakDb: 12.0,
    peakQ: 1.44,
    lowpass1Hz: 2625,
    lowpass2Hz: 5527,
    drive: 1.5,
  },
};

COMM_CHANNEL_PRESETS.terminal_textured = {
  ...COMM_CHANNEL_PRESETS.terminal,
  noiseRelativeDb: -34,
};

// RBJ Audio EQ Cookbook biquads, normalized so a0 = 1.
function rbj(kind, f0, q, fs, gainDb = 0) {
  const w0 = (2 * Math.PI * f0) / fs;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const alpha = sw / (2 * q);
  let b0;
  let b1;
  let b2;
  let a0;
  let a1;
  let a2;
  if (kind === 'lowpass') {
    b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
  } else if (kind === 'highpass') {
    b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
    a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
  } else if (kind === 'peaking') {
    const A = 10 ** (gainDb / 40);
    b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
    a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
  } else {
    throw new Error(`Unknown biquad kind: ${kind}`);
  }
  return {b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0};
}

function channelSections(preset, fs) {
  const highpass = preset.highpassOrder === 2
    ? [rbj('highpass', preset.highpassHz, 0.7071068, fs)]
    : [
      rbj('highpass', preset.highpassHz, BUTTER4_Q[0], fs),
      rbj('highpass', preset.highpassHz, BUTTER4_Q[1], fs),
    ];
  return [
    ...highpass,
    rbj('peaking', preset.peakHz, preset.peakQ, fs, preset.peakDb),
    rbj('lowpass', preset.lowpass1Hz, 0.7071068, fs),
    rbj('lowpass', preset.lowpass2Hz, BUTTER4_Q[0], fs),
    rbj('lowpass', preset.lowpass2Hz, BUTTER4_Q[1], fs),
  ];
}

// Direct form II transposed cascade over Float64Array input; returns a new array.
function runCascade(sections, input) {
  const out = new Float64Array(input);
  for (const s of sections) {
    let z1 = 0;
    let z2 = 0;
    for (let i = 0; i < out.length; i += 1) {
      const x = out[i];
      const y = s.b0 * x + z1;
      z1 = s.b1 * x - s.a1 * y + z2;
      z2 = s.b2 * x - s.a2 * y;
      out[i] = y;
    }
  }
  return out;
}

// Linear-interpolated percentile (same convention as numpy's default).
function percentile(values, p) {
  const sorted = Float64Array.from(values).sort();
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(index);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

// RMS level (dB) of the loud speech frames: 25 ms frames at or above the 80th
// percentile frame level minus 8 dB. Used to keep perceived loudness constant.
function loudFrameDb(x, fs) {
  const hop = Math.floor(fs * 0.025);
  const count = Math.floor((x.length - hop) / hop);
  if (count <= 0) {
    let sum = 0;
    for (let i = 0; i < x.length; i += 1) sum += x[i] * x[i];
    return 10 * Math.log10(sum / Math.max(1, x.length) + 1e-12);
  }
  const frameDb = new Float64Array(count);
  const frameEnergy = new Float64Array(count);
  for (let f = 0; f < count; f += 1) {
    let sum = 0;
    for (let i = f * hop; i < (f + 1) * hop; i += 1) sum += x[i] * x[i];
    frameEnergy[f] = sum;
    frameDb[f] = 10 * Math.log10(sum / hop + 1e-12);
  }
  const threshold = percentile(frameDb, 80) - 8;
  let energy = 0;
  let samples = 0;
  for (let f = 0; f < count; f += 1) {
    if (frameDb[f] >= threshold) {
      energy += frameEnergy[f];
      samples += hop;
    }
  }
  return 10 * Math.log10(energy / Math.max(1, samples) + 1e-12);
}

function scaleInPlace(x, gain) {
  for (let i = 0; i < x.length; i += 1) x[i] *= gain;
}

function resolvePreset(options) {
  const base = typeof options.preset === 'string'
    ? COMM_CHANNEL_PRESETS[options.preset]
    : (options.preset || COMM_CHANNEL_PRESETS.terminal);
  if (!base) throw new Error(`Unknown comm-channel preset: ${options.preset}`);
  return {...base, ...options, preset: undefined};
}

/**
 * Apply the comm-channel effect.
 * @param {Float32Array|Float64Array|number[]} samples mono PCM in [-1, 1]
 * @param {number} sampleRate
 * @param {object} [options] preset name or overrides (see COMM_CHANNEL_PRESETS)
 * @returns {Float32Array}
 */
function applyTone(samples, sampleRate, options = {}) {
  if (!samples || samples.length === 0) return new Float32Array(0);
  if (!(sampleRate > 0)) throw new Error(`Invalid sample rate: ${sampleRate}`);
  const preset = resolvePreset(options);
  const fs = sampleRate;
  const input = Float64Array.from(samples);
  const inputLoudDb = loudFrameDb(input, fs);

  // 1. band-limit, then restore the loud-frame level lost to the filtering
  const y = runCascade(channelSections(preset, fs), input);
  scaleInPlace(y, 10 ** ((inputLoudDb - loudFrameDb(y, fs)) / 20));

  // 2. mild soft saturation with unity small-signal gain, then re-level
  const drive = preset.drive;
  if (drive > 0) {
    for (let i = 0; i < y.length; i += 1) y[i] = Math.tanh(drive * y[i]) / drive;
    scaleInPlace(y, 10 ** ((inputLoudDb - loudFrameDb(y, fs)) / 20));
  }

  const out = new Float32Array(y.length);
  for (let i = 0; i < y.length; i += 1) out[i] = Math.max(-1, Math.min(1, y[i]));
  return out;
}

function rms(x) {
  let sum = 0;
  for (const v of x) sum += v * v;
  return Math.sqrt(sum / Math.max(x.length, 1));
}

function peak(x) {
  let result = 0;
  for (const v of x) {
    assert(Number.isFinite(v), 'Non-finite sample');
    result = Math.max(result, Math.abs(v));
  }
  return result;
}

function activeRms(x, rate) {
  const n = Math.max(1, Math.round(.025 * rate));
  const energies = [];
  for (let start = 0; start < x.length; start += n) {
    let sum = 0;
    const count = Math.min(n, x.length - start);
    for (let i = start; i < start + count; i += 1) sum += x[i] * x[i];
    energies.push(sum / count);
  }
  if (!energies.length) return 0;
  const sorted = [...energies].sort((a, b) => a - b);
  const threshold = sorted[Math.floor((sorted.length - 1) * .8)] * 10 ** (-8 / 10);
  const selected = energies.filter(v => v >= threshold);
  return Math.sqrt(selected.reduce((a, b) => a + b, 0) / selected.length);
}

function section(kind, hz, rate) {
  const w = 2 * Math.PI * hz / rate;
  const c = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const b0 = (kind === 'highpass' ? 1 + c : 1 - c) / 2;
  const b1 = kind === 'highpass' ? -(1 + c) : 1 - c;
  return [b0 / a0, b1 / a0, b0 / a0, -2 * c / a0, (1 - alpha) / a0];
}

function filterInPlace(x, coefficients) {
  const [b0, b1, b2, a1, a2] = coefficients;
  let z1 = 0;
  let z2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const source = x[i];
    const y = b0 * source + z1;
    z1 = b1 * source - a1 * y + z2;
    z2 = b2 * source - a2 * y;
    x[i] = y;
  }
}

function addSpeechTexture(wet, rate, relativeDb, seed = 0x48727461) {
  // Band-shaped, deterministic noise for repeatable A/B, not sampled game audio.
  const noise = new Float64Array(wet.length);
  let state = seed >>> 0;
  for (let i = 0; i < noise.length; i += 1) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    noise[i] = (state >>> 0) / 0x100000000 * 2 - 1;
  }
  filterInPlace(noise, section('highpass', 900, rate));
  filterInPlace(noise, section('lowpass', 4000, rate));
  const speech = activeRms(wet, rate);
  if (speech < 1e-9) return Float32Array.from(wet);
  const noiseGain = speech * 10 ** (relativeDb / 20) / Math.max(rms(noise), 1e-12);
  const attack = Math.exp(-1 / (rate * .010));
  const release = Math.exp(-1 / (rate * .060));
  let power = 0;
  const out = new Float32Array(wet.length);
  for (let i = 0; i < out.length; i += 1) {
    const p = wet[i] * wet[i];
    const coefficient = p > power ? attack : release;
    power = coefficient * power + (1 - coefficient) * p;
    const amplitude = Math.sqrt(power);
    const db = 20 * Math.log10(amplitude + 1e-12);
    let gate = Math.max(0, Math.min(1, (db + 65) / 20));
    gate = gate * gate * (3 - 2 * gate);
    const envelope = gate * Math.min(1, amplitude / speech);
    out[i] = wet[i] + noise[i] * noiseGain * envelope;
  }
  return out;
}

function applyTexturedChannel(samples, rate, options, toneProcessor) {
  if (!Number.isFinite(rate) || rate < 16000) throw new Error('Textured terminal requires a sample rate of at least 16 kHz');
  // Existing helper clamps at +/-1. Run with internal headroom and compensate
  // drive so its intended saturation is unchanged; restore gain before final
  // shared playback scaling. No transient is hard-clipped by this wrapper.
  let headroom = .125 / Math.max(1, peak(samples));
  let wet;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scaled = Float32Array.from(samples, v => v * headroom);
    const drive = options.drive ?? COMM_CHANNEL_PRESETS.terminal.drive;
    wet = toneProcessor(scaled, rate, {...options, drive: drive / headroom});
    if (peak(wet) < .98) break;
    headroom *= .5;
    wet = null;
  }
  assert(wet, 'Unable to obtain unclipped processing headroom');
  wet = Float32Array.from(wet, v => v / headroom);
  if (options.noiseRelativeDb !== undefined) {
    wet = addSpeechTexture(wet, rate, options.noiseRelativeDb);
  }
  const outputPeak = peak(wet);
  if (outputPeak > .98) {
    const gain = .98 / outputPeak;
    wet = Float32Array.from(wet, value => value * gain);
  }
  return wet;
}

/** Apply an optional terminal tone; the approved textured preset is explicit. */
function applyCommChannel(samples, sampleRate, options = {}) {
  if (!Number.isFinite(sampleRate) || sampleRate < 16000) {
    throw new Error('Comm-channel effect requires a sample rate of at least 16 kHz');
  }
  const preset = resolvePreset(options);
  if (!samples || samples.length === 0) return new Float32Array(0);
  peak(samples); // Reject non-finite samples before DSP.
  if (preset.noiseRelativeDb !== undefined) {
    if (!Number.isFinite(preset.noiseRelativeDb) || preset.noiseRelativeDb > 0) {
      throw new Error('noiseRelativeDb must be a finite value <= 0');
    }
    return applyTexturedChannel(samples, sampleRate, preset, applyTone);
  }
  return applyTone(samples, sampleRate, preset);
}

module.exports = {COMM_CHANNEL_PRESETS, applyCommChannel};
