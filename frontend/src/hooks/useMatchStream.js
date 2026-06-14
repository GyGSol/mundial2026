import { useCallback, useEffect, useState } from 'react';
import { matchStreamApi } from '../api/client.js';

export function useMatchStream(matchId, { enabled = true } = {}) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState(null);

  const reload = useCallback(
    (nextSourceId) => {
      if (!enabled || !matchId) {
        setConfig(null);
        setError('');
        return Promise.resolve(null);
      }

      setLoading(true);
      setError('');

      return matchStreamApi
        .getStream(matchId, nextSourceId ? { sourceId: nextSourceId } : {})
        .then((data) => {
          setConfig(data);
          if (data.selectedSourceId) {
            setSelectedSourceId(data.selectedSourceId);
          } else if (nextSourceId) {
            setSelectedSourceId(nextSourceId);
          }

          if (!data.available) {
            setError(
              data.reason === 'not_available' || data.reason === 'not_live'
                ? 'La transmisión todavía no está disponible.'
                : data.reason === 'no_la18_mapping'
                  ? 'No hay transmisión La18HD configurada para este partido.'
                  : data.reason === 'disabled'
                    ? 'El módulo de transmisión está desactivado.'
                    : 'Transmisión no disponible.'
            );
          } else {
            setError('');
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
    },
    [matchId, enabled]
  );

  const selectSource = useCallback(
    (sourceId) => {
      if (!sourceId || sourceId === selectedSourceId) return Promise.resolve(config);
      setSelectedSourceId(sourceId);
      return reload(sourceId);
    },
    [reload, selectedSourceId, config]
  );

  useEffect(() => {
    setSelectedSourceId(null);
    reload();
  }, [matchId, enabled, reload]);

  return { config, loading, error, reload, selectSource, selectedSourceId };
}
