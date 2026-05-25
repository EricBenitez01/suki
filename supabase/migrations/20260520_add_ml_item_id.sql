-- Add ml_item_id column to productos table
-- Links a catalog product to a MercadoLibre listing (item ID, e.g. "MLU123456789")
ALTER TABLE productos ADD COLUMN IF NOT EXISTS ml_item_id text;
