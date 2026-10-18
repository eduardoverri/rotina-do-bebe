import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { AuthService } from './core/auth/auth.service';
import { BabyStore } from './core/state/baby.store';
import { RoutineStore } from './core/state/routine.store';
import { OfflineSyncService } from './core/services/offline-sync.service';
import { FamilyRealtimeService } from './core/services/family-realtime.service';
import { PopupAlertService, PopupAlertType } from './core/services/popup-alert.service';
import { BabyAgePipe } from './shared/pipes/baby-age.pipe';
import { NightModeToggleComponent } from './shared/components/night-mode-toggle/night-mode-toggle.component';
import { AlertBannerComponent } from './shared/components/alert-banner/alert-banner.component';
import { QuickActionBarComponent } from './shared/components/quick-action-bar/quick-action-bar.component';
import { GoogleLoginComponent } from './features/auth/google-login.component';
import { ChildrenManagerComponent } from './features/children/children-manager.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { SleepTrackerComponent } from './features/sleep-tracker/sleep-tracker.component';
import { FeedingTrackerComponent } from './features/feeding-tracker/feeding-tracker.component';
import { DiapersTrackerComponent } from './features/diapers-tracker/diapers-tracker.component';
import { HealthComponent } from './features/health-medications/health.component';
import { MilestonesComponent } from './features/milestones/milestones.component';
import { GrowthTrackerComponent } from './features/growth-tracker/growth-tracker.component';
import { PediatricReportComponent } from './features/reports/pediatric-report.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    BabyAgePipe,
    NightModeToggleComponent,
    AlertBannerComponent,
    QuickActionBarComponent,
    GoogleLoginComponent,
    ChildrenManagerComponent,
    DashboardComponent,
    SleepTrackerComponent,
    FeedingTrackerComponent,
    DiapersTrackerComponent,
    HealthComponent,
    MilestonesComponent,
    GrowthTrackerComponent,
    PediatricReportComponent
  ],
  template: `
    <div class="pwa-shell">
      <!-- Stack Global de Alertas Pop-up (Sucesso, Erro, Aviso e Informação) -->
      <app-alert-banner />

      <!-- Cabeçalho PWA Mobile: Nome do Aplicativo + Menu de Navegação Principal -->
      <header class="pwa-header no-print">
        <div class="pwa-topbar">
          <div class="pwa-brand">
            <img src="app-icon.png" alt="Rotina do Bebê" class="pwa-brand-logo" />
            <div style="min-width: 0;">
              <div class="pwa-brand-title">Rotina do Bebê</div>
              @if (authService.isAuthenticated() && babyStore.hasBabies()) {
                <div style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  {{ babyStore.activeBaby().name }} • {{ babyStore.activeBaby() | babyAge }}
                </div>
              }
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.4rem;">
            @if (authService.isAuthenticated() && babyStore.babies().length > 1) {
              <select
                class="input-field"
                style="width: auto; min-height: 36px; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 700;"
                [ngModel]="babyStore.selectedBabyId()"
                (ngModelChange)="onBabyChange($event)"
                aria-label="Alternar filho ativo">
                @for (b of babyStore.babies(); track b.id) {
                  <option [value]="b.id">👶 {{ b.name }}</option>
                }
              </select>
            }

            @if (authService.isAuthenticated() && babyStore.hasBabies()) {
              <button
                type="button"
                class="btn"
                style="position: relative; min-height: 36px; padding: 0 0.55rem; border-radius: 11px; gap: 0.25rem;"
                (click)="toggleAlertsPanel()"
                [attr.aria-expanded]="alertsOpen()"
                aria-label="Histórico dos últimos 100 alertas do bebê"
                title="Últimos 100 alertas do bebê">
                <span aria-hidden="true" style="font-size: 1rem;">🔔</span>
                @if (popupAlert.activeBabyAlerts().length > 0) {
                  <span
                    class="badge badge-sleep"
                    style="padding: 0.1rem 0.38rem; font-size: 0.68rem;">
                    {{ popupAlert.activeBabyAlerts().length }}
                  </span>
                }
              </button>
            }

            <app-night-mode-toggle />

            @if (authService.isAuthenticated()) {
              <button
                type="button"
                class="btn"
                style="min-height: 36px; width: 38px; padding: 0; border-radius: 11px;"
                (click)="toggleMenuPanel()"
                [attr.aria-expanded]="menuOpen()"
                aria-label="Abrir menu de navegação e conta">
                <span aria-hidden="true" style="font-size: 1.1rem;">{{ menuOpen() ? '✕' : '☰' }}</span>
              </button>
            }
          </div>
        </div>

        @if (authService.isAuthenticated()) {
          <!-- Menu de Navegação Principal no Cabeçalho (Deslizante Horizontal tipo App Mobile) -->
          <nav aria-label="Menu de Navegação Principal" class="pwa-nav-scroller">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                class="pwa-nav-pill"
                [class.active]="activeTab() === tab.id"
                (click)="selectTab(tab.id)">
                <span aria-hidden="true">{{ tab.icon }}</span>
                <span>{{ tab.label }}</span>
              </button>
            }
          </nav>

          <!-- Painel no Cabeçalho: Lista dos Últimos 100 Alertas por Bebê (com Data e Hora) -->
          @if (alertsOpen() && babyStore.hasBabies()) {
            <div
              class="card-elevated"
              style="margin-top: 0.65rem; display: flex; flex-direction: column; gap: 0.6rem; max-height: 340px;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <div style="font-size: 0.82rem; font-weight: 800; display: flex; align-items: center; gap: 0.4rem;">
                  <span aria-hidden="true">🔔</span>
                  <span>Últimos Alertas • {{ babyStore.activeBaby().name }} ({{ popupAlert.activeBabyAlerts().length }}/100)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                  @if (popupAlert.activeBabyAlerts().length > 0) {
                    <button
                      type="button"
                      class="btn"
                      style="min-height: 30px; padding: 0.2rem 0.55rem; font-size: 0.72rem;"
                      (click)="popupAlert.clearHistoryForBaby(babyStore.selectedBabyId())">
                      <span>Limpar</span>
                    </button>
                  }
                  <button
                    type="button"
                    class="btn"
                    style="min-height: 30px; padding: 0.2rem 0.55rem; font-size: 0.72rem;"
                    (click)="alertsOpen.set(false)"
                    aria-label="Fechar histórico de alertas">
                    ✕
                  </button>
                </div>
              </div>

              @if (popupAlert.activeBabyAlerts().length === 0) {
                <div style="font-size: 0.8rem; color: var(--text-secondary); padding: 0.65rem 0; text-align: center;">
                  Nenhum alerta registrado para {{ babyStore.activeBaby().name }}.
                </div>
              } @else {
                <div style="overflow-y: auto; display: flex; flex-direction: column; gap: 0.45rem; padding-right: 0.2rem;">
                  @for (item of popupAlert.activeBabyAlerts(); track item.id) {
                    <div
                      class="card"
                      style="margin-bottom: 0; padding: 0.55rem 0.75rem; border-left: 4px solid var(--cat-sleep);"
                      [style.border-left-color]="getAlertColor(item.type)">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span style="font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 0.3rem;">
                          <span aria-hidden="true">{{ getAlertIcon(item.type) }}</span>
                          <span>{{ item.title }}</span>
                        </span>
                        <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight: 700;">
                          {{ item.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}
                        </span>
                      </div>
                      <div style="font-size: 0.8rem; margin-top: 0.2rem; color: var(--text-primary); font-weight: 600;">
                        {{ item.message }}
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Gaveta / Menu Expandido no Cabeçalho (Navegação Completa + Conta Google + Seletor de Filhos) -->
          @if (menuOpen()) {
            <div
              class="card-elevated"
              style="margin-top: 0.65rem; display: flex; flex-direction: column; gap: 0.65rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                @if (authService.currentUser(); as gUser) {
                  <div style="font-size: 0.8rem;">
                    <div style="font-weight: 800;">{{ gUser.name }}</div>
                    <div style="color: var(--text-secondary); font-size: 0.74rem;">{{ gUser.email }}</div>
                  </div>
                }
                <button
                  type="button"
                  class="btn"
                  style="min-height: 34px; padding: 0.3rem 0.7rem; font-size: 0.76rem;"
                  (click)="switchGoogleAccount()">
                  <span aria-hidden="true">🚪</span>
                  <span>Sair da Conta</span>
                </button>
              </div>

              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem;">
                @for (tab of tabs; track tab.id) {
                  <button
                    type="button"
                    class="btn"
                    style="justify-content: flex-start; min-height: 38px; padding: 0.4rem 0.65rem; font-size: 0.8rem;"
                    [class.btn-sleep]="activeTab() === tab.id"
                    (click)="selectTab(tab.id)">
                    <span aria-hidden="true">{{ tab.icon }}</span>
                    <span>{{ tab.label }}</span>
                  </button>
                }
              </div>
            </div>
          }
        }
      </header>

      <!-- Área Principal de Conteúdo do App PWA -->
      <main class="pwa-content">
        @if (!authService.isAuthenticated()) {
          <app-google-login (loggedIn)="onUserAuthenticated()" />
        } @else {
          @if (!babyStore.hasBabies() && activeTab() !== 'children') {
            <app-children-manager (childSelected)="activeTab.set('dashboard')" />
          } @else {
            @switch (activeTab()) {
              @case ('dashboard') {
                <app-dashboard />
              }
              @case ('children') {
                <app-children-manager (childSelected)="activeTab.set('dashboard')" />
              }
              @case ('sleep') {
                <app-sleep-tracker />
              }
              @case ('feeding') {
                <app-feeding-tracker />
              }
              @case ('diapers') {
                <app-diapers-tracker />
              }
              @case ('health') {
                <app-health-medications />
              }
              @case ('milestones') {
                <app-milestones />
              }
              @case ('growth') {
                <app-growth-tracker />
              }
              @case ('report') {
                <app-pediatric-report />
              }
            }
          }
        }
      </main>

      <!-- Rodapé Fixo com Botões de Registro Rápido Somente com Ícone -->
      @if (authService.isAuthenticated() && babyStore.hasBabies()) {
        <app-quick-action-bar (navigateTab)="selectTab($event)" />
      }
    </div>
  `
})
export class AppComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly babyStore = inject(BabyStore);
  readonly routineStore = inject(RoutineStore);
  readonly offlineSync = inject(OfflineSyncService);
  readonly realtime = inject(FamilyRealtimeService);
  readonly popupAlert = inject(PopupAlertService);

  readonly activeTab = signal<string>('dashboard');
  readonly menuOpen = signal<boolean>(false);
  readonly alertsOpen = signal<boolean>(false);

  readonly tabs = [
    { id: 'dashboard', label: 'Início', icon: '📊' },
    { id: 'sleep', label: 'Sono', icon: '💤' },
    { id: 'feeding', label: 'Nutrição', icon: '🤱' },
    { id: 'diapers', label: 'Fraldas', icon: '🧷' },
    { id: 'health', label: 'Saúde', icon: '💊' },
    { id: 'milestones', label: 'Marcos', icon: '🏆' },
    { id: 'growth', label: 'Curvas OMS', icon: '📈' },
    { id: 'report', label: 'Relatório', icon: '🩺' },
    { id: 'children', label: 'Filhos', icon: '👶' }
  ];

  async ngOnInit(): Promise<void> {
    if (this.authService.isAuthenticated()) {
      const valid = await this.authService.verifyExistingSession();
      if (valid) {
        await this.routineStore.initialize();
      }
    }
  }

  selectTab(tabId: string): void {
    this.activeTab.set(tabId);
    this.menuOpen.set(false);
    this.alertsOpen.set(false);
  }

  toggleAlertsPanel(): void {
    const next = !this.alertsOpen();
    this.alertsOpen.set(next);
    if (next) {
      this.menuOpen.set(false);
    }
  }

  toggleMenuPanel(): void {
    const next = !this.menuOpen();
    this.menuOpen.set(next);
    if (next) {
      this.alertsOpen.set(false);
    }
  }

  getAlertIcon(type: PopupAlertType): string {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
    }
  }

  getAlertColor(type: PopupAlertType): string {
    switch (type) {
      case 'success':
        return 'var(--cat-diaper)';
      case 'error':
        return 'var(--cat-health)';
      case 'warning':
        return 'var(--cat-milestone)';
      case 'info':
        return 'var(--cat-sleep)';
    }
  }

  async onUserAuthenticated(): Promise<void> {
    await this.routineStore.initialize();
    this.activeTab.set(this.babyStore.hasBabies() ? 'dashboard' : 'children');
  }

  async onBabyChange(babyId: string): Promise<void> {
    this.babyStore.selectBaby(babyId);
    await this.routineStore.refreshAllForBaby(babyId, true);
  }

  switchGoogleAccount(): void {
    this.menuOpen.set(false);
    this.alertsOpen.set(false);
    this.authService.signOut();
  }
}
