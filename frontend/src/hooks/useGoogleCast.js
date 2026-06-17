import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCastDeviceName,
  initCastContext,
  isCastBrowser,
  loadCastMedia,
  requestCastSession,
  stopCastSession,
  subscribeCastMediaIdle,
  subscribeCastSessionState,
} from '@/lib/googleCast.js';

function mapCastError(error) {
  const code = error?.code ?? error?.message ?? '';
  const text = String(code);

  if (text.includes('cancel') || text.includes('CANCEL')) {
    return '';
  }
  if (text.includes('timeout') || text.includes('TIMEOUT')) {
    return 'No se encontraron dispositivos. Misma WiFi que el deco. Si tenés Telecentro, usá «Guía deco» → Transmitir pestaña.';
  }
  if (text.includes('not available') || text.includes('UNAVAILABLE')) {
    return 'Transmitir no disponible. Usá Chrome o Edge y activá Google Cast.';
  }
  if (text.includes('LOAD_FAILED') || text.includes('load')) {
    return 'La señal no se puede reproducir en el TV. Probá otra señal o reintentá.';
  }

  return error?.message || 'No se pudo conectar con el TV.';
}

function isSessionActive(state) {
  if (!state) return false;
  const castFramework = window.cast?.framework;
  const sessionStarted =
    castFramework?.SessionState?.SESSION_STARTED ??
    window.chrome?.cast?.SessionState?.SESSION_STARTED ??
    'SESSION_STARTED';
  return state === sessionStarted;
}

export function useGoogleCast({ mediaUrl, title, enabled = true, onMediaExpired } = {}) {
  const castBrowser = isCastBrowser();
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
    if (!enabled || !castBrowser) return undefined;

    const unsubscribe = subscribeCastSessionState(({ state, deviceName: name }) => {
      const isConnected = isSessionActive(state);
      setConnected(isConnected);
      setDeviceName(isConnected ? name : '');
      if (!isConnected) {
        lastLoadedUrlRef.current = '';
      }
    });

    initCastContext().catch(() => {
      // No ocultar el botón si el SDK tarda o falla al precargar.
    });

    return unsubscribe;
  }, [enabled, castBrowser]);

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

  const canCast = Boolean(mediaUrl?.trim());

  const toggleCastOrExplain = useCallback(async () => {
    if (!enabled) return;

    if (!castBrowser) {
      setError('Para ver en el TV usá Chrome o Edge en la misma WiFi que el televisor.');
      return;
    }

    if (!canCast) {
      setError('Todavía no hay señal para el TV. Probá otra señal o Reintentar.');
      return;
    }

    return toggleCast();
  }, [enabled, castBrowser, canCast, toggleCast]);

  return {
    castBrowser,
    canCast,
    connecting,
    connected,
    deviceName,
    error,
    toggleCast: toggleCastOrExplain,
    clearError: () => setError(''),
  };
}
