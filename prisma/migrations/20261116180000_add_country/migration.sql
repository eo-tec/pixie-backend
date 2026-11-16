-- País (ISO-2 en mayúsculas) para la pantalla Validación de /admin.
-- Solo añade columnas y cambia el índice único de ad_spend: no borra datos.
--   * ad_spend.country: '' = sin país (las filas que ya hay quedan así).
--     El único pasa de (date, ad_key) a (date, ad_key, country).
--   * prelaunch_leads.country y prelaunch_visits.country: país de la IP al
--     crearse (geoip-lite, local). La IP no se guarda. NULL en lo antiguo.

-- AlterTable
ALTER TABLE "public"."ad_spend" ADD COLUMN "country" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX "public"."ad_spend_date_ad_key_key";

-- CreateIndex
CREATE UNIQUE INDEX "ad_spend_date_ad_key_country_key" ON "public"."ad_spend"("date", "ad_key", "country");

-- AlterTable
ALTER TABLE "public"."prelaunch_leads" ADD COLUMN "country" TEXT;

-- AlterTable
ALTER TABLE "public"."prelaunch_visits" ADD COLUMN "country" TEXT;
