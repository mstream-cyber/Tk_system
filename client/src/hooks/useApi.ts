import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function shouldSetJson(options?: RequestInit): boolean {
  if (!options || !options.body) return false;
  if (options.body instanceof FormData) return false;
  if (options.body instanceof URLSearchParams) return false;
  return true;
}

export function useApi() {
  const navigate = useNavigate();

  const apiFetch = useCallback(async (url: string, options?: RequestInit) => {
    try {
      const headers: Record<string, string> = {
        ...(options?.headers as Record<string, string> || {}),
      };
      if (shouldSetJson(options)) {
        headers['Content-Type'] = 'application/json';
      }
      const res = await fetch(url, {
        ...options,
        headers,
      });
      if (res.status === 401) {
        navigate('/23646/login', { replace: true });
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  }, [navigate]);

  return { apiFetch };
}
