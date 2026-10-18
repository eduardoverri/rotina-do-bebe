import { Injectable, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { PopupAlertService } from './popup-alert.service';

@Injectable({ providedIn: 'root' })
export class FamilyRealtimeService {
  private readonly popupAlert = inject(PopupAlertService);
  private hubConnection?: signalR.HubConnection;
  readonly isConnected = signal<boolean>(false);
  readonly lastRealtimeNotification = signal<string | null>(null);

  async connect(apiUrl: string, familyId: string, onEventRecorded: () => void): Promise<void> {
    try {
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${apiUrl.replace('/api', '')}/hubs/family`, {
          accessTokenFactory: () => localStorage.getItem('google_jwt_token') ?? ''
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.hubConnection.on('EventRecorded', () => {
        const msg = 'Um novo registro da rotina foi sincronizado em tempo real.';
        this.lastRealtimeNotification.set(msg);
        this.popupAlert.info(msg, 'Sincronização em Tempo Real');
        onEventRecorded();
      });

      await this.hubConnection.start();
      await this.hubConnection.invoke('JoinFamilyGroup', familyId);
      this.isConnected.set(true);
    } catch {
      this.isConnected.set(false);
    }
  }
}
