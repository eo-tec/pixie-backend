/*
  Warnings:

  - You are about to drop the column `spotify_token` on the `spotify_credentials` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."photos" ADD COLUMN     "photo_pixels" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."pixie" ADD COLUMN     "secs_between_photos" INTEGER DEFAULT 60;

-- AlterTable
ALTER TABLE "public"."spotify_credentials" DROP COLUMN "spotify_token",
ADD COLUMN     "expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "spotify_refresh_token" TEXT;

-- CreateTable
CREATE TABLE "public"."PhotosVisibleByUsers" (
    "id" SERIAL NOT NULL,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotosVisibleByUsers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotosVisibleByUsers_photo_id_user_id_key" ON "public"."PhotosVisibleByUsers"("photo_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_key" ON "public"."users"("user_id");

-- AddForeignKey
ALTER TABLE "public"."PhotosVisibleByUsers" ADD CONSTRAINT "PhotosVisibleByUsers_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhotosVisibleByUsers" ADD CONSTRAINT "PhotosVisibleByUsers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
