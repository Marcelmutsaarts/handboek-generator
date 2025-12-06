-- =====================================================
-- TEMPLATE KOLOMMEN TOEVOEGEN AAN HANDBOEKEN
-- =====================================================
-- Voer deze SQL uit in Supabase Dashboard:
-- 1. Ga naar SQL Editor
-- 2. Klik op "New Query"
-- 3. Plak deze inhoud
-- 4. Klik op "Run"
-- =====================================================

-- Voeg template kolom toe aan handboeken tabel
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'klassiek';

-- Voeg custom_secties kolom toe (JSONB voor flexibele structuur)
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS custom_secties JSONB DEFAULT NULL;

-- Update bestaande records
UPDATE handboeken SET template = 'klassiek' WHERE template IS NULL;
