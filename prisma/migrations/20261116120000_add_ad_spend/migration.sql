-- Gasto en anuncios por día (hora de Madrid) y anuncio, para la pantalla
-- Validación de /admin. Solo crea la tabla nueva: no toca nada existente.

-- CreateTable
CREATE TABLE "public"."ad_spend" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATE NOT NULL,
    "ad_key" TEXT NOT NULL,
    "ad_name" TEXT,
    "campaign" TEXT,
    "spend_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "impressions" INTEGER,
    "clicks" INTEGER,
    "meta_leads" INTEGER,

    CONSTRAINT "ad_spend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_spend_date_idx" ON "public"."ad_spend"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_spend_date_ad_key_key" ON "public"."ad_spend"("date", "ad_key");
