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
-- BELANGRIJKE FIX: Vervang bestaande SELECT policies
-- De oude policies werken alleen voor eigen data.
-- De nieuwe policies werken voor eigen data OF publieke data.
-- =====================================================

-- Verwijder ALLE bestaande SELECT policies
DROP POLICY IF EXISTS "Gebruikers kunnen eigen handboeken zien" ON handboeken;
DROP POLICY IF EXISTS "Publieke handboeken zijn leesbaar voor iedereen" ON handboeken;
DROP POLICY IF EXISTS "Gebruikers kunnen hoofdstukken van eigen handboeken zien" ON hoofdstukken;
DROP POLICY IF EXISTS "Hoofdstukken van publieke handboeken zijn leesbaar" ON hoofdstukken;
DROP POLICY IF EXISTS "Gebruikers kunnen afbeeldingen van eigen hoofdstukken zien" ON afbeeldingen;
DROP POLICY IF EXISTS "Afbeeldingen van publieke handboeken zijn leesbaar" ON afbeeldingen;

-- Nieuwe gecombineerde policy voor handboeken (eigen OF publiek)
CREATE POLICY "Gebruikers kunnen eigen handboeken zien"
ON handboeken
FOR SELECT
TO anon, authenticated
USING (
  auth.uid() = user_id
  OR (is_publiek = TRUE AND publieke_slug IS NOT NULL)
);

-- Nieuwe gecombineerde policy voor hoofdstukken (eigen OF publiek)
CREATE POLICY "Gebruikers kunnen hoofdstukken van eigen handboeken zien"
ON hoofdstukken
FOR SELECT
TO anon, authenticated
USING (
  handboek_id IN (
    SELECT id FROM handboeken
    WHERE user_id = auth.uid() OR is_publiek = TRUE
  )
);

-- Voor afbeeldingen: APARTE policies voor authenticated en anon
-- Dit voorkomt de trage subquery voor anon users

-- Policy voor ingelogde gebruikers (eigen handboeken)
CREATE POLICY "Afbeeldingen voor eigen hoofdstukken"
ON afbeeldingen
FOR SELECT
TO authenticated
USING (
  hoofdstuk_id IN (
    SELECT h.id FROM hoofdstukken h
    INNER JOIN handboeken hb ON hb.id = h.handboek_id
    WHERE hb.user_id = auth.uid()
  )
);

-- Policy voor publieke afbeeldingen (iedereen, inclusief anon)
-- Directe lookup via hoofdstuk_id zonder subquery
CREATE POLICY "Afbeeldingen van publieke handboeken"
ON afbeeldingen
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM hoofdstukken h, handboeken hb
    WHERE h.id = afbeeldingen.hoofdstuk_id
    AND hb.id = h.handboek_id
    AND hb.is_publiek = TRUE
  )
);

-- =====================================================
-- ALTERNATIEF: Database functie voor publieke afbeeldingen
-- Gebruik deze functie als de RLS policies te traag zijn
-- =====================================================
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

-- Geef anon en authenticated toegang tot de functie
GRANT EXECUTE ON FUNCTION get_public_afbeeldingen(UUID[]) TO anon, authenticated;
