const NOTES: Record<string, number> = {
  C3: 130.81, 'C#3': 138.59, G3: 196, A3: 220, C4: 261.63, 'C#4': 277.18, D4: 293.66, E4: 329.63, G4: 392,
  A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77,
};

const MELODY = [
  'E5', 'G5', 'A5', 'G5', 'E5', 'D5', 'C5', null,
  'D5', 'E5', 'G5', 'E5', 'D5', 'C5', 'D5', null,
  'E5', 'G5', 'B5', 'A5', 'G5', 'E5', 'D5', 'C5',
  'A4', 'C5', 'E5', 'D5', 'C5', null, 'G4', null,
];

const BASS = [
  'C4', null, null, null, 'G3', null, null, null,
  'D4', null, null, null, 'G3', null, null, null,
  'A3', null, null, null, 'E4', null, null, null,
  'D4', null, null, null, 'G3', null, null, null,
];

const DANGER_MELODY = ['C4', 'C#4', 'G4', 'C#4', 'C4', null, 'C#4', null, 'G4', 'C#4', 'C4', 'G4', 'C#4', null, 'C4', null];
const DANGER_BASS = ['C3', null, 'C#3', null, 'C3', null, 'G3', null, 'C#3', null, 'C3', null, 'G3', null, 'C#3', null];

export class MoonlightMusic {
  private context?: AudioContext;
  private master?: GainNode;
  private timer?: number;
  private step = 0;
  private nextNoteTime = 0;
  private readonly stepDuration = 60 / 116 / 2;
  private dangerMode = false;
  enabled = localStorage.getItem('bubblebubble.music') !== 'off';

  constructor(private readonly button: HTMLButtonElement) { this.updateButton(); }

  async start(): Promise<void> {
    if (!this.enabled) return;
    if (!this.context) this.createGraph();
    if (!this.context || !this.master) return;
    if (this.context.state === 'suspended') await this.context.resume();
    this.master.gain.setTargetAtTime(0.085, this.context.currentTime, 0.04);
    if (this.timer) return;
    this.nextNoteTime = this.context.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  async toggle(): Promise<void> {
    this.enabled = !this.enabled;
    localStorage.setItem('bubblebubble.music', this.enabled ? 'on' : 'off');
    this.updateButton();
    if (this.enabled) await this.start();
    else if (this.master && this.context) {
      this.master.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.04);
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  setDangerMode(active: boolean): void {
    if (this.dangerMode === active) return;
    this.dangerMode = active;
    this.step = 0;
    if (!this.context || !this.enabled) return;
    this.nextNoteTime = this.context.currentTime + 0.04;
    if (active) {
      this.play('C3', this.context.currentTime + 0.01, 0.75, 'sawtooth', 0.34);
      this.play('C#3', this.context.currentTime + 0.28, 0.9, 'sawtooth', 0.28);
    }
  }

  private createGraph(): void {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    this.context = new Context();
    this.master = this.context.createGain();
    this.master.gain.value = 0.085;
    this.master.connect(this.context.destination);
  }

  private schedule(): void {
    if (!this.context || !this.enabled) return;
    while (this.nextNoteTime < this.context.currentTime + 0.18) {
      const melodyPattern = this.dangerMode ? DANGER_MELODY : MELODY;
      const bassPattern = this.dangerMode ? DANGER_BASS : BASS;
      const duration = this.dangerMode ? 60 / 154 / 2 : this.stepDuration;
      const melody = melodyPattern[this.step];
      const bass = bassPattern[this.step];
      if (melody) this.play(melody, this.nextNoteTime, duration * 0.8, this.dangerMode ? 'sawtooth' : 'triangle', this.dangerMode ? 0.26 : 0.5);
      if (bass) this.play(bass, this.nextNoteTime, duration * 1.8, this.dangerMode ? 'sawtooth' : 'square', this.dangerMode ? 0.2 : 0.1);
      this.step = (this.step + 1) % melodyPattern.length;
      this.nextNoteTime += duration;
    }
  }

  private play(note: string, start: number, duration: number, wave: OscillatorType, volume: number): void {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(NOTES[note], start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private updateButton(): void {
    this.button.textContent = this.enabled ? '♪ 음악 켜짐' : '♪ 음악 꺼짐';
    this.button.setAttribute('aria-pressed', String(this.enabled));
  }
}

declare global {
  interface Window { webkitAudioContext: typeof AudioContext; }
}
