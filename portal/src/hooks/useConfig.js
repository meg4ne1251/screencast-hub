import { useState, useEffect } from 'react';

export function useConfig() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/config.json?' + Date.now());
        if (!res.ok) throw new Error('Failed to load config');
        const data = await res.json();
        setConfig(data);
      } catch (e) {
        setError(e.message);
      }
    }
    load();
  }, []);

  return { config, error };
}
