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
- [x] Kwaliteitscontrole met selectieve feedback verwerking

## Kwaliteitscontrole

### Workflow
1. **Analyseren**: AI analyseert het hoofdstuk op 4 criteria:
   - Bias & Inclusiviteit (genderneutraliteit, culturele aannames, diversiteit)
   - Helderheid & Begrijpelijkheid (taalgebruik, zinslengte, uitleg)
   - Didactische Kwaliteit (structuur, voorbeelden, opbouw)
   - Niveau-geschiktheid (taal en diepgang passend bij het niveau)

2. **Feedback per criterium**: Elk criterium krijgt:
   - Een score (1-5)
   - Concrete feedback punten met voorbeelden

3. **Selectieve verwerking**: Gebruiker kan per feedback punt kiezen:
   - Aanvinken welke feedback punten verwerkt moeten worden
   - AI past alleen geselecteerde feedback toe
   - Structuur, afbeeldingen en bronnen blijven intact

### Gerelateerde bestanden
- `src/app/api/quality-check/route.ts` - Analyseert content en geeft feedback
- `src/app/api/improve-content/route.ts` - Verwerkt geselecteerde feedback
- `src/components/QualityFeedbackModal.tsx` - UI voor feedback selectie

## AI Models - BELANGRIJK: NOOIT AANPASSEN!

### ⚠️ KRITISCH: Deze models zijn GEFIXEERD - NIET wijzigen zonder expliciete toestemming!

### Tekst Generatie
- **Model**: `google/gemini-3-pro-preview`
- **Locaties**:
  - `src/app/api/generate/route.ts` - Hoofdstuk generatie
  - `src/app/api/quality-check/route.ts` - Kwaliteitscontrole
  - `src/app/api/improve-content/route.ts` - Content verbetering
- **Gebruik**: Alle tekst generatie, analyse en verbetering

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
  - Quality check: 60s
  - Improve content: 120s
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

## Security

### XSS Protection
- **Safe Markdown Rendering**: `src/lib/safeMarkdown.ts` - Unified/remark/rehype pipeline met sanitization
- **Blocks**: `<script>`, event handlers, `<iframe>`, `javascript:` protocol
- **Allows**: Headings, lists, tables, links, images, code blocks, LaTeX formulas
- **Testing**: `http://localhost:3000/test-xss`
- **Documentation**: `XSS-PROTECTION-SUMMARY.md`

### SSRF Protection (verify-sources API)
- **HTTPS-only**: Rejects http://, ftp://, file:// protocols
- **Private IP blocking**: 127.x, 10.x, 192.168.x, 169.254.x, localhost
- **DNS resolution checks**: Resolves hostnames and blocks if ANY IP is private
- **Credential rejection**: Blocks URLs with username/password
- **Rate limiting**: 10 requests per IP per minute (in-memory)
- **Concurrency limiting**: Max 3 parallel fetches
- **Redirect limiting**: Max 2 redirects per URL
- **Timeout enforcement**: 5 seconds per URL
- **No body downloads**: HEAD requests + Range: bytes=0-0
- **Testing**: `http://localhost:3000/test-ssrf`
- **Documentation**: `SSRF-PROTECTION.md`

### Slug Validation (upload-public-html API)
- **Strict validation**: Lowercase a-z, 0-9, hyphen only
- **Max length**: 60 characters
- **Path traversal blocking**: No `..`, `/`, `\`, `%2f`, `%5c`
- **Position rules**: Must start with letter/number, cannot end with hyphen
- **No encoding**: Blocks all `%` characters
- **No special chars**: Blocks whitespace, underscores, etc.
- **Testing**: `http://localhost:3000/test-slug`
- **Documentation**: `SLUG-SECURITY.md`

### Content Security Policy (CSP) & Security Headers
- **Implementation**: `next.config.ts` - Applied globally to all routes
- **CSP Directives**:
  - `default-src 'self'` - Only allow resources from same origin
  - `script-src 'self' 'unsafe-eval'` - Scripts from same origin only (eval for Next.js)
  - `style-src 'self' 'unsafe-inline'` - Styles from same origin + inline (for Tailwind)
  - `img-src 'self' https: data: blob:` - Images from HTTPS sources + data URIs
  - `connect-src 'self' https:` - API calls to HTTPS endpoints (Supabase, OpenRouter)
  - `object-src 'none'` - Block plugins (Flash, Java)
  - `frame-ancestors 'none'` - Prevent clickjacking
  - `form-action 'self'` - Forms submit to same origin only
- **Complementary Headers**:
  - `X-Content-Type-Options: nosniff` - Prevent MIME-type sniffing
  - `Referrer-Policy: strict-origin-when-cross-origin` - Control referrer information
  - `Permissions-Policy` - Disable camera, microphone, geolocation
  - `X-Frame-Options: DENY` - Prevent framing (clickjacking)
  - `Strict-Transport-Security` - Force HTTPS (public routes only)
- **Defense-in-Depth**: Works with XSS sanitization for layered protection
- **Documentation**: `CSP-SECURITY.md`

### Gerelateerde bestanden
- `next.config.ts` - CSP and security headers configuration
- `src/lib/urlSafety.ts` - URL validation, SSRF protection utilities
- `src/lib/rateLimiter.ts` - In-memory rate limiting
- `src/lib/safeMarkdown.ts` - XSS-safe markdown rendering
- `src/lib/slug.ts` - Slug validation, path traversal protection
- `src/app/api/verify-sources/route.ts` - SSRF-hardened source verification
- `src/app/api/upload-public-html/route.ts` - Slug-validated file uploads
- `src/lib/__tests__/urlSafety.test.ts` - SSRF protection tests
- `src/lib/__tests__/xss-protection.test.ts` - XSS protection tests
- `src/lib/__tests__/slug.test.ts` - Slug validation tests
