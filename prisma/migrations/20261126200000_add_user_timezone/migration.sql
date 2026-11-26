-- Zona horaria IANA del usuario (p. ej. "Europe/Madrid") para que el horario
-- y el reloj de sus frames sigan el cambio de hora de verano.
-- Solo añade columnas: no borra datos.
--   * timezone: NULL en lo antiguo; mientras sea NULL se sigue usando
--     timezone_offset tal cual (comportamiento de antes).
--   * timezone_manual: true si el usuario eligió un desfase fijo a mano en
--     Ajustes; entonces la app deja de sincronizar la zona del móvil.

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "timezone" TEXT;
ALTER TABLE "public"."users" ADD COLUMN "timezone_manual" BOOLEAN NOT NULL DEFAULT false;
