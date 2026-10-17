import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WakeWindowTimerService {
  readonly lastWakeTimeUtc = signal<Date>(new Date());
  readonly minWindowMinutes = signal<number>(0);
  readonly maxWindowMinutes = signal<number>(0);
  readonly nowUtc = signal<Date>(new Date());

  constructor() {
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.nowUtc.set(new Date());
      }, 30000);
    }
  }

  readonly awakeMinutes = computed(() => {
    const diffMs = this.nowUtc().getTime() - this.lastWakeTimeUtc().getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  });

  readonly remainingToSweetSpotMinutes = computed(() => {
    return Math.max(0, this.minWindowMinutes() - this.awakeMinutes());
  });

  readonly progressPercent = computed(() => {
    const max = Math.max(1, this.maxWindowMinutes());
    return Math.min(100, Math.round((this.awakeMinutes() / max) * 100));
  });

  configureFromBackend(lastWakeIso: string, minMins: number, maxMins: number): void {
    this.lastWakeTimeUtc.set(new Date(lastWakeIso));
    this.minWindowMinutes.set(minMins);
    this.maxWindowMinutes.set(maxMins);
    this.nowUtc.set(new Date());
  }
}
