/*
  Warnings:

  - You are about to drop the `PhotosVisibleByUsers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PhotosVisibleByUsers" DROP CONSTRAINT "PhotosVisibleByUsers_photo_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PhotosVisibleByUsers" DROP CONSTRAINT "PhotosVisibleByUsers_user_id_fkey";

-- DropTable
DROP TABLE "public"."PhotosVisibleByUsers";

-- CreateTable
CREATE TABLE "public"."photo_visible_by_users" (
    "id" SERIAL NOT NULL,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_visible_by_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "photo_visible_by_users_photo_id_user_id_key" ON "public"."photo_visible_by_users"("photo_id", "user_id");

-- AddForeignKey
ALTER TABLE "public"."photo_visible_by_users" ADD CONSTRAINT "photo_visible_by_users_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_visible_by_users" ADD CONSTRAINT "photo_visible_by_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
