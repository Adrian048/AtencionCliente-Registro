-- Support tickets classified by the n8n workflow and managed from the panel.
--
-- Personal data is stored ENCRYPTED (AES-256-GCM, done by the API): the *_enc
-- columns only contain ciphertext and the database never sees the key. Someone
-- with a dump of this table, a backup or direct SQL access sees random bytes.
-- Only classification fields stay in clear, because the panel filters by them
-- and they are not personal data.

CREATE TABLE tickets (
    id            BIGSERIAL PRIMARY KEY,

    nombre_enc    BYTEA       NOT NULL,
    apellidos_enc BYTEA       NOT NULL,
    email_enc     BYTEA       NOT NULL,
    -- HMAC-SHA256 of the normalised email: exact-match lookups without the email
    email_bidx    BYTEA       NOT NULL CHECK (octet_length(email_bidx) = 32),
    consulta_enc  BYTEA       NOT NULL,
    resumen_enc   BYTEA,

    -- Classification from the AI. The CHECK constraints are a last line of
    -- defence: whatever the model returns, only known values reach the table.
    categoria   TEXT        NOT NULL CHECK (categoria IN (
                    'presupuesto', 'ciberseguridad', 'desarrollo_a_medida',
                    'inteligencia_artificial', 'mantenimiento', 'incidencia',
                    'consulta_general', 'spam')),
    prioridad   TEXT        NOT NULL CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
    sentimiento TEXT        CHECK (sentimiento IN ('positivo', 'neutro', 'negativo')),
    confianza   NUMERIC(3,2) CHECK (confianza BETWEEN 0 AND 1),

    estado      TEXT        NOT NULL DEFAULT 'nuevo' CHECK (estado IN (
                    'nuevo', 'revision_manual', 'en_curso', 'resuelto', 'descartado')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tickets_created_at_idx ON tickets (created_at DESC);
CREATE INDEX tickets_filters_idx    ON tickets (estado, categoria, prioridad);
CREATE INDEX tickets_email_bidx_idx ON tickets (email_bidx);

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_set_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
