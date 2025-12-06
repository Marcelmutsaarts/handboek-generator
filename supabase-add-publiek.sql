-- Migratie: Publieke handboeken functionaliteit
-- Voer dit uit in de Supabase SQL Editor

-- Voeg kolommen toe voor publieke toegang
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS is_publiek BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS publieke_slug TEXT UNIQUE;

-- Index voor snelle lookup op slug
CREATE INDEX IF NOT EXISTS idx_handboeken_publieke_slug ON handboeken(publieke_slug) WHERE publieke_slug IS NOT NULL;

-- Extra index voor publieke handboeken (voor snelle RLS checks)
CREATE INDEX IF NOT EXISTS idx_handboeken_is_publiek ON handboeken(is_publiek) WHERE is_publiek = TRUE;

-- =====================================================
-- STAP 1: Verwijder ALLE bestaande SELECT policies
-- =====================================================
DROP POLICY IF EXISTS "Gebruikers kunnen eigen handboeken zien" ON handboeken;
DROP POLICY IF EXISTS "Publieke handboeken zijn leesbaar voor iedereen" ON handboeken;
DROP POLICY IF EXISTS "Gebruikers kunnen hoofdstukken van eigen handboeken zien" ON hoofdstukken;
DROP POLICY IF EXISTS "Hoofdstukken van publieke handboeken zijn leesbaar" ON hoofdstukken;
DROP POLICY IF EXISTS "Gebruikers kunnen afbeeldingen van eigen hoofdstukken zien" ON afbeeldingen;
DROP POLICY IF EXISTS "Afbeeldingen van publieke handboeken zijn leesbaar" ON afbeeldingen;
DROP POLICY IF EXISTS "Afbeeldingen voor eigen hoofdstukken" ON afbeeldingen;

-- =====================================================
-- STAP 2: Policies voor handboeken en hoofdstukken
-- =====================================================

-- Policy voor handboeken (eigen OF publiek)
CREATE POLICY "Gebruikers kunnen eigen handboeken zien"
ON handboeken FOR SELECT TO anon, authenticated
USING (auth.uid() = user_id OR (is_publiek = TRUE AND publieke_slug IS NOT NULL));

-- Policy voor hoofdstukken (eigen OF publiek)
CREATE POLICY "Gebruikers kunnen hoofdstukken van eigen handboeken zien"
ON hoofdstukken FOR SELECT TO anon, authenticated
USING (
  handboek_id IN (SELECT id FROM handboeken WHERE user_id = auth.uid() OR is_publiek = TRUE)
);

-- =====================================================
-- STAP 3: Simpele policy voor afbeeldingen
-- Alle afbeeldingen zijn leesbaar (ze zijn toch alleen
-- bereikbaar via hoofdstukken die al RLS hebben)
-- =====================================================
CREATE POLICY "Afbeeldingen zijn leesbaar"
ON afbeeldingen FOR SELECT TO anon, authenticated
USING (true);

-- =====================================================
-- STAP 4: Database functie als backup (voor als policy traag is)
-- =====================================================
DROP FUNCTION IF EXISTS get_public_afbeeldingen(UUID[]);

CREATE OR REPLACE FUNCTION get_public_afbeeldingen(p_hoofdstuk_ids UUID[])
RETURNS SETOF afbeeldingen
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT a.* FROM afbeeldingen a
  INNER JOIN hoofdstukken h ON h.id = a.hoofdstuk_id
  INNER JOIN handboeken hb ON hb.id = h.handboek_id
  WHERE a.hoofdstuk_id = ANY(p_hoofdstuk_ids)
  AND hb.is_publiek = TRUE
  ORDER BY a.volgorde ASC;
$$;

GRANT EXECUTE ON FUNCTION get_public_afbeeldingen(UUID[]) TO anon, authenticated;
