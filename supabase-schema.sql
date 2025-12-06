-- =====================================================
-- SUPABASE DATABASE SCHEMA VOOR HANDBOEK GENERATOR
-- =====================================================
-- Voer deze SQL uit in Supabase Dashboard:
-- 1. Ga naar SQL Editor (links in menu)
-- 2. Klik op "New Query"
-- 3. Plak deze hele inhoud
-- 4. Klik op "Run"
-- =====================================================

-- Handboeken tabel
-- Een handboek is een verzameling hoofdstukken met gedeelde instellingen
CREATE TABLE handboeken (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  titel TEXT NOT NULL,
  beschrijving TEXT,
  niveau TEXT NOT NULL CHECK (niveau IN ('vmbo', 'havo', 'vwo', 'mbo', 'hbo', 'uni')),
  context TEXT, -- optioneel interessegebied voor personalisatie
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hoofdstukken tabel
-- Elk hoofdstuk behoort tot een handboek
CREATE TABLE hoofdstukken (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  handboek_id UUID REFERENCES handboeken(id) ON DELETE CASCADE NOT NULL,
  titel TEXT NOT NULL,
  onderwerp TEXT NOT NULL,
  content TEXT NOT NULL, -- de gegenereerde markdown content
  prompt_used TEXT, -- de gebruikte prompt (voor transparantie)
  volgorde INTEGER NOT NULL DEFAULT 0,
  lengte TEXT NOT NULL CHECK (lengte IN ('kort', 'medium', 'lang')),
  leerdoelen TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Afbeeldingen tabel
-- Afbeeldingen gekoppeld aan hoofdstukken
CREATE TABLE afbeeldingen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hoofdstuk_id UUID REFERENCES hoofdstukken(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  alt TEXT,
  photographer TEXT,
  photographer_url TEXT,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  volgorde INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) inschakelen
-- Dit zorgt ervoor dat gebruikers alleen hun eigen data kunnen zien
ALTER TABLE handboeken ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoofdstukken ENABLE ROW LEVEL SECURITY;
ALTER TABLE afbeeldingen ENABLE ROW LEVEL SECURITY;

-- Policies voor handboeken
CREATE POLICY "Gebruikers kunnen eigen handboeken zien"
  ON handboeken FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Gebruikers kunnen eigen handboeken maken"
  ON handboeken FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Gebruikers kunnen eigen handboeken updaten"
  ON handboeken FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Gebruikers kunnen eigen handboeken verwijderen"
  ON handboeken FOR DELETE
  USING (auth.uid() = user_id);

-- Policies voor hoofdstukken (via handboek ownership)
CREATE POLICY "Gebruikers kunnen hoofdstukken van eigen handboeken zien"
  ON hoofdstukken FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM handboeken
      WHERE handboeken.id = hoofdstukken.handboek_id
      AND handboeken.user_id = auth.uid()
    )
  );

CREATE POLICY "Gebruikers kunnen hoofdstukken toevoegen aan eigen handboeken"
  ON hoofdstukken FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM handboeken
      WHERE handboeken.id = hoofdstukken.handboek_id
      AND handboeken.user_id = auth.uid()
    )
  );

CREATE POLICY "Gebruikers kunnen hoofdstukken van eigen handboeken updaten"
  ON hoofdstukken FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM handboeken
      WHERE handboeken.id = hoofdstukken.handboek_id
      AND handboeken.user_id = auth.uid()
    )
  );

CREATE POLICY "Gebruikers kunnen hoofdstukken van eigen handboeken verwijderen"
  ON hoofdstukken FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM handboeken
      WHERE handboeken.id = hoofdstukken.handboek_id
      AND handboeken.user_id = auth.uid()
    )
  );

-- Policies voor afbeeldingen (via hoofdstuk -> handboek ownership)
CREATE POLICY "Gebruikers kunnen afbeeldingen van eigen hoofdstukken zien"
  ON afbeeldingen FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hoofdstukken
      JOIN handboeken ON handboeken.id = hoofdstukken.handboek_id
      WHERE hoofdstukken.id = afbeeldingen.hoofdstuk_id
      AND handboeken.user_id = auth.uid()
    )
  );

CREATE POLICY "Gebruikers kunnen afbeeldingen toevoegen aan eigen hoofdstukken"
  ON afbeeldingen FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hoofdstukken
      JOIN handboeken ON handboeken.id = hoofdstukken.handboek_id
      WHERE hoofdstukken.id = afbeeldingen.hoofdstuk_id
      AND handboeken.user_id = auth.uid()
    )
  );

CREATE POLICY "Gebruikers kunnen afbeeldingen van eigen hoofdstukken verwijderen"
  ON afbeeldingen FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM hoofdstukken
      JOIN handboeken ON handboeken.id = hoofdstukken.handboek_id
      WHERE hoofdstukken.id = afbeeldingen.hoofdstuk_id
      AND handboeken.user_id = auth.uid()
    )
  );

-- Index voor snellere queries
CREATE INDEX idx_handboeken_user_id ON handboeken(user_id);
CREATE INDEX idx_hoofdstukken_handboek_id ON hoofdstukken(handboek_id);
CREATE INDEX idx_afbeeldingen_hoofdstuk_id ON afbeeldingen(hoofdstuk_id);

-- Functie om updated_at automatisch te updaten
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers voor updated_at
CREATE TRIGGER update_handboeken_updated_at
  BEFORE UPDATE ON handboeken
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hoofdstukken_updated_at
  BEFORE UPDATE ON hoofdstukken
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
