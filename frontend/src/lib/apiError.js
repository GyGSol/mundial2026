/**
 * Mensaje legible para fallos de red / servidor caído (p. ej. MongoDB sin levantar).
 */
export function formatRequestError(err, response, data = {}) {
  const serverMessage = data?.error || data?.message;

  if (err instanceof TypeError) {
    const msg = err.message || '';
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('fetch')) {
      return [
        'No se pudo conectar con el servidor de la aplicación.',
        'En local: verificá que MongoDB esté activo (puerto 27017) y que el backend haya arrancado sin errores (`npm run dev`).',
        'Si usás Atlas, revisá MONGODB_URI en el archivo .env.',
      ].join(' ');
    }
  }

  if (response) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return (
        serverMessage ||
        'El servidor no está disponible temporalmente. Revisá que el backend y la base de datos estén en marcha.'
      );
    }
    if (response.status >= 500) {
      return serverMessage || `Error del servidor (${response.status}).`;
    }
    if (serverMessage) return serverMessage;
    return `Request failed (${response.status})`;
  }

  if (err?.message) return err.message;
  return 'Ocurrió un error inesperado.';
}

export function isSevereError(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('no se pudo conectar') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('servidor no está disponible') ||
    lower.includes('econnrefused') ||
    lower.includes('mongoserverselection') ||
    lower.includes('mongodb')
  );
}
