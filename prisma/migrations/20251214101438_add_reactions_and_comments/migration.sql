-- CreateEnum
CREATE TYPE "public"."ReactionType" AS ENUM ('like', 'laugh', 'wow', 'sad');

-- CreateTable
CREATE TABLE "public"."photo_reactions" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "public"."ReactionType" NOT NULL,

    CONSTRAINT "photo_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."photo_comments" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "photo_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "photo_reactions_photo_id_user_id_key" ON "public"."photo_reactions"("photo_id", "user_id");

-- AddForeignKey
ALTER TABLE "public"."photo_reactions" ADD CONSTRAINT "photo_reactions_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_reactions" ADD CONSTRAINT "photo_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_comments" ADD CONSTRAINT "photo_comments_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."photo_comments" ADD CONSTRAINT "photo_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
