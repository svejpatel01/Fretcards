/**
 * Minimal WAV read/write: just enough RIFF/WAVE chunk parsing to load
 * Svej's recordings in Node tests and to write synthesized fixtures for
 * Playwright's fake-audio-capture. Multi-channel input is downmixed to
 * mono by averaging channels.
 */

export interface DecodedWav {
  samples: Float32Array // mono, normalized to [-1, 1]
  sampleRate: number
}

interface WavFormat {
  audioFormat: number // 1 = PCM, 3 = IEEE float
  numChannels: number
  sampleRate: number
  bitsPerSample: number
}

export function decodeWav(data: ArrayBuffer): DecodedWav {
  const view = new DataView(data)
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file')
  }

  let format: WavFormat | null = null
  let samples: Float32Array | null = null
  let offset = 12

  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    const chunkStart = offset + 8

    if (chunkId === 'fmt ') {
      format = {
        audioFormat: view.getUint16(chunkStart, true),
        numChannels: view.getUint16(chunkStart + 2, true),
        sampleRate: view.getUint32(chunkStart + 4, true),
        bitsPerSample: view.getUint16(chunkStart + 14, true),
      }
    } else if (chunkId === 'data') {
      if (!format) throw new Error('WAV data chunk appeared before fmt chunk')
      samples = decodePcmSamples(view, chunkStart, chunkSize, format)
    }

    // Chunks are word-aligned: an odd-sized chunk has one byte of padding.
    offset = chunkStart + chunkSize + (chunkSize % 2)
  }

  if (!format || !samples) throw new Error('WAV file is missing a fmt or data chunk')
  return { samples, sampleRate: format.sampleRate }
}

function readAscii(view: DataView, offset: number, length: number): string {
  let text = ''
  for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint8(offset + i))
  return text
}

function decodePcmSamples(
  view: DataView,
  start: number,
  byteLength: number,
  format: WavFormat,
): Float32Array {
  const { audioFormat, numChannels, bitsPerSample } = format
  const bytesPerSample = bitsPerSample / 8
  const frameCount = Math.floor(byteLength / (bytesPerSample * numChannels))
  const output = new Float32Array(frameCount)

  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0
    for (let channel = 0; channel < numChannels; channel++) {
      const sampleOffset = start + (frame * numChannels + channel) * bytesPerSample
      sum += readSample(view, sampleOffset, bitsPerSample, audioFormat)
    }
    output[frame] = sum / numChannels
  }
  return output
}

function readSample(
  view: DataView,
  offset: number,
  bitsPerSample: number,
  audioFormat: number,
): number {
  if (audioFormat === 3 && bitsPerSample === 32) {
    return view.getFloat32(offset, true)
  }
  switch (bitsPerSample) {
    case 8:
      return (view.getUint8(offset) - 128) / 128
    case 16:
      return view.getInt16(offset, true) / 32768
    case 24: {
      const b0 = view.getUint8(offset)
      const b1 = view.getUint8(offset + 1)
      const b2 = view.getUint8(offset + 2)
      let value = b0 | (b1 << 8) | (b2 << 16)
      if (value & 0x800000) value -= 0x1000000
      return value / 8388608
    }
    case 32:
      return view.getInt32(offset, true) / 2147483648
    default:
      throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`)
  }
}

/** Encodes mono Float32 samples as 16-bit PCM WAV bytes. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true) // byte rate
  view.setUint16(32, bytesPerSample, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, Math.round(clamped * 32767), true)
    offset += bytesPerSample
  }

  return buffer
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}
