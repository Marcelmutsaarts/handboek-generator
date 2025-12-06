-- Migratie: Publieke handboeken functionaliteit
-- Voer dit uit in de Supabase SQL Editor

-- Voeg kolommen toe voor publieke toegang
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS is_publiek BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS publieke_slug TEXT UNIQUE;

-- Index voor snelle lookup op slug
CREATE INDEX IF NOT EXISTS idx_handboeken_publieke_slug ON handboeken(publieke_slug) WHERE publieke_slug IS NOT NULL;

-- RLS policy voor publieke toegang (iedereen mag publieke handboeken lezen)
CREATE POLICY "Publieke handboeken zijn leesbaar voor iedereen"
ON handboeken
FOR SELECT
USING (is_publiek = TRUE AND publieke_slug IS NOT NULL);

-- RLS policy voor publieke hoofdstukken (via handboek)
CREATE POLICY "Hoofdstukken van publieke handboeken zijn leesbaar"
ON hoofdstukken
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM handboeken
    WHERE handboeken.id = hoofdstukken.handboek_id
    AND handboeken.is_publiek = TRUE
  )
);

-- RLS policy voor afbeeldingen van publieke hoofdstukken
CREATE POLICY "Afbeeldingen van publieke handboeken zijn leesbaar"
ON afbeeldingen
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM hoofdstukken
    JOIN handboeken ON handboeken.id = hoofdstukken.handboek_id
    WHERE hoofdstukken.id = afbeeldingen.hoofdstuk_id
    AND handboeken.is_publiek = TRUE
  )
);
