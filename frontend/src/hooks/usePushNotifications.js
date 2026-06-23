import { useCallback, useEffect, useState } from 'react';
import { pushApi } from '../api/client.js';

const DEFAULT_PREFERENCES = {
  predictionLockReminder: true,
  matchLiveStart: true,
  goals: true,
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function readNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

async function hasActivePushSubscription() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

export function usePushNotifications({ enabled = true, initialPreferences = null } = {}) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState('unsupported');
  const [loading, setLoading] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState(() => ({
    ...DEFAULT_PREFERENCES,
    ...(initialPreferences ?? {}),
  }));

  const loadPreferences = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await pushApi.getPreferences();
      setSubscribed(Boolean(data.subscribed));
      setPreferences({ ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) });
    } catch {
      // Sin sesión o push no configurado
    }
  }, [enabled]);

  useEffect(() => {
    const ok =
      enabled &&
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(ok);
    if (!ok) {
      setPermission('unsupported');
      return;
    }

    const currentPermission = readNotificationPermission();
    setPermission(currentPermission);

    if (currentPermission !== 'granted') return;

    let cancelled = false;
    hasActivePushSubscription().then((active) => {
      if (!cancelled && active) setSubscribed(true);
    });
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [enabled, loadPreferences]);

  useEffect(() => {
    if (!initialPreferences) return;
    setPreferences((prev) => ({ ...prev, ...initialPreferences }));
  }, [initialPreferences]);

  const subscribe = useCallback(async () => {
    if (!supported) return false;

    const currentPermission = readNotificationPermission();
    if (currentPermission === 'denied') {
      setPermission('denied');
      setError('');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        setError('');
        return false;
      }

      const { enabled: pushEnabled, publicKey } = await pushApi.getVapidPublicKey();
      if (!pushEnabled || !publicKey) {
        setError('Las notificaciones push no están configuradas en el servidor.');
        return false;
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js');
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await pushApi.subscribe(subscription.toJSON());
      setSubscribed(true);
      await loadPreferences();
      return true;
    } catch (err) {
      setError(err.message || 'No se pudo activar las notificaciones.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported, loadPreferences]);

  const updatePreference = useCallback(async (key, value) => {
    setSavingPreference(true);
    setError('');
    const previous = preferences;
    setPreferences((prev) => ({ ...prev, [key]: value }));
    try {
      const data = await pushApi.updatePreferences({ [key]: value });
      setPreferences({ ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) });
      setSubscribed(Boolean(data.subscribed));
    } catch (err) {
      setPreferences(previous);
      setError(err.message || 'No se pudo guardar la preferencia.');
    } finally {
      setSavingPreference(false);
    }
  }, [preferences]);

  return {
    supported,
    subscribed,
    permission,
    loading,
    savingPreference,
    error,
    preferences,
    subscribe,
    updatePreference,
    reloadPreferences: loadPreferences,
  };
}
