'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useApiKey } from '@/hooks/useApiKey';
import Link from 'next/link';
import ApiKeySettings from './ApiKeySettings';

export default function Header() {
  const { user, isLoading, signOut } = useAuth();
  const { hasApiKey, isLoaded } = useApiKey();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex flex-col">
            <h1 className="text-xl font-bold text-foreground">
              Handboek Generator
            </h1>
            <p className="text-secondary text-xs">
              Maak je eigen lesmateriaal met AI
            </p>
          </Link>

          <div className="flex items-center gap-4">
            {/* API Key indicator & settings button */}
            {isLoaded && (
              <button
                onClick={() => setShowSettings(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hasApiKey
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
                title={hasApiKey ? 'API key ingesteld' : 'API key nodig'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {hasApiKey ? 'API Key' : 'Stel API Key in'}
              </button>
            )}

            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-accent animate-pulse"></div>
            ) : user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/handboeken"
                  className="text-sm text-secondary hover:text-foreground transition-colors"
                >
                  Mijn handboeken
                </Link>
                <div className="flex items-center gap-2">
                  {user.user_metadata?.avatar_url && (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profielfoto"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <button
                    onClick={signOut}
                    className="text-sm text-secondary hover:text-foreground transition-colors"
                  >
                    Uitloggen
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Inloggen
              </Link>
            )}
          </div>
        </div>
      </header>

      <ApiKeySettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
