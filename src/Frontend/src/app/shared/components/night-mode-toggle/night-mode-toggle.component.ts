import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-night-mode-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="btn"
      (click)="toggleScheme()"
      [attr.aria-label]="isDarkRendered() ? 'Alternar para Modo Diurno' : 'Alternar para Modo Madrugada (Escuro)'">
      @if (isDarkRendered()) {
        <span aria-hidden="true">🌙</span>
        <span>Modo Madrugada (Ativo)</span>
      } @else {
        <span aria-hidden="true">☀️</span>
        <span>Modo Diurno</span>
      }
    </button>
  `
})
export class NightModeToggleComponent {
  readonly isDarkRendered = signal<boolean>(this.computeCurrentRenderedDark());

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'color-scheme') {
          this.applyMeta(e.newValue ?? 'light dark');
          this.isDarkRendered.set(this.computeCurrentRenderedDark());
        }
      });
    }
  }

  toggleScheme(): void {
    const currentlyDark = this.computeCurrentRenderedDark();
    const target: 'light' | 'dark' = currentlyDark ? 'light' : 'dark';
    const systemPrefersDark = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const systemScheme: 'light' | 'dark' = systemPrefersDark ? 'dark' : 'light';

    if (target === systemScheme) {
      localStorage.removeItem('color-scheme');
      this.applyMeta('light dark');
    } else {
      localStorage.setItem('color-scheme', target);
      this.applyMeta(target);
    }

    this.isDarkRendered.set(target === 'dark');
  }

  private applyMeta(content: string): void {
    const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    if (meta) {
      meta.content = content;
    }
  }

  private computeCurrentRenderedDark(): boolean {
    if (typeof document === 'undefined') return true;
    const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    const val = meta?.content ?? localStorage.getItem('color-scheme') ?? 'light dark';
    if (val === 'dark') return true;
    if (val === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
