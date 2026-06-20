-- CreateTable
CREATE TABLE "public"."app_config" (
    "id" SERIAL NOT NULL,
    "ios_min_version" TEXT NOT NULL DEFAULT '1.0.0',
    "ios_latest_version" TEXT NOT NULL DEFAULT '1.0.0',
    "ios_store_url" TEXT NOT NULL DEFAULT 'https://apps.apple.com/app/id6759828278',
    "android_min_version" TEXT NOT NULL DEFAULT '1.0.0',
    "android_latest_version" TEXT NOT NULL DEFAULT '1.0.0',
    "android_store_url" TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.eotec.frame',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- Seed the single config row
INSERT INTO "public"."app_config" ("ios_min_version", "ios_latest_version", "android_min_version", "android_latest_version")
VALUES ('1.0.0', '1.0.0', '1.0.0', '1.0.0');
