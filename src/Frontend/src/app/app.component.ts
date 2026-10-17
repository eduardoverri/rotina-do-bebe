import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from './core/auth/auth.service';
import { BabyStore } from './core/state/baby.store';
import { RoutineStore } from './core/state/routine.store';
import { OfflineSyncService } from './core/services/offline-sync.service';
import { FamilyRealtimeService } from './core/services/family-realtime.service';
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
import { PediatricReportComponent } from './features/reports/pediatric-report.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
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
    PediatricReportComponent
  ],
  template: `
    <div class="app-container">
      @if (!authService.isAuthenticated()) {
        <app-google-login (loggedIn)="onUserAuthenticated()" />
      } @else {
        <!-- Top Header com Conta Google Autenticada e Seletor de Filhos Isolados -->
        <header class="card no-print" style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
            <div>
              <!-- Linha 1: Conta Google Autenticada + Status da Sincronização -->
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                @if (authService.currentUser(); as gUser) {
                  <span class="badge badge-sleep" title="Dados isolados para esta Conta Google">
                    <span aria-hidden="true">🔐</span>
                    <span>Conta Google: <strong>{{ gUser.name }}</strong> ({{ gUser.email }})</span>
                  </span>
                }

                <span class="badge" [class]="routineStore.isBackendConnected() ? 'badge-diaper' : 'badge-milestone'">
                  <span aria-hidden="true">{{ routineStore.isBackendConnected() ? '🟢' : '💾' }}</span>
                  <span>{{ routineStore.isBackendConnected() ? 'API .NET + JWT + SignalR' : 'PWA Offline (Isolado por Usuário/Filho)' }}</span>
                </span>

                <button
                  type="button"
                  class="btn"
                  style="min-height: 30px; padding: 0.2rem 0.65rem; font-size: 0.78rem;"
                  (click)="switchGoogleAccount()">
                  <span aria-hidden="true">🔄</span>
                  <span>Trocar Conta Google / Sair</span>
                </button>
              </div>

              <!-- Linha 2: Seletor de Filho(a) do Usuário Autenticado -->
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-top: 0.65rem; flex-wrap: wrap;">
                @if (babyStore.hasBabies()) {
                  <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
                    FILHO(A) ATIVO:
                  </label>
                  <select
                    class="input-field"
                    style="width: auto; font-weight: 800; font-size: 1.02rem;"
                    [ngModel]="babyStore.selectedBabyId()"
                    (ngModelChange)="onBabyChange($event)"
                    aria-label="Selecionar filho ativo desta conta Google">
                    @for (b of babyStore.babies(); track b.id) {
                      <option [value]="b.id">👶 {{ b.name }} — {{ b | babyAge }}</option>
                    }
                  </select>
                }

                <button
                  type="button"
                  class="btn"
                  style="min-height: 40px; padding: 0.4rem 0.85rem; font-size: 0.84rem;"
                  [class.btn-diaper]="activeTab() === 'children'"
                  (click)="activeTab.set('children')">
                  <span aria-hidden="true">➕</span>
                  <span>Meus Filhos ({{ babyStore.babies().length }}) / Adicionar Filho</span>
                </button>
              </div>
            </div>

            <app-night-mode-toggle />
          </div>

          <!-- Abas de Navegação por Domínio Clínico (Escopadas para o Filho Selecionado) -->
          <nav aria-label="Navegação Principal" style="display: flex; gap: 0.45rem; flex-wrap: wrap; margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--border-subtle);">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                class="btn"
                style="min-height: 40px; padding: 0.45rem 0.9rem; font-size: 0.86rem;"
                [class.btn-sleep]="activeTab() === tab.id"
                (click)="activeTab.set(tab.id)">
                <span aria-hidden="true">{{ tab.icon }}</span>
                <span>{{ tab.label }}</span>
              </button>
            }
          </nav>
        </header>

        <!-- Toast de confirmação instantânea -->
        @if (routineStore.toastMessage(); as toast) {
          <div
            role="status"
            class="card"
            style="margin-bottom: 1rem; border-color: var(--cat-diaper); background: var(--cat-diaper-bg); font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
            <span aria-hidden="true">✅</span>
            <span>{{ toast }}</span>
          </div>
        }

        <!-- Banner de Alerta Clínico de Urgência -->
        <app-alert-banner />

        <!-- Conteúdo Principal Reativo (@switch Angular 19) -->
        <main>
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
              @case ('report') {
                <app-pediatric-report />
              }
            }
          }
        </main>
      }
    </div>

    <!-- Barra Fixa Inferior 1-Toque (Exibida quando autenticado e com filho selecionado) -->
    @if (authService.isAuthenticated() && babyStore.hasBabies()) {
      <app-quick-action-bar (navigateTab)="activeTab.set($event)" />
    }
  `
})
export class AppComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly babyStore = inject(BabyStore);
  readonly routineStore = inject(RoutineStore);
  readonly offlineSync = inject(OfflineSyncService);
  readonly realtime = inject(FamilyRealtimeService);

  readonly activeTab = signal<string>('dashboard');

  readonly tabs = [
    { id: 'dashboard', label: 'Visão Geral & Ficha Diária', icon: '📊' },
    { id: 'children', label: 'Meus Filhos', icon: '👶' },
    { id: 'sleep', label: 'Sono & Janela de Vigília', icon: '💤' },
    { id: 'feeding', label: 'Nutrição & Alérgenos 72h', icon: '🤱' },
    { id: 'diapers', label: 'Fraldas & Triagem (U/E/M/L)', icon: '🧷' },
    { id: 'health', label: 'Farmacologia & Vacinas', icon: '💊' },
    { id: 'milestones', label: 'Marcos Motores (0–24m)', icon: '🏆' },
    { id: 'report', label: 'Relatório Pediátrico', icon: '🩺' }
  ];

  async ngOnInit(): Promise<void> {
    if (this.authService.isAuthenticated()) {
      const valid = await this.authService.verifyExistingSession();
      if (valid) {
        await this.routineStore.initialize();
      }
    }
  }

  async onUserAuthenticated(): Promise<void> {
    this.activeTab.set(this.babyStore.hasBabies() ? 'dashboard' : 'children');
  }

  async onBabyChange(babyId: string): Promise<void> {
    this.babyStore.selectBaby(babyId);
    await this.routineStore.refreshAllForBaby(babyId);
  }

  switchGoogleAccount(): void {
    this.authService.signOut();
  }
}
