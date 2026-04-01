import { useState, useEffect } from 'react';
import { api } from '../services/api';

export const useApi = (path, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.get(path);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.skip) {
      setLoading(false);
      return;
    }
    refetch();
  }, [path, options.skip]);

  return { data, loading, error, refetch };
};
