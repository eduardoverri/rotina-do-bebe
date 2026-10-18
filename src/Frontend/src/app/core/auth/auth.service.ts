import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BabyModel, BabyStore } from '../state/baby.store';
import { PopupAlertService } from '../services/popup-alert.service';

export interface GoogleUserAccount {
  id: string;
  googleSub: string;
  email: string;
  name: string;
  pictureUrl: string;
  relation: string;
  familyId: string;
}

interface GoogleSsoResponse {
  token: string;
  user: GoogleUserAccount;
  family: { name: string; inviteCode: string };
  babies: BabyModel[];
  googleClientId?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode?: 'popup' | 'redirect';
            callback: (response: { code?: string; error?: string }) => void;
          }) => {
            requestCode: () => void;
          };
        };
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly babyStore = inject(BabyStore);
  private readonly popupAlert = inject(PopupAlertService);
  private readonly apiBaseUrl =
    typeof window !== 'undefined' && window.location.port === '4200'
      ? 'http://localhost:5000/api'
      : '/api';

  readonly currentUser = signal<GoogleUserAccount | null>(this.loadStoredUser());
  readonly token = signal<string | null>(localStorage.getItem('google_jwt_token'));
  readonly googleClientId = signal<string>(
    localStorage.getItem('google_oauth_client_id') ?? ''
  );
  readonly allowClientIdConfig = signal<boolean>(false);
  readonly isAuthenticated = computed<boolean>(() => this.currentUser() !== null && !!this.token());

  async loadServerSsoConfig(): Promise<string> {
    try {
      const cfg = await firstValueFrom(
        this.http.get<{ googleClientId: string; allowClientIdConfiguration?: boolean }>(`${this.apiBaseUrl}/auth/config`)
      );
      this.allowClientIdConfig.set(cfg?.allowClientIdConfiguration ?? !cfg?.googleClientId);
      if (cfg?.googleClientId) {
        this.googleClientId.set(cfg.googleClientId);
        localStorage.setItem('google_oauth_client_id', cfg.googleClientId);
      }
    } catch {
      this.allowClientIdConfig.set(!this.googleClientId());
    }
    return this.googleClientId();
  }

  async verifyExistingSession(): Promise<boolean> {
    if (!this.token()) return false;
    try {
      const res = await firstValueFrom(
        this.http.get<{
          user: GoogleUserAccount;
          family: { name: string; inviteCode: string };
          babies: BabyModel[];
        }>(`${this.apiBaseUrl}/auth/me`)
      );
      this.currentUser.set(res.user);
      localStorage.setItem('google_user_profile', JSON.stringify(res.user));
      localStorage.setItem('google_user_id', res.user.id);
      localStorage.setItem('caregiver-name', res.user.name);
      this.babyStore.setAuthenticatedUserBabies(
        res.user.id,
        res.family.name,
        res.family.inviteCode,
        res.babies
      );
      return true;
    } catch {
      this.signOut(false);
      return false;
    }
  }

  async signInWithGoogleCredential(idToken: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<GoogleSsoResponse>(`${this.apiBaseUrl}/auth/google`, { idToken })
    );
    this.applySession(res.token, res.user, res.family.name, res.family.inviteCode, res.babies);
  }

  async signInWithGoogleAccessToken(accessToken: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<GoogleSsoResponse>(`${this.apiBaseUrl}/auth/google`, { accessToken })
    );
    this.applySession(res.token, res.user, res.family.name, res.family.inviteCode, res.babies);
  }

  async signInWithGoogleAuthCode(authorizationCode: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<GoogleSsoResponse>(`${this.apiBaseUrl}/auth/google`, {
        authorizationCode,
        redirectUri: 'postmessage'
      })
    );
    this.applySession(res.token, res.user, res.family.name, res.family.inviteCode, res.babies);
  }

  signInWithGoogleOAuthPopup(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const clientId = this.googleClientId().trim();
      if (!clientId) {
        reject(new Error('Configure o Google OAuth 2.0 Client ID para iniciar o login SSO com o Google.'));
        return;
      }

      const oauth2 = window.google?.accounts?.oauth2;
      if (!oauth2) {
        reject(new Error('O SDK do Google Identity Services (accounts.google.com/gsi/client) ainda não foi carregado.'));
        return;
      }

      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error ?? 'Autenticação Google SSO cancelada.'));
            return;
          }
          try {
            await this.signInWithGoogleAccessToken(response.access_token);
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  }

  signOut(_notify = true): void {
    try {
      window.google?.accounts?.id?.disableAutoSelect();
    } catch {}
    localStorage.removeItem('google_jwt_token');
    localStorage.removeItem('google_user_profile');
    localStorage.removeItem('google_user_id');
    localStorage.removeItem('caregiver-name');
    this.token.set(null);
    this.currentUser.set(null);
    this.babyStore.clearSession();
  }

  async setGoogleClientId(clientId: string): Promise<void> {
    const trimmed = clientId.trim();
    this.googleClientId.set(trimmed);
    localStorage.setItem('google_oauth_client_id', trimmed);
    try {
      await firstValueFrom(
        this.http.put(`${this.apiBaseUrl}/auth/config`, { clientId: trimmed })
      );
      this.popupAlert.success(
        'Configuração de autenticação atualizada com sucesso.',
        'Configuração Salva',
        { skipHistory: true }
      );
    } catch {
      this.popupAlert.warning(
        'Configuração salva localmente no navegador, mas não foi possível sincronizar com o servidor.',
        'Configuração Local',
        { skipHistory: true }
      );
    }
  }

  private applySession(
    jwtToken: string,
    user: GoogleUserAccount,
    familyName: string,
    inviteCode: string,
    babies: BabyModel[]
  ): void {
    localStorage.setItem('google_jwt_token', jwtToken);
    localStorage.setItem('google_user_profile', JSON.stringify(user));
    localStorage.setItem('google_user_id', user.id);
    localStorage.setItem('caregiver-name', user.name);

    this.token.set(jwtToken);
    this.currentUser.set(user);
    this.babyStore.setAuthenticatedUserBabies(user.id, familyName, inviteCode, babies);
  }

  private loadStoredUser(): GoogleUserAccount | null {
    try {
      const token = localStorage.getItem('google_jwt_token');
      const raw = localStorage.getItem('google_user_profile');
      if (token && raw) {
        return JSON.parse(raw) as GoogleUserAccount;
      }
    } catch {}
    return null;
  }
}
