-- AlterTable
ALTER TABLE "public"."pixie" ADD COLUMN     "current_photo_id" INTEGER,
ADD COLUMN     "current_song_id" TEXT,
ADD COLUMN     "current_song_name" TEXT;

-- AddForeignKey
ALTER TABLE "public"."pixie" ADD CONSTRAINT "pixie_current_photo_id_fkey" FOREIGN KEY ("current_photo_id") REFERENCES "public"."photos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
