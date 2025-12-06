'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'openrouter_api_key';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    setApiKeyState(stored);
    setIsLoaded(true);
  }, []);

  const setApiKey = (key: string | null) => {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setApiKeyState(key);
  };

  const hasApiKey = !!apiKey;

  return {
    apiKey,
    setApiKey,
    hasApiKey,
    isLoaded,
  };
}

// Helper to get API key headers for fetch calls
export function getApiKeyHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const key = localStorage.getItem(STORAGE_KEY);
  if (!key) return {};

  return {
    'X-OpenRouter-Key': key,
  };
}
