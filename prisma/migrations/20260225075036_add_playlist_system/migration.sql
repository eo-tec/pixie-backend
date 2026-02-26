-- AlterTable
ALTER TABLE "public"."pixie" ADD COLUMN     "photo_cursor" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."playlist_items" (
    "id" SERIAL NOT NULL,
    "pixie_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "face_type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_pixie_id_position_key" ON "public"."playlist_items"("pixie_id", "position");

-- AddForeignKey
ALTER TABLE "public"."playlist_items" ADD CONSTRAINT "playlist_items_pixie_id_fkey" FOREIGN KEY ("pixie_id") REFERENCES "public"."pixie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
