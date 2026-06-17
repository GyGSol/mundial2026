const CAST_SDK_URL =
  'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
const DEFAULT_APP_ID = 'CC1AD845';

let sdkPromise = null;
let castContext = null;
let initPromise = null;

function getAppId() {
  const fromEnv = import.meta.env.VITE_CAST_APP_ID?.trim();
  if (fromEnv) return fromEnv;
  return window.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || DEFAULT_APP_ID;
}

function getAutoJoinPolicy() {
  return window.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED ?? null;
}

/**
 * Navegadores donde tiene sentido mostrar el botón Transmitir (Chromium).
 */
export function isCastBrowser() {
  if (typeof window === 'undefined') return false;
  if (window.cast?.framework) return true;

  const ua = navigator.userAgent;
  if (/Firefox/i.test(ua)) return false;
  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS/i.test(ua)) return false;

  return Boolean(window.chrome) || /Chrome|Chromium|Edg|OPR|CriOS/i.test(ua);
}

/** @deprecated use isCastBrowser */
export function isCastApiAvailable() {
  return isCastBrowser();
}

function loadCastSdk() {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (window.cast?.framework) {
      resolve(window.cast.framework);
      return;
    }

    const existing = document.querySelector(`script[src="${CAST_SDK_URL}"]`);
    if (existing) {
      const startedAt = Date.now();
      const waitForFramework = () => {
        if (window.cast?.framework) {
          resolve(window.cast.framework);
          return;
        }
        if (Date.now() - startedAt > 12000) {
          reject(new Error('Tiempo de espera agotado al cargar Google Cast.'));
          sdkPromise = null;
          return;
        }
        window.setTimeout(waitForFramework, 50);
      };
      waitForFramework();
      return;
    }

    window.__onGCastApiAvailable = (isAvailable) => {
      delete window.__onGCastApiAvailable;
      if (isAvailable && window.cast?.framework) {
        resolve(window.cast.framework);
      } else {
        sdkPromise = null;
        reject(new Error('Cast API no disponible en este navegador.'));
      }
    };

    const script = document.createElement('script');
    script.src = CAST_SDK_URL;
    script.async = true;
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('No se pudo cargar el SDK de Google Cast.'));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export async function initCastContext() {
  if (castContext) return castContext;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const castFramework = await loadCastSdk();
      const context = castFramework.CastContext.getInstance();
      const receiverApplicationId =
        getAppId() ||
        window.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID ||
        DEFAULT_APP_ID;
      const options = {
        receiverApplicationId,
        androidReceiverCompatible: true,
        resumeSavedSession: true,
        language: 'es-AR',
      };
      const autoJoinPolicy = getAutoJoinPolicy();
      if (autoJoinPolicy != null) {
        options.autoJoinPolicy = autoJoinPolicy;
      }
      context.setOptions(options);
      castContext = context;
      return context;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/** Precarga el SDK al entrar a transmisión en vivo (mejora el descubrimiento de decos Android TV). */
export function preloadCastContext() {
  if (!isCastBrowser()) return;
  void initCastContext().catch(() => {});
}

export function getCastContext() {
  return castContext;
}

export async function requestCastSession() {
  const context = await initCastContext();
  return context.requestSession();
}

/**
 * @param {{ contentId: string, title?: string, streamType?: 'LIVE' | 'BUFFERED' }} params
 */
export async function loadCastMedia({ contentId, title, streamType = 'LIVE' }) {
  if (!contentId?.trim()) {
    throw new Error('No hay URL de transmisión para enviar al TV.');
  }

  const castFramework = await loadCastSdk();
  const context = await initCastContext();
  const session = context.getCurrentSession();
  if (!session) {
    throw new Error('No hay sesión de Cast activa.');
  }

  const mediaInfo = new castFramework.messages.MediaInfo(
    contentId.trim(),
    'application/x-mpegURL'
  );
  mediaInfo.streamType =
    streamType === 'BUFFERED'
      ? castFramework.messages.StreamType.BUFFERED
      : castFramework.messages.StreamType.LIVE;
  mediaInfo.metadata = new castFramework.messages.GenericMediaMetadata();
  mediaInfo.metadata.title = title?.trim() || 'Transmisión en vivo';

  const request = new castFramework.messages.LoadRequest(mediaInfo);
  request.autoplay = true;
  request.currentTime = 0;

  return session.loadMedia(request);
}

export async function stopCastSession() {
  const context = castContext;
  if (!context) return;

  const session = context.getCurrentSession();
  if (session) {
    await session.endSession(true);
  }
}

export function getCastSessionState() {
  const context = castContext;
  if (!context) return 'NO_SESSION';
  return context.getSessionState();
}

export function getCastDeviceName() {
  const context = castContext;
  const session = context?.getCurrentSession();
  return session?.getCastDevice()?.friendlyName ?? '';
}

/**
 * @param {(event: { state: string, deviceName?: string }) => void} listener
 * @returns {() => void}
 */
export function subscribeCastSessionState(listener) {
  let cancelled = false;
  let unsubscribe = () => {};

  initCastContext()
    .then((context) => {
      if (cancelled) return;

      const castFramework = window.cast.framework;
      const handler = (event) => {
        const state = event.sessionState ?? context.getSessionState();
        listener({
          state,
          deviceName: context.getCurrentSession()?.getCastDevice()?.friendlyName ?? '',
        });
      };

      context.addEventListener(
        castFramework.CastContextEventType.SESSION_STATE_CHANGED,
        handler
      );

      unsubscribe = () => {
        context.removeEventListener(
          castFramework.CastContextEventType.SESSION_STATE_CHANGED,
          handler
        );
      };

      listener({
        state: context.getSessionState(),
        deviceName: context.getCurrentSession()?.getCastDevice()?.friendlyName ?? '',
      });
    })
    .catch(() => {
      if (!cancelled) {
        listener({ state: 'UNAVAILABLE' });
      }
    });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

/**
 * @param {(idleReason: string) => void} listener
 * @returns {() => void}
 */
export function subscribeCastMediaIdle(listener) {
  let cancelled = false;
  let unsubscribe = () => {};

  initCastContext()
    .then((context) => {
      if (cancelled) return;

      const castFramework = window.cast.framework;

      const attachToSession = (session) => {
        if (!session) return () => {};

        const onMediaSession = () => {
          const mediaSession = session.getMediaSession();
          if (!mediaSession) return;

          const playerState = mediaSession.playerState;
          const idleReason = mediaSession.idleReason;
          if (
            playerState === castFramework.messages.PlayerState.IDLE &&
            idleReason &&
            idleReason !== castFramework.messages.IdleReason.FINISHED &&
            idleReason !== castFramework.messages.IdleReason.CANCELLED
          ) {
            listener(idleReason);
          }
        };

        session.addEventListener(
          castFramework.SessionEventType.MEDIA_SESSION,
          onMediaSession
        );

        return () => {
          session.removeEventListener(
            castFramework.SessionEventType.MEDIA_SESSION,
            onMediaSession
          );
        };
      };

      let sessionCleanup = attachToSession(context.getCurrentSession());

      const onSessionChange = (event) => {
        sessionCleanup?.();
        const sessionStarted =
          castFramework.SessionState?.SESSION_STARTED ??
          window.chrome?.cast?.SessionState?.SESSION_STARTED ??
          'SESSION_STARTED';
        if (event.sessionState === sessionStarted) {
          sessionCleanup = attachToSession(context.getCurrentSession());
        }
      };

      context.addEventListener(
        castFramework.CastContextEventType.SESSION_STATE_CHANGED,
        onSessionChange
      );

      unsubscribe = () => {
        sessionCleanup?.();
        context.removeEventListener(
          castFramework.CastContextEventType.SESSION_STATE_CHANGED,
          onSessionChange
        );
      };
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
