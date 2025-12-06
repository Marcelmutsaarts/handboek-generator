'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function Header() {
  const { user, isLoading, signOut } = useAuth();

  return (
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
  );
}
