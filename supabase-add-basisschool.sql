-- =====================================================
-- MIGRATIE: Basisschool niveaus toevoegen
-- =====================================================
-- Voer deze SQL uit in Supabase Dashboard:
-- 1. Ga naar SQL Editor (links in menu)
-- 2. Klik op "New Query"
-- 3. Plak deze hele inhoud
-- 4. Klik op "Run"
-- =====================================================

-- Verwijder de oude CHECK constraint
ALTER TABLE handboeken DROP CONSTRAINT IF EXISTS handboeken_niveau_check;

-- Voeg de nieuwe CHECK constraint toe met basisschool niveaus
ALTER TABLE handboeken ADD CONSTRAINT handboeken_niveau_check
  CHECK (niveau IN ('po_onder', 'po_boven', 'vmbo', 'havo', 'vwo', 'mbo', 'hbo', 'uni'));

-- Klaar! De app ondersteunt nu ook:
-- - po_onder: Basisschool onderbouw (groep 1-4, 4-8 jaar)
-- - po_boven: Basisschool bovenbouw (groep 5-8, 8-12 jaar)
