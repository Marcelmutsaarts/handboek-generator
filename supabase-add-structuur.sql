-- =====================================================
-- STRUCTUUR KOLOM TOEVOEGEN AAN HANDBOEKEN
-- =====================================================
-- Voer deze SQL uit in Supabase Dashboard:
-- 1. Ga naar SQL Editor
-- 2. Klik op "New Query"
-- 3. Plak deze inhoud
-- 4. Klik op "Run"
-- =====================================================

-- Voeg structuur kolom toe aan handboeken tabel (JSONB voor flexibele structuur)
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS structuur JSONB DEFAULT NULL;

-- De structuur bevat een array van geplande hoofdstukken:
-- {
--   "hoofdstukken": [
--     {
--       "id": "uuid",
--       "titel": "Hoofdstuk titel",
--       "beschrijving": "Korte beschrijving",
--       "paragrafen": ["Paragraaf 1", "Paragraaf 2"],
--       "status": "pending" | "generated",
--       "hoofdstukId": "uuid van gegenereerd hoofdstuk (optioneel)"
--     }
--   ]
-- }
