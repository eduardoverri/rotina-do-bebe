import { Injectable, signal } from '@angular/core';

export interface OfflineQueuedEvent {
  localId: string;
  babyId: string;
  endpoint: string;
  payload: unknown;
  queuedAt: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly dbName = 'BabyRoutineOfflineDB';
  private readonly storeName = 'pending_events';
  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly pendingCount = signal<number>(0);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.isOnline.set(true));
      window.addEventListener('offline', () => this.isOnline.set(false));
      this.refreshPendingCount();
    }
  }

  async enqueueOfflineEvent(babyId: string, endpoint: string, payload: unknown): Promise<void> {
    const item: OfflineQueuedEvent = {
      localId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      babyId,
      endpoint,
      payload,
      queuedAt: new Date().toISOString()
    };

    try {
      const db = await this.openDb();
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(item);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      await this.refreshPendingCount();
    } catch {
      // Fallback para localStorage caso IndexedDB esteja bloqueado
      const raw = localStorage.getItem('offline_queue_fallback');
      const list: OfflineQueuedEvent[] = raw ? JSON.parse(raw) : [];
      list.push(item);
      localStorage.setItem('offline_queue_fallback', JSON.stringify(list));
      this.pendingCount.set(list.length);
    }
  }

  async getAllQueuedEvents(): Promise<OfflineQueuedEvent[]> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).getAll();
      return await new Promise<OfflineQueuedEvent[]>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      const raw = localStorage.getItem('offline_queue_fallback');
      return raw ? JSON.parse(raw) : [];
    }
  }

  async clearQueuedEvent(localId: string): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(localId);
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      await this.refreshPendingCount();
    } catch {
      localStorage.removeItem('offline_queue_fallback');
      this.pendingCount.set(0);
    }
  }

  private async refreshPendingCount(): Promise<void> {
    const items = await this.getAllQueuedEvents();
    this.pendingCount.set(items.length);
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'localId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
