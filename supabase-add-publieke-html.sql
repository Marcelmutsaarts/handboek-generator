-- Migratie: Statische HTML voor publieke handboeken
-- Dit zorgt voor snellere laadtijden en minder database queries

-- Voeg kolom toe voor opgeslagen HTML
ALTER TABLE handboeken
ADD COLUMN IF NOT EXISTS publieke_html TEXT;

-- Index voor snellere lookup (slug is al geïndexeerd)
COMMENT ON COLUMN handboeken.publieke_html IS 'Pre-rendered HTML voor publieke weergave - bevat alle content en afbeeldingen inline';
