import { useCallback, useEffect, useState } from 'react';
import { matchStreamApi } from '../api/client.js';

export function useMatchStream(matchId, { enabled = true } = {}) {
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

    return matchStreamApi
      .getStream(matchId)
      .then((data) => {
        setConfig(data);
        if (!data.available) {
          setError(
            data.reason === 'not_live'
              ? 'El partido ya no está en vivo.'
              : data.reason === 'no_la18_mapping'
                ? 'No hay transmisión La18HD configurada para este partido.'
                : data.reason === 'disabled'
                  ? 'El módulo de transmisión está desactivado.'
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
  }, [matchId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, loading, error, reload };
}
