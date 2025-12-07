-- Migratie: Boekkaft en afbeelding captions
-- Voer dit uit in de Supabase SQL Editor

-- Voeg cover_url kolom toe aan handboeken
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Voeg caption kolom toe aan afbeeldingen
ALTER TABLE afbeeldingen
ADD COLUMN IF NOT EXISTS caption TEXT;
