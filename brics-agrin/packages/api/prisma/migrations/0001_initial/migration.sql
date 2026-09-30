-- Migration: 0001_initial
-- BRICS AgriN — Initial schema with PostGIS support

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('FARMER', 'ADVISOR', 'ADMIN');
CREATE TYPE farm_category AS ENUM ('MARGINAL', 'SMALL', 'SEMI_MEDIUM', 'MEDIUM', 'LARGE');
CREATE TYPE irrigation_type AS ENUM ('RAINFED', 'CANAL', 'DRIP', 'SPRINKLER', 'FLOOD', 'FURROW', 'SUBSURFACE');
CREATE TYPE farming_practice AS ENUM ('CONVENTIONAL', 'ORGANIC', 'INTEGRATED', 'REGENERATIVE', 'ZERO_TILLAGE', 'MIXED');
CREATE TYPE crop_growth_stage AS ENUM (
  'GERMINATION','SEEDLING','VEGETATIVE','TILLERING',
  'JOINTING','BOOTING','HEADING','FLOWERING',
  'GRAIN_FILLING','MATURITY','HARVEST'
);
CREATE TYPE data_type AS ENUM ('OBSERVED','PREDICTED','MODEL_DERIVED','RULE_BASED','AI_GENERATED','HISTORICAL');
CREATE TYPE advisory_category AS ENUM (
  'IRRIGATION','FERTILIZATION','PEST_MANAGEMENT','DISEASE_MANAGEMENT',
  'HARVEST_TIMING','SOIL_HEALTH','CROP_ROTATION','WEATHER_ALERT',
  'REGENERATIVE_PRACTICE','GENERAL'
);
CREATE TYPE risk_level AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE diagnostic_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','LOW_CONFIDENCE','INCONCLUSIVE');
CREATE TYPE provider_type AS ENUM ('WEATHER','SATELLITE','SOIL','GOVERNMENT','BRICS_NETWORK');

-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role    NOT NULL DEFAULT 'FARMER',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  is_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- ── refresh_tokens ────────────────────────────────────────────────────────────

CREATE TABLE refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  user_agent  VARCHAR(500),
  ip_address  VARCHAR(45)
);
CREATE INDEX idx_rt_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_rt_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_rt_expires_at ON refresh_tokens(expires_at);

-- ── farmer_profiles ───────────────────────────────────────────────────────────

CREATE TABLE farmer_profiles (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  country       CHAR(2)       NOT NULL,
  language      VARCHAR(10)   NOT NULL,
  farm_category farm_category NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fp_country ON farmer_profiles(country);

-- ── farms ─────────────────────────────────────────────────────────────────────

CREATE TABLE farms (
  id                UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_profile_id UUID             NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
  name              VARCHAR(100)     NOT NULL,
  location_lat      DECIMAL(9,6)     NOT NULL CHECK (location_lat BETWEEN -90 AND 90),
  location_lon      DECIMAL(9,6)     NOT NULL CHECK (location_lon BETWEEN -180 AND 180),
  location_geom     geometry(Point, 4326),
  area_hectares     DECIMAL(10,4)    NOT NULL CHECK (area_hectares > 0),
  farm_category     farm_category    NOT NULL,
  country           CHAR(2)          NOT NULL,
  irrigation_type   irrigation_type  NOT NULL,
  farming_practice  farming_practice NOT NULL,
  created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_farms_farmer_profile_id ON farms(farmer_profile_id);
CREATE INDEX idx_farms_country           ON farms(country);
CREATE INDEX idx_farms_deleted_at        ON farms(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_farms_geom              ON farms USING GIST(location_geom);

-- ── fields ────────────────────────────────────────────────────────────────────

CREATE TABLE fields (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id       UUID         NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  area_hectares DECIMAL(10,4) NOT NULL CHECK (area_hectares > 0),
  boundary_json JSONB,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_fields_farm_id    ON fields(farm_id);
CREATE INDEX idx_fields_deleted_at ON fields(deleted_at) WHERE deleted_at IS NULL;

-- ── crop_cycles ───────────────────────────────────────────────────────────────

CREATE TABLE crop_cycles (
  id                    UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id              UUID              NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  crop_name             VARCHAR(100)      NOT NULL,
  crop_variety          VARCHAR(100),
  growth_stage          crop_growth_stage NOT NULL,
  sowing_date           DATE              NOT NULL,
  expected_harvest_date DATE,
  actual_harvest_date   DATE,
  is_active             BOOLEAN           NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cc_field_id  ON crop_cycles(field_id);
CREATE INDEX idx_cc_is_active ON crop_cycles(is_active) WHERE is_active = TRUE;

-- ── soil_observations ─────────────────────────────────────────────────────────

CREATE TABLE soil_observations (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id               UUID        NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  observed_at            TIMESTAMPTZ NOT NULL,
  ph_level               DECIMAL(4,2),
  organic_carbon_percent DECIMAL(5,3),
  nitrogen_kg_per_ha     DECIMAL(8,2),
  phosphorus_kg_per_ha   DECIMAL(8,2),
  potassium_kg_per_ha    DECIMAL(8,2),
  moisture_percent       DECIMAL(5,2),
  texture_class          VARCHAR(50),
  source                 VARCHAR(100) NOT NULL,
  data_type              data_type    NOT NULL,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_soil_field_id    ON soil_observations(field_id);
CREATE INDEX idx_soil_observed_at ON soil_observations(observed_at DESC);

-- ── advisories ────────────────────────────────────────────────────────────────

CREATE TABLE advisories (
  id               UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id          UUID              NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_cycle_id    UUID              REFERENCES crop_cycles(id) ON DELETE SET NULL,
  category         advisory_category NOT NULL,
  recommendation   TEXT              NOT NULL,
  reason           TEXT              NOT NULL,
  action_timing    TEXT              NOT NULL,
  risk_addressed   TEXT              NOT NULL,
  env_impact       TEXT              NOT NULL,
  confidence       DECIMAL(4,3)      NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  risk_level       risk_level        NOT NULL,
  language         VARCHAR(10)       NOT NULL,
  model_version    VARCHAR(50)       NOT NULL,
  evidence_json    JSONB             NOT NULL,
  generated_at     TIMESTAMPTZ       NOT NULL,
  expires_at       TIMESTAMPTZ       NOT NULL,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_adv_farm_id      ON advisories(farm_id);
CREATE INDEX idx_adv_crop_cycle   ON advisories(crop_cycle_id);
CREATE INDEX idx_adv_generated_at ON advisories(generated_at DESC);
CREATE INDEX idx_adv_expires_at   ON advisories(expires_at);
CREATE INDEX idx_adv_category     ON advisories(category);

-- ── disease_diagnostics ───────────────────────────────────────────────────────

CREATE TABLE disease_diagnostics (
  id                       UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id                  UUID              NOT NULL,
  field_id                 UUID              REFERENCES fields(id) ON DELETE SET NULL,
  crop_cycle_id            UUID              REFERENCES crop_cycles(id) ON DELETE SET NULL,
  crop_name                VARCHAR(100)      NOT NULL,
  growth_stage             crop_growth_stage NOT NULL,
  image_storage_key        VARCHAR(500)      NOT NULL,
  image_hash               CHAR(64)          NOT NULL,
  status                   diagnostic_status NOT NULL DEFAULT 'PENDING',
  conditions_json          JSONB,
  top_condition_name       VARCHAR(200),
  top_condition_confidence DECIMAL(4,3),
  overall_confidence       DECIMAL(4,3),
  model_version            VARCHAR(50),
  safe_next_steps_json     JSONB,
  requires_expert_consult  BOOLEAN           NOT NULL DEFAULT FALSE,
  notes                    VARCHAR(1000),
  diagnosed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_diag_farm_id    ON disease_diagnostics(farm_id);
CREATE INDEX idx_diag_field_id   ON disease_diagnostics(field_id);
CREATE INDEX idx_diag_status     ON disease_diagnostics(status);
CREATE INDEX idx_diag_created_at ON disease_diagnostics(created_at DESC);

-- ── agricultural_data_sources ─────────────────────────────────────────────────

CREATE TABLE agricultural_data_sources (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  country       CHAR(2)       NOT NULL,
  provider_type provider_type NOT NULL,
  provider_key  VARCHAR(100)  NOT NULL,
  display_name  VARCHAR(200)  NOT NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  priority      INTEGER       NOT NULL DEFAULT 1,
  metadata      JSONB,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(country, provider_type, provider_key)
);
CREATE INDEX idx_ads_country_type ON agricultural_data_sources(country, provider_type, is_active);

-- ── model_versions ────────────────────────────────────────────────────────────

CREATE TABLE model_versions (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id           VARCHAR(100) NOT NULL,
  model_type         VARCHAR(50)  NOT NULL,
  version            VARCHAR(50)  NOT NULL,
  training_timestamp TIMESTAMPTZ,
  data_version       VARCHAR(50),
  description        TEXT,
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  deployed_at        TIMESTAMPTZ  NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(model_id, version)
);
CREATE INDEX idx_mv_type_active ON model_versions(model_type, is_active);

-- ── uploaded_images ───────────────────────────────────────────────────────────

CREATE TABLE uploaded_images (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_key   VARCHAR(500) NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    INTEGER      NOT NULL,
  width_px      INTEGER,
  height_px     INTEGER,
  file_hash     CHAR(64)     NOT NULL,
  uploaded_by   UUID         NOT NULL,
  is_used       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ  NOT NULL
);
CREATE INDEX idx_img_uploaded_by ON uploaded_images(uploaded_by);
CREATE INDEX idx_img_expires_at  ON uploaded_images(expires_at);

-- ── audit_logs ────────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   VARCHAR(36),
  ip_address    VARCHAR(45),
  user_agent    VARCHAR(500),
  metadata      JSONB,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user_id      ON audit_logs(user_id);
CREATE INDEX idx_audit_action       ON audit_logs(action);
CREATE INDEX idx_audit_resource     ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created_at   ON audit_logs(created_at DESC);
