import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useApi() {
  const navigate = useNavigate();

  const apiFetch = useCallback(async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });
      if (res.status === 401) {
        navigate('/admin/login', { replace: true });
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  }, [navigate]);

  return { apiFetch };
}
