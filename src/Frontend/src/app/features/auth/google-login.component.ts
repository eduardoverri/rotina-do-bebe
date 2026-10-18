import { AfterViewInit, Component, ElementRef, EventEmitter, Output, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { RoutineStore } from '../../core/state/routine.store';
import { PopupAlertService } from '../../core/services/popup-alert.service';

@Component({
  selector: 'app-google-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div style="max-width: 500px; margin: 3rem auto;">
      <section class="card" style="border-top: 5px solid var(--cat-sleep); padding: 2rem;">
        <div style="text-align: center; margin-bottom: 1.75rem;">
          <img
            src="app-icon.png"
            alt="Rotina do Bebê"
            style="width: 72px; height: 72px; object-fit: contain; margin-bottom: 0.5rem;" />
          <h1 style="font-size: 1.55rem; font-weight: 800;">Rotina do Bebê</h1>
          <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.4rem;">
            Autentique-se via <strong>Google SSO</strong>. Seus filhos e registros clínicos são protegidos por JWT e isolados na sua conta Google.
          </p>
        </div>

        <!-- Botão Oficial Renderizado pelo Google Identity Services (OIDC ID Token + One Tap) -->
        <div style="display: flex; justify-content: center; margin-bottom: 1rem; min-height: 44px;">
          <div #googleBtnContainer></div>
        </div>

        <!-- Botão Direto Google OAuth 2.0 SSO Popup (initTokenClient) -->
        <div class="card-elevated" style="text-align: center; padding: 1.25rem;">
          <button
            type="button"
            class="btn btn-sleep"
            style="width: 100%; font-size: 0.96rem; padding: 0.85rem 1.2rem;"
            [disabled]="isLoading()"
            (click)="signInWithGoogleSsoPopup()">
            <span aria-hidden="true">🌐</span>
            <span>{{ isLoading() ? 'Autenticando via Google SSO...' : 'Continuar com o Google (SSO)' }}</span>
          </button>

          @if (!authService.googleClientId() && authService.allowClientIdConfig()) {
            <p style="font-size: 0.8rem; color: var(--cat-milestone); margin-top: 0.75rem; font-weight: 600;">
              ⚠️ Configure o seu Google OAuth 2.0 Client ID abaixo (ou em <code>appsettings.json</code> / variável <code>GOOGLE_CLIENT_ID</code>) para habilitar o popup do Google SSO.
            </p>
          }
        </div>

        <!-- Configuração do Google Cloud OAuth 2.0 Client ID (Exibida apenas quando GOOGLE_CLIENT_ID não está definido no ambiente) -->
        @if (authService.allowClientIdConfig()) {
          <div style="margin-top: 1.25rem; text-align: center;">
            <button
              type="button"
              class="btn"
              style="min-height: 32px; font-size: 0.76rem; padding: 0.3rem 0.75rem;"
              (click)="showClientIdConfig.set(!showClientIdConfig())">
              ⚙️ Configurar Google OAuth 2.0 Client ID
            </button>

            @if (showClientIdConfig() || !authService.googleClientId()) {
              <div class="card-elevated" style="margin-top: 0.75rem; text-align: left;">
                <label style="font-size: 0.78rem; font-weight: 600; display: block; margin-bottom: 0.3rem;">
                  Google Cloud OAuth 2.0 Client ID:
                </label>
                <div style="display: flex; gap: 0.5rem;">
                  <input
                    type="text"
                    class="input-field"
                    [(ngModel)]="clientIdInput"
                    placeholder="seu-client-id.apps.googleusercontent.com" />
                  <button type="button" class="btn btn-diaper" (click)="saveClientId()">Salvar</button>
                </div>
                <p style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.4rem;">
                  Em Google Cloud Console → APIs &amp; Services → Credentials, adicione <code>http://localhost:4200</code> em <em>Authorized JavaScript origins</em>.
                </p>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `
})
export class GoogleLoginComponent implements AfterViewInit {
  readonly authService = inject(AuthService);
  readonly routineStore = inject(RoutineStore);
  private readonly popupAlert = inject(PopupAlertService);

  @ViewChild('googleBtnContainer') googleBtnContainer?: ElementRef<HTMLDivElement>;
  @Output() readonly loggedIn = new EventEmitter<void>();

  readonly isLoading = signal(false);
  readonly showClientIdConfig = signal(false);
  clientIdInput = '';

  async ngAfterViewInit(): Promise<void> {
    const serverClientId = await this.authService.loadServerSsoConfig();
    this.clientIdInput = serverClientId;
    this.waitForGoogleScriptAndRender();
  }

  async signInWithGoogleSsoPopup(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.authService.signInWithGoogleOAuthPopup();
      await this.routineStore.initialize();
      this.loggedIn.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação Google SSO.';
      this.popupAlert.error(msg, 'Erro de Autenticação Google SSO');
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveClientId(): Promise<void> {
    await this.authService.setGoogleClientId(this.clientIdInput);
    this.tryRenderOfficialGoogleButton();
  }

  private waitForGoogleScriptAndRender(attempt = 0): void {
    if (typeof window === 'undefined') return;
    if (window.google?.accounts?.id) {
      this.tryRenderOfficialGoogleButton();
    } else if (attempt < 20) {
      setTimeout(() => this.waitForGoogleScriptAndRender(attempt + 1), 250);
    }
  }

  private tryRenderOfficialGoogleButton(): void {
    if (typeof window === 'undefined' || !this.googleBtnContainer?.nativeElement) return;
    const g = window.google?.accounts?.id;
    const clientId = this.authService.googleClientId();
    if (g && clientId) {
      try {
        this.googleBtnContainer.nativeElement.innerHTML = '';
        g.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async (response: { credential: string }) => {
            this.isLoading.set(true);
            try {
              await this.authService.signInWithGoogleCredential(response.credential);
              await this.routineStore.initialize();
              this.loggedIn.emit();
            } catch {
              this.popupAlert.error(
                'Falha ao validar o Google ID Token e sincronizar usuário no banco de dados.',
                'Erro de Autenticação'
              );
            } finally {
              this.isLoading.set(false);
            }
          }
        });
        g.renderButton(this.googleBtnContainer.nativeElement, {
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 320
        });
        g.prompt();
      } catch { }
    }
  }
}
