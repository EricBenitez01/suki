-- ─────────────────────────────────────────────────────────────────────────────
-- Suki · Kyrax Technology — Supabase Schema
-- Cómo usar:
--   1. Abrí tu proyecto en https://app.supabase.com
--   2. SQL Editor → New query → pegá este archivo → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Orgs (equipos de trabajo)
CREATE TABLE IF NOT EXISTS orgs (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfiles de usuario (1:1 con auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id  UUID REFERENCES orgs(id),
  nombre  TEXT,
  role    TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operador', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simulaciones del cotizador
CREATE TABLE IF NOT EXISTS simulaciones (
  id         BIGSERIAL PRIMARY KEY,
  org_id     UUID NOT NULL,
  user_id    UUID REFERENCES auth.users(id),
  nombre     TEXT NOT NULL,
  notas      TEXT DEFAULT '',
  ganador    TEXT,
  inputs     JSONB NOT NULL DEFAULT '{}',
  aereo      JSONB NOT NULL DEFAULT '{}',
  maritimo   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catálogo de productos
CREATE TABLE IF NOT EXISTS productos (
  id                       BIGSERIAL PRIMARY KEY,
  org_id                   UUID NOT NULL,
  user_id                  UUID REFERENCES auth.users(id),
  nombre                   TEXT NOT NULL,
  sku                      TEXT DEFAULT '',
  ml_pct                   NUMERIC DEFAULT 25,
  ads_pct                  NUMERIC DEFAULT 12,
  iva_pct                  NUMERIC DEFAULT 14,
  iibb_pct                 NUMERIC DEFAULT 0,
  otros_pct                NUMERIC DEFAULT 0,
  precio_actual            NUMERIC,
  costo_unit_ars           NUMERIC,
  costo_unit_usd           NUMERIC,
  costo_source             TEXT DEFAULT 'manual',
  simulacion_id            BIGINT REFERENCES simulaciones(id) ON DELETE SET NULL,
  importacion_id           BIGINT,
  importacion_producto_id  BIGINT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Importaciones
CREATE TABLE IF NOT EXISTS importaciones (
  id         BIGSERIAL PRIMARY KEY,
  org_id     UUID NOT NULL,
  user_id    UUID REFERENCES auth.users(id),
  form       JSONB NOT NULL DEFAULT '{}',
  productos  JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: crear perfil + org al registrarse un usuario nuevo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  target_org_id UUID;
  user_role     TEXT := 'admin';
  raw_org_code  TEXT;
BEGIN
  raw_org_code := NEW.raw_user_meta_data->>'org_code';

  IF raw_org_code IS NOT NULL AND raw_org_code <> '' THEN
    BEGIN
      target_org_id := raw_org_code::UUID;
    EXCEPTION WHEN others THEN
      target_org_id := NULL;
    END;
    IF target_org_id IS NOT NULL AND EXISTS (SELECT 1 FROM orgs WHERE id = target_org_id) THEN
      user_role := 'operador';
    ELSE
      target_org_id := NULL;
    END IF;
  END IF;

  IF target_org_id IS NULL THEN
    INSERT INTO orgs (nombre) VALUES (NEW.email) RETURNING id INTO target_org_id;
  END IF;

  INSERT INTO profiles (id, org_id, nombre, role)
  VALUES (
    NEW.id,
    target_org_id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    user_role
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE importaciones ENABLE ROW LEVEL SECURITY;

-- Profiles: solo el dueño puede ver/editar
CREATE POLICY "owner select" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "owner update" ON profiles FOR UPDATE USING (id = auth.uid());

-- Helper: obtiene org_id del usuario actual
CREATE OR REPLACE FUNCTION my_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: obtiene role del usuario actual
CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Simulaciones
CREATE POLICY "org read simulaciones"   ON simulaciones FOR SELECT USING (org_id = my_org_id());
CREATE POLICY "org insert simulaciones" ON simulaciones FOR INSERT WITH CHECK (org_id = my_org_id() AND my_role() IN ('admin','operador'));
CREATE POLICY "org delete simulaciones" ON simulaciones FOR DELETE USING (org_id = my_org_id() AND (user_id = auth.uid() OR my_role() = 'admin'));

-- Productos
CREATE POLICY "org read productos"   ON productos FOR SELECT USING (org_id = my_org_id());
CREATE POLICY "org insert productos" ON productos FOR INSERT WITH CHECK (org_id = my_org_id() AND my_role() IN ('admin','operador'));
CREATE POLICY "org update productos" ON productos FOR UPDATE USING (org_id = my_org_id() AND my_role() IN ('admin','operador'));
CREATE POLICY "org delete productos" ON productos FOR DELETE USING (org_id = my_org_id() AND my_role() IN ('admin','operador'));

-- Importaciones
CREATE POLICY "org read importaciones"   ON importaciones FOR SELECT USING (org_id = my_org_id());
CREATE POLICY "org insert importaciones" ON importaciones FOR INSERT WITH CHECK (org_id = my_org_id() AND my_role() IN ('admin','operador'));
CREATE POLICY "org update importaciones" ON importaciones FOR UPDATE USING (org_id = my_org_id() AND my_role() IN ('admin','operador'));
CREATE POLICY "org delete importaciones" ON importaciones FOR DELETE USING (org_id = my_org_id() AND (user_id = auth.uid() OR my_role() = 'admin'));
