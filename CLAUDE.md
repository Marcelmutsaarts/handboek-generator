# Handboek Generator - Project Context

## Project Overzicht
Een Next.js applicatie waarmee docenten educatieve handboeken kunnen genereren met AI. Hoofdstukken worden gegenereerd op basis van onderwerp, niveau en optionele personalisatie (interessegebied).

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Authenticatie**: Supabase Auth met Google OAuth
- **AI**: OpenRouter API (Google Gemini voor tekst, Gemini Flash voor afbeeldingen)
- **Afbeeldingen**: Pexels API (stockfoto's) of AI-gegenereerd
- **Export**: docx library voor Word export

## Belangrijke Bestanden

### Configuratie
- `.env.local` - API keys (OpenRouter, Pexels, Supabase)
- `supabase-schema.sql` - Database schema (al uitgevoerd)

### Supabase
- `src/lib/supabase/client.ts` - Browser client
- `src/lib/supabase/server.ts` - Server client
- `src/middleware.ts` - Session refresh middleware

### Authenticatie
- `src/app/login/page.tsx` - Login pagina met Google OAuth
- `src/app/auth/callback/route.ts` - OAuth callback handler
- `src/hooks/useAuth.ts` - Auth hook (user, isLoading, signOut)
- `src/components/Header.tsx` - Header met login/logout

### Hoofdstuk Generatie
- `src/app/page.tsx` - Hoofdpagina met generatie formulier
- `src/components/InputForm.tsx` - Formulier (onderwerp, niveau, context, etc.)
- `src/components/ChapterDisplay.tsx` - Weergave + export (Markdown, HTML, Word)
- `src/lib/prompts.ts` - Prompt builder met niveau-specifieke instructies
- `src/app/api/generate/route.ts` - Tekstgeneratie API (streaming)
- `src/app/api/generate-image/route.ts` - AI afbeelding generatie
- `src/app/api/images/route.ts` - Pexels stockfoto's

### Types
- `src/types/index.ts` - TypeScript types (Niveau, Lengte, FormData, etc.)

## Database Schema

### Tabellen
```sql
handboeken (id, user_id, titel, beschrijving, niveau, context, created_at, updated_at)
hoofdstukken (id, handboek_id, titel, onderwerp, content, prompt_used, volgorde, lengte, leerdoelen, created_at, updated_at)
afbeeldingen (id, hoofdstuk_id, url, alt, photographer, photographer_url, is_ai_generated, volgorde, created_at)
```

### Row Level Security
Alle tabellen hebben RLS policies zodat gebruikers alleen eigen data kunnen zien/bewerken.

## Niveaus
- VMBO (12-16 jaar) - Eenvoudige taal, korte zinnen
- HAVO (12-17 jaar) - Toegankelijk met nuance
- VWO (12-18 jaar) - Complex, kritisch denken
- MBO (16-25 jaar) - Praktijkgericht, beroepsrelevant
- HBO (18+ jaar) - Professioneel, evidence-based
- Universiteit (18+ jaar) - Academisch, wetenschappelijk

## Huidige Status

### Werkend
- [x] Hoofdstuk genereren (streaming)
- [x] Afbeeldingen (Pexels stockfoto's + AI-gegenereerd)
- [x] Export naar Markdown, HTML, Word
- [x] Google OAuth login
- [x] 6 niveaus met uitgebreide prompts
- [x] Context/personalisatie veld
- [x] Header met login/logout
- [x] `/handboeken` - Overzichtspagina (lijst handboeken, empty state)
- [x] `/handboeken/nieuw` - Nieuw handboek aanmaken
- [x] `/handboeken/[id]` - Handboek detailpagina (lijst hoofdstukken, verwijderen)

### Werkend - Fase 2
- [x] `/handboeken/[id]/nieuw-hoofdstuk` - Hoofdstuk genereren binnen handboek
- [x] Hoofdstuk opslaan naar database na generatie
- [x] Afbeeldingen opslaan naar database
- [x] `/handboeken/[id]/hoofdstuk/[hoofdstukId]` - Hoofdstuk bekijken/exporteren/verwijderen

### Nog Te Doen - Fase 3
- [ ] Eerdere hoofdstukken meesturen in prompt (voor consistentie)
- [ ] Compleet handboek exporteren als één Word document

### Nog Te Doen - Fase 4
- [ ] Inhoudsopgave generator
- [ ] Voorblad met titel en AI-gegenereerd coverbeeld

## Ontwikkel Commando's
```bash
npm run dev     # Start development server
npm run build   # Production build
npx tsc --noEmit # Type checking
```

## API Keys Nodig
- `OPENROUTER_API_KEY` - Voor tekstgeneratie
- `PEXELS_API_KEY` - Voor stockfoto's
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
