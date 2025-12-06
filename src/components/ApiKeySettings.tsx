'use client';

import { useState, useEffect } from 'react';
import { useApiKey } from '@/hooks/useApiKey';

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeySettings({ isOpen, onClose }: ApiKeySettingsProps) {
  const { apiKey, setApiKey, isLoaded } = useApiKey();
  const [inputValue, setInputValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isLoaded && apiKey) {
      setInputValue(apiKey);
    }
  }, [isLoaded, apiKey]);

  useEffect(() => {
    if (isOpen) {
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedKey = inputValue.trim();
    if (trimmedKey) {
      setApiKey(trimmedKey);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const handleRemove = () => {
    setApiKey(null);
    setInputValue('');
    setSaved(false);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••••••' + key.slice(-4);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">API Instellingen</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
              OpenRouter API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                id="apiKey"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full px-4 py-3 pr-20 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground transition-colors"
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>Veiligheid:</strong> Je API key wordt alleen lokaal opgeslagen in je browser en direct naar onze server gestuurd voor het maken van API calls. De key wordt nergens anders opgeslagen.
            </p>
          </div>

          <div className="bg-accent rounded-lg p-3">
            <p className="text-xs text-secondary">
              Nog geen API key? Maak er een aan op{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>

          {apiKey && (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-green-800">Key opgeslagen</p>
                <p className="text-xs text-green-700 font-mono">{maskKey(apiKey)}</p>
              </div>
              <button
                onClick={handleRemove}
                className="text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Verwijderen
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-secondary hover:text-foreground hover:border-foreground transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleSave}
              disabled={!inputValue.trim() || saved}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saved ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Opgeslagen!
                </>
              ) : (
                'Opslaan'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
