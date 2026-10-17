import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class FamilyRealtimeService {
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

      this.hubConnection.on('EventRecorded', (eventDoc: { category?: string; recordedByName?: string }) => {
        this.lastRealtimeNotification.set(
          `Sincronizado: ${eventDoc.recordedByName ?? 'Cuidador'} registrou ${eventDoc.category ?? 'evento'} agora.`
        );
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
