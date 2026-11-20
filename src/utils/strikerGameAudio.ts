class StrikerAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(next: boolean): void {
    this.muted = next;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(params: {
    freq: number;
    endFreq?: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
  }): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const start = ctx.currentTime + (params.delay ?? 0);
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = params.type ?? 'triangle';
    osc.frequency.setValueAtTime(params.freq, start);
    if (params.endFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, params.endFreq),
        start + params.duration
      );
    }
    const peak = params.gain ?? 0.14;
    gainNode.gain.setValueAtTime(0.001, start);
    gainNode.gain.linearRampToValueAtTime(peak, start + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.001, start + params.duration);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + params.duration + 0.02);
  }

  public playWhistle(): void {
    this.playTone({ freq: 2150, endFreq: 2350, duration: 0.12, type: 'sine', gain: 0.09 });
    this.playTone({ freq: 2300, endFreq: 1950, duration: 0.18, type: 'sine', gain: 0.08, delay: 0.14 });
  }

  public playKick(power = 1): void {
    this.playTone({
      freq: 170 + power * 60,
      endFreq: 52,
      duration: 0.12,
      type: 'triangle',
      gain: Math.min(0.22, 0.12 * power),
    });
  }

  public playDash(): void {
    this.playTone({ freq: 340, endFreq: 760, duration: 0.14, type: 'sine', gain: 0.11 });
  }

  public playPostClang(): void {
    this.playTone({ freq: 520, endFreq: 490, duration: 0.24, type: 'square', gain: 0.1 });
    this.playTone({ freq: 1040, endFreq: 980, duration: 0.18, type: 'triangle', gain: 0.08 });
  }

  public playTackle(): void {
    this.playTone({ freq: 140, endFreq: 45, duration: 0.19, type: 'sawtooth', gain: 0.14 });
  }

  public playPickup(): void {
    this.playTone({ freq: 587, endFreq: 880, duration: 0.11, type: 'sine', gain: 0.1 });
    this.playTone({ freq: 880, endFreq: 1175, duration: 0.14, type: 'sine', gain: 0.09, delay: 0.07 });
  }

  public playGoal(combo = 1): void {
    const boost = Math.min(1.25, 1 + (combo - 1) * 0.06);
    this.playTone({ freq: 392 * boost, duration: 0.14, type: 'triangle', gain: 0.15 });
    this.playTone({ freq: 523.25 * boost, duration: 0.16, type: 'triangle', gain: 0.15, delay: 0.09 });
    this.playTone({ freq: 659.25 * boost, duration: 0.28, type: 'triangle', gain: 0.17, delay: 0.18 });
  }

  public playRoundClear(): void {
    this.playTone({ freq: 440, duration: 0.12, type: 'triangle', gain: 0.13 });
    this.playTone({ freq: 554.37, duration: 0.14, type: 'triangle', gain: 0.13, delay: 0.1 });
    this.playTone({ freq: 659.25, duration: 0.16, type: 'triangle', gain: 0.14, delay: 0.2 });
    this.playTone({ freq: 880, duration: 0.32, type: 'sine', gain: 0.15, delay: 0.3 });
  }

  public playGameOver(): void {
    this.playTone({ freq: 349.23, endFreq: 311.13, duration: 0.2, type: 'sawtooth', gain: 0.1 });
    this.playTone({ freq: 293.66, endFreq: 220, duration: 0.36, type: 'sawtooth', gain: 0.1, delay: 0.18 });
  }
}

export const strikerAudio = new StrikerAudioEngine();
