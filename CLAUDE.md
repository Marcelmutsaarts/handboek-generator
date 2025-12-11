# Handboek Generator - Project Context

## Project Overzicht
Een Next.js applicatie waarmee docenten educatieve handboeken kunnen genereren met AI. Hoofdstukken worden gegenereerd op basis van onderwerp, niveau, template en optionele personalisatie (interessegebied).

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Authenticatie**: Supabase Auth met Google OAuth
- **AI**: OpenRouter API (Google Gemini voor tekst én afbeeldingen)
- **Afbeeldingen**: Pexels API (stockfoto's) of AI-gegenereerd via OpenRouter
- **Export**: docx library voor Word export

## Belangrijke Bestanden

### Configuratie
- `.env.local` - API keys (OpenRouter, Pexels, Supabase)
- `supabase-schema.sql` - Database schema
- `supabase-add-leerjaar.sql` - Migratie voor leerjaar kolom
- `supabase-add-template.sql` - Migratie voor template kolommen

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
- `src/components/InputForm.tsx` - Formulier (onderwerp, niveau, context, template, etc.)
- `src/components/ChapterDisplay.tsx` - Weergave + export (Markdown, HTML, Word)
- `src/components/ChapterEditor.tsx` - Bewerken (handmatig + AI herschrijven)
- `src/components/TemplateSelector.tsx` - Template keuze UI
- `src/lib/prompts.ts` - Prompt builder met niveau-specifieke instructies en templates
- `src/app/api/generate/route.ts` - Tekstgeneratie API (streaming)
- `src/app/api/generate-image/route.ts` - AI afbeelding generatie via OpenRouter
- `src/app/api/images/route.ts` - Pexels stockfoto's
- `src/app/api/rewrite/route.ts` - AI herschrijven van secties

### Handboeken
- `src/app/handboeken/page.tsx` - Overzicht alle handboeken
- `src/app/handboeken/nieuw/page.tsx` - Nieuw handboek aanmaken
- `src/app/handboeken/[id]/page.tsx` - Handboek detail met hoofdstukken
- `src/app/handboeken/[id]/preview/page.tsx` - Preview met voorblad en inhoudsopgave
- `src/app/handboeken/[id]/nieuw-hoofdstuk/page.tsx` - Hoofdstuk genereren
- `src/app/handboeken/[id]/hoofdstuk/[hoofdstukId]/page.tsx` - Hoofdstuk bekijken/bewerken

### Types
- `src/types/index.ts` - TypeScript types (Niveau, Lengte, FormData, Template, etc.)

## Database Schema

### Tabellen
```sql
handboeken (
  id, user_id, titel, beschrijving, niveau, leerjaar, context,
  template, custom_secties, created_at, updated_at
)
hoofdstukken (
  id, handboek_id, titel, onderwerp, content, prompt_used,
  volgorde, lengte, leerdoelen, created_at, updated_at
)
afbeeldingen (
  id, hoofdstuk_id, url, alt, photographer, photographer_url,
  is_ai_generated, volgorde, created_at
)
```

### Row Level Security
Alle tabellen hebben RLS policies zodat gebruikers alleen eigen data kunnen zien/bewerken.

## Niveaus & Leerjaren
- Basisschool onderbouw (4-8 jaar) - Groep 1-4, zeer eenvoudige taal, speels
- Basisschool bovenbouw (8-12 jaar) - Groep 5-8, eenvoudige taal, concreet
- VMBO (12-16 jaar) - Jaar 1-4, eenvoudige taal
- HAVO (12-17 jaar) - Jaar 1-5, toegankelijk met nuance
- VWO (12-18 jaar) - Jaar 1-6, complex, kritisch denken
- MBO (16-25 jaar) - Jaar 1-4, praktijkgericht
- HBO (18+ jaar) - Jaar 1-4, professioneel
- Universiteit (18+ jaar) - Jaar 1-3, academisch

## Templates
- **Klassiek** - Inleiding, Theorie, Voorbeelden, Verdieping, Opdrachten, Samenvatting
- **Praktisch** - Doel, Benodigdheden, Stap voor stap, Uitleg, Veelgemaakte fouten, Zelf proberen, Checklist
- **Onderzoekend** - Onderzoeksvraag, Voorkennis, Bronnen & methode, Bevindingen, Conclusie, Discussie
- **Toetsvoorbereiding** - Leerdoelen, Kernbegrippen, Theorie samengevat, Voorbeeldvragen, Oefenopgaven, Tips
- **Aangepast** - Gebruiker definieert eigen secties

## Huidige Status

### Werkend
- [x] Hoofdstuk genereren (streaming)
- [x] 4 voorgedefinieerde templates + custom
- [x] Afbeeldingen (Pexels stockfoto's + AI-gegenereerd)
- [x] Infographic generatie (optioneel als laatste afbeelding bij AI-gegenereerd)
- [x] Export naar Markdown, HTML, Word
- [x] Google OAuth login
- [x] 6 niveaus met leerjaren
- [x] Context/personalisatie veld
- [x] Handboeken CRUD
- [x] Hoofdstukken CRUD
- [x] Eerdere hoofdstukken context in prompt
- [x] Compleet handboek exporteren
- [x] Preview met voorblad en inhoudsopgave
- [x] Hoofdstuk bewerken (handmatig)
- [x] AI herschrijven van (delen van) hoofdstukken
- [x] Publiek delen met SSR voor snelle load
- [x] Image compressie en parallelle uploads

## AI Models - BELANGRIJK: NOOIT AANPASSEN!

### ⚠️ KRITISCH: Deze models zijn GEFIXEERD - NIET wijzigen zonder expliciete toestemming!

### Tekst Generatie
- **Model**: `google/gemini-3-pro-preview`
- **Locatie**: `src/app/api/generate/route.ts`
- **Gebruik**: Alle hoofdstuk tekst generatie

### Afbeelding Generatie
- **Reguliere afbeeldingen**: `google/gemini-2.5-flash-image`
  - Aspect ratio: 16:9
  - Locatie: `src/app/api/generate-image/route.ts`

- **Infographics**: `google/gemini-3-pro-image-preview`
  - Aspect ratio: 1:1
  - Locatie: `src/app/api/generate-image/route.ts`

- **Cover afbeeldingen**: `google/gemini-3-pro-image-preview`
  - Aspect ratio: 3:4
  - Locatie: `src/app/api/generate-cover/route.ts`

### API Format voor Gemini Images
Gemini image models vereisen:
```typescript
{
  model: 'google/gemini-...',
  messages: [...],
  modalities: ['image', 'text'],
  image_config: {
    aspect_ratio: '16:9' // of '1:1', '3:4'
  }
}
```

Response format:
```typescript
data.choices[0].message.images[0].image_url.url
// of
data.choices[0].message.content[0].image_url.url
```

## Afbeelding Generatie

### Infographic Feature
Wanneer "AI-gegenereerd" is geselecteerd voor afbeeldingen, kan de gebruiker optioneel kiezen voor "Laatste afbeelding als infographic". Dit genereert een gedetailleerde visuele samenvatting van het hoofdstuk met:
- Centrale titel en 4-6 duidelijke secties
- Iconen, diagrammen en flowcharts
- Data visualisaties (grafieken, timelines)
- Korte, puntige teksten en highlight boxes
- Professioneel educatief kleurenschema

## Ontwikkel Commando's
```bash
npm run dev     # Start development server
npm run build   # Production build
npx tsc --noEmit # Type checking
```

## API Keys

### Gebruiker API Key (vereist)
Gebruikers moeten hun eigen OpenRouter API key invoeren via de instellingen knop in de header. De key wordt:
- Opgeslagen in localStorage (lokaal in de browser)
- Meegestuurd in de `X-OpenRouter-Key` header naar de API routes
- Nooit opgeslagen op de server

### Environment Variables (alleen Supabase en Pexels)
- `PEXELS_API_KEY` - Voor stockfoto's
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Gerelateerde bestanden
- `src/hooks/useApiKey.ts` - Hook voor API key management
- `src/components/ApiKeySettings.tsx` - Modal voor key invoer

## Deployment
- **GitHub**: https://github.com/Marcelmutsaarts/handboek-generator
- **Hosting**: Vercel (configureer environment variables)
- **Database**: Supabase (voer SQL migraties uit)

## Performance & Stabiliteit

### Geïmplementeerde optimalisaties
- **SSR voor publieke pagina's**: `/publiek/[slug]` is server-side rendered, geen JavaScript nodig
- **Parallelle image uploads**: Uploads gaan in batches van 3 tegelijk (i.p.v. sequentieel)
- **Image compressie**: Afbeeldingen worden gecomprimeerd voor upload (max 1920px, 80% quality)
- **Retry-logica**: Alle uploads hebben 3 pogingen met exponential backoff
- **API timeouts**: Alle externe API calls hebben timeouts:
  - Tekst generatie: 120s
  - Image generatie: 60s
  - Cover generatie: 60s
  - Rewrite: 60s
  - Structure: 30s
  - Caption: 15s
  - Pexels: 10s
- **Caching**: Publieke HTML gecached voor 60s, images voor 1 jaar

### Publiek delen flow
1. Afbeeldingen worden parallel gecomprimeerd en geüpload naar Supabase Storage
2. HTML wordt gegenereerd met Storage URLs (niet base64)
3. HTML wordt geüpload naar Storage
4. Database slaat alleen `is_publiek` en `publieke_slug` op (geen HTML meer)
5. Publieke pagina fetcht HTML direct van Storage (SSR, geen client JS nodig)
