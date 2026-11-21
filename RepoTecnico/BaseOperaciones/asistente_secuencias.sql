-- Asistente GGTO — reparación de secuencias (idempotente)
-- Ejecutado en producción 2026-11-21 sobre ggtov2 (vm-databases, usuario txbarlovento).
-- Motivo: las migraciones C4/C5 crearon asistente_sesion / asistente_remitente sin
-- DEFAULT en sus claves primarias, así que POST /api/v1/asistente/sesiones daba 500
-- ("null value in column id_turno") y el alta de remitentes también fallaba.
--
-- Aplicar: sudo docker exec -i postgres psql -U txbarlovento -d ggtov2 < este_archivo.sql

CREATE SEQUENCE IF NOT EXISTS asistente_sesion_id_turno_seq AS bigint;
SELECT setval('asistente_sesion_id_turno_seq',
              coalesce((SELECT max(id_turno) FROM asistente_sesion), 0) + 1, false);
ALTER TABLE asistente_sesion ALTER COLUMN id_turno
  SET DEFAULT nextval('asistente_sesion_id_turno_seq');

CREATE SEQUENCE IF NOT EXISTS asistente_remitente_id_remitente_seq AS bigint;
SELECT setval('asistente_remitente_id_remitente_seq',
              coalesce((SELECT max(id_remitente) FROM asistente_remitente), 0) + 1, false);
ALTER TABLE asistente_remitente ALTER COLUMN id_remitente
  SET DEFAULT nextval('asistente_remitente_id_remitente_seq');

-- El usuario de la API es ggtov2_app: sin USAGE en la secuencia el INSERT daba
-- "permission denied for sequence ..." (500 en Cloud Run).
GRANT USAGE, SELECT ON SEQUENCE asistente_sesion_id_turno_seq,
  asistente_remitente_id_remitente_seq TO ggtov2_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON asistente_sesion, asistente_remitente TO ggtov2_app;

-- Verificación: ambas columnas deben mostrar nextval(...)
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_name IN ('asistente_sesion', 'asistente_remitente')
  AND column_name IN ('id_turno', 'id_remitente');
