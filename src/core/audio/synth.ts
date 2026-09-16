/**
 * Synthesized audio for tests and the dev page. Claude Code can't play a
 * guitar (PLAN.md section 4, constraint 10), so every audio feature has to
 * be verifiable against generated fixtures like these.
 *
 * The noise-excited functions (karplusStrongPluck, whiteNoise) take a seed
 * and default to a fixed one, so calling them with the same arguments
 * always produces the same buffer. That determinism is what makes them
 * usable as test fixtures; pass Date.now() or similar for varied demo audio.
 */

/** A small, fast PRNG (mulberry32) so synthesized audio is reproducible from a seed. */
function createRng(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEFAULT_SEED = 1

export interface PluckOptions {
  sampleRate: number
  durationSeconds: number
  /** Feedback decay per sample, 0..1 exclusive. Closer to 1 sustains longer. Default ~2s decay. */
  decay?: number
  seed?: number
}

/**
 * A plucked-string tone via the classic Karplus-Strong algorithm: a noise
 * burst filtered through a decaying delay line tuned to the target pitch.
 */
export function karplusStrongPluck(hz: number, opts: PluckOptions): Float32Array {
  const { sampleRate, durationSeconds, decay = 0.996, seed = DEFAULT_SEED } = opts
  const rng = createRng(seed)
  const totalSamples = Math.round(sampleRate * durationSeconds)
  const bufferLength = Math.max(2, Math.round(sampleRate / hz))
  const ring = new Float32Array(bufferLength)
  for (let i = 0; i < bufferLength; i++) ring[i] = rng() * 2 - 1

  const output = new Float32Array(totalSamples)
  let index = 0
  for (let n = 0; n < totalSamples; n++) {
    const current = ring[index]
    output[n] = current
    const next = ring[(index + 1) % bufferLength]
    ring[index] = decay * 0.5 * (current + next)
    index = (index + 1) % bufferLength
  }
  return output
}

export interface HarmonicToneOptions {
  sampleRate: number
  durationSeconds: number
  /** Relative amplitude of each harmonic, starting at the fundamental (index 0 = 1st harmonic). */
  harmonicAmplitudes: number[]
  /** Exponential decay rate per second (envelope = e^(-rate * t)). */
  decayPerSecond?: number
}

/**
 * An additive-synthesis tone with explicit control over harmonic balance,
 * used to fabricate a "weak fundamental" test case (PLAN.md section 4,
 * constraint 2): a low string whose 2nd harmonic outweighs its fundamental,
 * which is the classic setup for an octave detection error.
 */
export function harmonicTone(hz: number, opts: HarmonicToneOptions): Float32Array {
  const { sampleRate, durationSeconds, harmonicAmplitudes, decayPerSecond = 3 } = opts
  const totalSamples = Math.round(sampleRate * durationSeconds)
  const totalAmplitude = harmonicAmplitudes.reduce((sum, a) => sum + a, 0)
  const output = new Float32Array(totalSamples)

  for (let n = 0; n < totalSamples; n++) {
    const t = n / sampleRate
    const envelope = Math.exp(-decayPerSecond * t)
    let sample = 0
    for (let h = 0; h < harmonicAmplitudes.length; h++) {
      sample += harmonicAmplitudes[h] * Math.sin(2 * Math.PI * hz * (h + 1) * t)
    }
    output[n] = (sample / totalAmplitude) * envelope
  }
  return output
}

export function whiteNoise(
  sampleCount: number,
  amplitude: number = 1,
  seed: number = DEFAULT_SEED,
): Float32Array {
  const rng = createRng(seed)
  const output = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) output[i] = (rng() * 2 - 1) * amplitude
  return output
}

export function silence(sampleRate: number, durationSeconds: number): Float32Array {
  return new Float32Array(Math.round(sampleRate * durationSeconds))
}

function computeRms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/** Mixes white noise into `signal` so the result has the given signal-to-noise ratio, in dB. */
export function addNoiseAtSnr(
  signal: Float32Array,
  snrDb: number,
  seed: number = DEFAULT_SEED,
): Float32Array {
  const signalRms = computeRms(signal)
  const noiseRms = signalRms / 10 ** (snrDb / 20)
  const amplitude = noiseRms * Math.sqrt(3) // uniform noise on [-a, a] has rms = a / sqrt(3)
  const noise = whiteNoise(signal.length, amplitude, seed)
  const output = new Float32Array(signal.length)
  for (let i = 0; i < signal.length; i++) output[i] = signal[i] + noise[i]
  return output
}

export function concatBuffers(...buffers: Float32Array[]): Float32Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
  const output = new Float32Array(totalLength)
  let offset = 0
  for (const buffer of buffers) {
    output.set(buffer, offset)
    offset += buffer.length
  }
  return output
}
