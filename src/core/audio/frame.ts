export interface AudioFrame {
  samples: Float32Array
  sampleRate: number
  time: number // seconds since audio start
}
