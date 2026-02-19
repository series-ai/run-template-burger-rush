import { AudioSystem } from "@series-inc/rundot-3d-engine/systems"

/**
 * Fill Tone Generator
 * Plays bubbly ascending notes that speed up as fill increases
 */
export class ShepardTone {
  private static instance: ShepardTone | null = null
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private isPlaying: boolean = false
  private timeoutId: number | null = null
  private currentProgress: number = 0

  // Configuration
  private readonly MASTER_VOLUME = 0.08
  private readonly MIN_INTERVAL = 60 // Fastest at 100%
  private readonly MAX_INTERVAL = 220 // Slowest at 0%
  private readonly MIN_FREQ = 300
  private readonly MAX_FREQ = 850

  private constructor() {}

  public static getInstance(): ShepardTone {
    if (!ShepardTone.instance) {
      ShepardTone.instance = new ShepardTone()
    }
    return ShepardTone.instance
  }

  public start(): void {
    if (this.isPlaying) return

    try {
      const listener = AudioSystem.mainListener
      if (!listener) {
        console.warn("Failed to start fill tone: AudioSystem.mainListener not initialized")
        return
      }

      // Use the main Three.js AudioListener context/output so global mute applies.
      this.audioContext = listener.context

      if (this.audioContext.state === "suspended") {
        this.audioContext.resume()
      }

      this.filter = this.audioContext.createBiquadFilter()
      this.filter.type = "lowpass"
      this.filter.frequency.setValueAtTime(1200, this.audioContext.currentTime)
      this.filter.Q.setValueAtTime(2, this.audioContext.currentTime)

      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.setValueAtTime(this.MASTER_VOLUME, this.audioContext.currentTime)

      this.filter.connect(this.masterGain)
      // Route through the listener's master gain so SetAudioMuted / SetMasterVolume affect this tone.
      this.masterGain.connect(listener.gain)

      this.isPlaying = true
      this.scheduleNextNote()
    } catch (error) {
      console.warn("Failed to start fill tone:", error)
    }
  }

  public setProgress(progress: number): void {
    this.currentProgress = Math.max(0, Math.min(1, progress))
  }

  private scheduleNextNote(): void {
    if (!this.isPlaying) return

    this.playNote()

    // Calculate interval - faster as progress increases
    const interval = this.MAX_INTERVAL - (this.MAX_INTERVAL - this.MIN_INTERVAL) * this.currentProgress

    this.timeoutId = window.setTimeout(() => {
      this.scheduleNextNote()
    }, interval)
  }

  private playNote(): void {
    if (!this.audioContext || !this.filter || !this.isPlaying) return

    const now = this.audioContext.currentTime
    const frequency = this.MIN_FREQ + (this.MAX_FREQ - this.MIN_FREQ) * this.currentProgress

    const osc = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency * 1.12, now)
    osc.frequency.setTargetAtTime(frequency, now, 0.02)

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + 0.008)
    gain.gain.setTargetAtTime(0, now + 0.015, 0.04)

    osc.connect(gain)
    gain.connect(this.filter)

    osc.start(now)
    osc.stop(now + 0.15)
  }

  public stop(): void {
    if (!this.isPlaying) return

    this.isPlaying = false

    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.05)
    }

    setTimeout(() => {
      if (this.filter) {
        this.filter.disconnect()
        this.filter = null
      }
      if (this.masterGain) {
        this.masterGain.disconnect()
        this.masterGain = null
      }
    }, 200)
  }

  public getIsPlaying(): boolean {
    return this.isPlaying
  }
}
