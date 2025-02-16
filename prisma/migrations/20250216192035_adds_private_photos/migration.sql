-- CreateTable
CREATE TABLE "public"."private_photos" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_url" TEXT NOT NULL,
    "sent_by" INTEGER NOT NULL,
    "received_by" INTEGER NOT NULL,
    "title" TEXT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "private_photos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."private_photos" ADD CONSTRAINT "private_photos_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."private_photos" ADD CONSTRAINT "private_photos_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
