import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCastDeviceName,
  initCastContext,
  isCastApiAvailable,
  loadCastMedia,
  requestCastSession,
  stopCastSession,
  subscribeCastMediaIdle,
  subscribeCastSessionState,
} from '@/lib/googleCast.js';

const SESSION_STARTED = 'SESSION_STARTED';

function mapCastError(error) {
  const code = error?.code ?? error?.message ?? '';
  const text = String(code);

  if (text.includes('cancel') || text.includes('CANCEL')) {
    return '';
  }
  if (text.includes('timeout') || text.includes('TIMEOUT')) {
    return 'No se encontraron dispositivos. Verificá que el TV esté en la misma red WiFi.';
  }
  if (text.includes('not available') || text.includes('UNAVAILABLE')) {
    return 'Transmitir no disponible en este navegador.';
  }
  if (text.includes('LOAD_FAILED') || text.includes('load')) {
    return 'La señal no se puede reproducir en el TV. Probá otra señal o reintentá.';
  }

  return error?.message || 'No se pudo conectar con el TV.';
}

export function useGoogleCast({ mediaUrl, title, enabled = true, onMediaExpired } = {}) {
  const [available, setAvailable] = useState(() => isCastApiAvailable());
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState('');
  const lastLoadedUrlRef = useRef('');
  const onMediaExpiredRef = useRef(onMediaExpired);

  useEffect(() => {
    onMediaExpiredRef.current = onMediaExpired;
  }, [onMediaExpired]);

  useEffect(() => {
    if (!enabled || !isCastApiAvailable()) {
      setAvailable(false);
      return undefined;
    }

    setAvailable(true);

    const unsubscribe = subscribeCastSessionState(({ state, deviceName: name }) => {
      const isConnected = state === SESSION_STARTED;
      setConnected(isConnected);
      setDeviceName(isConnected ? name : '');
      if (!isConnected) {
        lastLoadedUrlRef.current = '';
      }
    });

    initCastContext().catch(() => {
      setAvailable(false);
    });

    return unsubscribe;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !connected) return undefined;

    return subscribeCastMediaIdle((idleReason) => {
      const castFramework = window.cast?.framework;
      const isFailure =
        castFramework &&
        (idleReason === castFramework.messages.IdleReason.ERROR ||
          idleReason === castFramework.messages.IdleReason.INTERRUPTED);

      if (!isFailure) return;

      setError('La señal se cortó en el TV. Reintentando…');
      onMediaExpiredRef.current?.();
    });
  }, [enabled, connected]);

  const loadMedia = useCallback(
    async (url) => {
      if (!url?.trim()) return;

      await loadCastMedia({
        contentId: url,
        title,
        streamType: 'LIVE',
      });
      lastLoadedUrlRef.current = url;
      setError('');
    },
    [title]
  );

  useEffect(() => {
    if (!enabled || !connected || !mediaUrl?.trim()) return;
    if (lastLoadedUrlRef.current === mediaUrl) return;

    loadMedia(mediaUrl).catch((err) => {
      setError(mapCastError(err));
    });
  }, [enabled, connected, mediaUrl, loadMedia]);

  const toggleCast = useCallback(async () => {
    if (!enabled || !mediaUrl?.trim()) return;

    setError('');

    if (connected) {
      try {
        await stopCastSession();
      } catch (err) {
        setError(mapCastError(err));
      }
      return;
    }

    setConnecting(true);
    try {
      await initCastContext();
      await requestCastSession();
      await loadMedia(mediaUrl);
      setDeviceName(getCastDeviceName());
    } catch (err) {
      const message = mapCastError(err);
      if (message) setError(message);
    } finally {
      setConnecting(false);
    }
  }, [enabled, mediaUrl, connected, loadMedia]);

  return {
    available: available && Boolean(mediaUrl?.trim()),
    connecting,
    connected,
    deviceName,
    error,
    toggleCast,
    clearError: () => setError(''),
  };
}
