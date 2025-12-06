-- =====================================================
-- LEERJAAR KOLOM TOEVOEGEN AAN HANDBOEKEN
-- =====================================================
-- Voer deze SQL uit in Supabase Dashboard:
-- 1. Ga naar SQL Editor
-- 2. Klik op "New Query"
-- 3. Plak deze inhoud
-- 4. Klik op "Run"
-- =====================================================

-- Voeg leerjaar kolom toe aan handboeken tabel
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS leerjaar INTEGER NOT NULL DEFAULT 1;

-- Update bestaande records met een default waarde
UPDATE handboeken SET leerjaar = 1 WHERE leerjaar IS NULL;
