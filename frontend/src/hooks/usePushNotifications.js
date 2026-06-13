import { useCallback, useEffect, useState } from 'react';
import { pushApi } from '../api/client.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications({ enabled = true } = {}) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const ok =
      enabled &&
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(ok);
  }, [enabled]);

  const subscribe = useCallback(async () => {
    if (!supported) return false;

    setLoading(true);
    setError('');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Permiso de notificaciones denegado.');
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
      return true;
    } catch (err) {
      setError(err.message || 'No se pudo activar las notificaciones.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return { supported, subscribed, loading, error, subscribe };
}
