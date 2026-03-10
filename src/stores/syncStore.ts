import { writable, get } from 'svelte/store';
import {
  getAuthUrl,
  exchangeCode,
  syncGmail as apiSyncGmail,
  disconnectGmail as apiDisconnect,
} from '../lib/api';
import { eventsStore } from './eventsStore';
import { toastStore } from './toastStore';

interface SyncState {
  isConnected: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  email: string | null;
  error: string | null;
}

function createSyncStore() {
  const store = writable<SyncState>({
    isConnected: false,
    isConnecting: false,
    isSyncing: false,
    lastSyncAt: null,
    email: null,
    error: null,
  });
  const { subscribe, set, update } = store;

  const setError = (message: string | null) =>
    update((state) => ({
      ...state,
      error: message,
    }));

  const getMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;

  const checkStatus = async () => {
    try {
      const status = await apiSyncGmail(false);
      set({
        isConnected: !!status.connected,
        isConnecting: false,
        isSyncing: false,
        lastSyncAt: status.lastSync ?? null,
        email: status.email ?? null,
        error: null,
      });
    } catch (error) {
      setError(getMessage(error, 'Unable to check Google sync status'));
      toastStore.showError('Unable to check Google sync status');
    }
  };

  const connect = async () => {
    update((state) => ({ ...state, isConnecting: true, error: null }));
    try {
      const { state } = await getAuthUrl();
      await exchangeCode(undefined, state);
      const status = await apiSyncGmail(false);
      set({
        isConnected: !!status.connected,
        isConnecting: false,
        isSyncing: false,
        lastSyncAt: status.lastSync ?? null,
        email: status.email ?? null,
        error: null,
      });
      toastStore.showSuccess('Google connected');
    } catch (error) {
      setError(getMessage(error, 'Failed to connect Google Calendar'));
      toastStore.showError('Failed to connect Google Calendar');
    } finally {
      update((current) => ({ ...current, isConnecting: false }));
    }
  };

  const disconnect = async () => {
    try {
      await apiDisconnect();
      set({
        isConnected: false,
        isConnecting: false,
        isSyncing: false,
        lastSyncAt: null,
        email: null,
        error: null,
      });
      toastStore.showSuccess('Disconnected from Google');
    } catch (error) {
      setError(getMessage(error, 'Failed to disconnect Google Calendar'));
      toastStore.showError('Failed to disconnect Google Calendar');
    }
  };

  const syncNow = async () => {
    const state = get(store);
    if (!state.isConnected) {
      setError('Connect Google Calendar before syncing.');
      return;
    }

    update((current) => ({ ...current, isSyncing: true, error: null }));
    try {
      const status = await apiSyncGmail(true);
      update((current) => ({
        ...current,
        isConnected: !!status.connected,
        lastSyncAt: status.lastSync ?? null,
        email: status.email ?? null,
      }));
      await checkStatus();
      if (typeof eventsStore.reloadLastRange === 'function') {
        await eventsStore.reloadLastRange();
      }
      toastStore.showSuccess('Sync complete');
    } catch (error) {
      setError(getMessage(error, 'Sync failed'));
      toastStore.showError('Google sync failed');
    } finally {
      update((current) => ({ ...current, isSyncing: false }));
    }
  };

  return {
    subscribe,
    checkStatus,
    connect,
    disconnect,
    syncNow,
  };
}

export const syncStore = createSyncStore();
