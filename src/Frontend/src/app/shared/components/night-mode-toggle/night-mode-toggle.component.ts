import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-night-mode-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      class="btn"
      style="min-height: 36px; width: 38px; padding: 0; border-radius: 11px;"
      (click)="toggleScheme()"
      [title]="isDarkRendered() ? 'Modo Noturno Ativo (Toque para Modo Dia Pastel)' : 'Modo Dia Pastel Ativo (Toque para Modo Noturno)'"
      [attr.aria-label]="isDarkRendered() ? 'Alternar para Modo Dia Pastel' : 'Alternar para Modo Noturno'">
      @if (isDarkRendered()) {
        <span aria-hidden="true" style="font-size: 1.05rem;">🌙</span>
      } @else {
        <span aria-hidden="true" style="font-size: 1.05rem;">☀️</span>
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
          this.applyMeta(e.newValue ?? 'light');
          this.isDarkRendered.set(this.computeCurrentRenderedDark());
        }
      });
    }
  }

  toggleScheme(): void {
    const currentlyDark = this.computeCurrentRenderedDark();
    const target: 'light' | 'dark' = currentlyDark ? 'light' : 'dark';
    localStorage.setItem('color-scheme', target);
    this.applyMeta(target);
    this.isDarkRendered.set(target === 'dark');
  }

  private applyMeta(content: 'light' | 'dark' | string): void {
    const metaScheme = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    if (metaScheme) {
      metaScheme.content = content;
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (metaTheme) {
      metaTheme.content = content === 'dark' ? '#0A0B0E' : '#FAF7F2';
    }
  }

  private computeCurrentRenderedDark(): boolean {
    if (typeof document === 'undefined') return false;
    const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    const val = meta?.content ?? localStorage.getItem('color-scheme') ?? 'light';
    return val === 'dark';
  }
}
