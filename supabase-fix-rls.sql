-- =====================================================
-- FIX: Row Level Security voor Handboeken
-- =====================================================
-- Dit lost het probleem op waarbij gebruikers elkaars
-- handboeken kunnen zien.
-- =====================================================

-- Stap 1: Verwijder oude policies (worden opnieuw aangemaakt)
DROP POLICY IF EXISTS "Gebruikers kunnen eigen handboeken zien" ON handboeken;
DROP POLICY IF EXISTS "Gebruikers kunnen eigen handboeken maken" ON handboeken;
DROP POLICY IF EXISTS "Gebruikers kunnen eigen handboeken updaten" ON handboeken;
DROP POLICY IF EXISTS "Gebruikers kunnen eigen handboeken verwijderen" ON handboeken;

-- Stap 2: Zorg dat RLS is ingeschakeld
ALTER TABLE handboeken ENABLE ROW LEVEL SECURITY;

-- Stap 3: Maak de policies opnieuw aan (met correcte beveiliging)

-- Policy 1: Gebruikers kunnen alleen hun EIGEN handboeken zien
CREATE POLICY "Gebruikers kunnen eigen handboeken zien"
  ON handboeken FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Gebruikers kunnen alleen handboeken maken met hun eigen user_id
CREATE POLICY "Gebruikers kunnen eigen handboeken maken"
  ON handboeken FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Gebruikers kunnen alleen hun EIGEN handboeken updaten
CREATE POLICY "Gebruikers kunnen eigen handboeken updaten"
  ON handboeken FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy 4: Gebruikers kunnen alleen hun EIGEN handboeken verwijderen
CREATE POLICY "Gebruikers kunnen eigen handboeken verwijderen"
  ON handboeken FOR DELETE
  USING (auth.uid() = user_id);

-- Klaar! Elke gebruiker ziet nu alleen zijn/haar eigen handboeken.
