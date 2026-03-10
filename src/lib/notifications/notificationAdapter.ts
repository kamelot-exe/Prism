import { isTauriEnvironment } from '../safeInvoke';
import { toastStore } from '../../stores/toastStore';

export interface NotificationData {
  source?: 'task' | 'event' | 'block';
  id?: number | string;
  date?: string;
  [key: string]: unknown;
}

export interface NotificationOptions {
  title: string;
  body: string;
  data?: NotificationData;
}

let permissionStatus: NotificationPermission = 'default';

export function isSupported(): boolean {
  if (isTauriEnvironment()) {
    return true;
  }
  return 'Notification' in window;
}

export async function requestPermission(): Promise<boolean> {
  if (isTauriEnvironment()) {
    return true;
  }

  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionStatus = 'granted';
    return true;
  }

  if (Notification.permission === 'denied') {
    permissionStatus = 'denied';
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    permissionStatus = permission;
    return permission === 'granted';
  } catch (err) {
    console.error('Failed to request notification permission', err);
    return false;
  }
}

export async function notify(options: NotificationOptions): Promise<void> {
  const { title, body, data } = options;

  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('notify', {
        title,
        body,
        data: data || {},
      });
      return;
    } catch (err) {
      console.error('Failed to show Tauri notification', err);
      toastStore.showInfo(`${title}: ${body}`);
      return;
    }
  }

  if (!('Notification' in window)) {
    toastStore.showInfo(`${title}: ${body}`);
    return;
  }

  if (permissionStatus !== 'granted') {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      toastStore.showInfo(`${title}: ${body}`);
      return;
    }
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data?.id ? `${data.source}-${data.id}` : undefined,
      data: data || {},
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      
      if (data) {
        window.dispatchEvent(new CustomEvent('notification-click', { detail: data }));
      }
    };

    setTimeout(() => {
      notification.close();
    }, 5000);
  } catch (err) {
    console.error('Failed to show notification', err);
    toastStore.showInfo(`${title}: ${body}`);
  }
}

