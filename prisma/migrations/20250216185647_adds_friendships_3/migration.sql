/*
  Warnings:

  - You are about to drop the column `group` on the `group_suscriber` table. All the data in the column will be lost.
  - You are about to drop the column `user` on the `group_suscriber` table. All the data in the column will be lost.
  - You are about to drop the column `group` on the `photo_groups` table. All the data in the column will be lost.
  - You are about to drop the column `user` on the `spotify_credentials` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `group_suscriber` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `spotify_credentials` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."FriendStatus" AS ENUM ('pending', 'canceled', 'accepted');

-- DropForeignKey
ALTER TABLE "public"."group_suscriber" DROP CONSTRAINT "group_suscriber_group_fkey";

-- DropForeignKey
ALTER TABLE "public"."group_suscriber" DROP CONSTRAINT "group_suscriber_user_fkey";

-- DropForeignKey
ALTER TABLE "public"."photo_groups" DROP CONSTRAINT "photo_groups_group_fkey";

-- DropForeignKey
ALTER TABLE "public"."spotify_credentials" DROP CONSTRAINT "spotify_credentials_user_fkey";

-- AlterTable
ALTER TABLE "public"."group_suscriber" DROP COLUMN "group",
DROP COLUMN "user",
ADD COLUMN     "group_id" INTEGER,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."photo_groups" DROP COLUMN "group",
ADD COLUMN     "group_id" INTEGER;

-- AlterTable
ALTER TABLE "public"."photos" ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "public"."spotify_credentials" DROP COLUMN "user",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "public"."friends" (
    "id" SERIAL NOT NULL,
    "user_id_1" INTEGER NOT NULL,
    "user_id_2" INTEGER NOT NULL,
    "status" "public"."FriendStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friends_user_id_1_user_id_2_key" ON "public"."friends"("user_id_1", "user_id_2");

-- AddForeignKey
ALTER TABLE "public"."group_suscriber" ADD CONSTRAINT "group_suscriber_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."group_suscriber" ADD CONSTRAINT "group_suscriber_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photo_groups" ADD CONSTRAINT "photo_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."spotify_credentials" ADD CONSTRAINT "spotify_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."friends" ADD CONSTRAINT "friends_user_id_1_fkey" FOREIGN KEY ("user_id_1") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friends" ADD CONSTRAINT "friends_user_id_2_fkey" FOREIGN KEY ("user_id_2") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
