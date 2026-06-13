import { useCallback, useEffect, useState } from 'react';
import { streamApi } from '../api/client.js';

export function useStreamConfig(matchId, channelId, { enabled = true } = {}) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    if (!enabled || !matchId) {
      setConfig(null);
      setError('');
      return Promise.resolve(null);
    }

    setLoading(true);
    setError('');

    return streamApi
      .getConfig(matchId, channelId)
      .then((data) => {
        setConfig(data);
        if (!data.available) {
          setError(
            data.reason === 'not_live'
              ? 'El partido ya no está en vivo.'
              : data.reason === 'no_streams'
                ? 'No hay transmisión configurada para este partido.'
                : 'Transmisión no disponible.'
          );
        }
        return data;
      })
      .catch((err) => {
        setConfig(null);
        setError(err.message || 'No se pudo cargar la transmisión.');
        return null;
      })
      .finally(() => {
        setLoading(false);
      });
  }, [matchId, channelId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, loading, error, reload };
}
