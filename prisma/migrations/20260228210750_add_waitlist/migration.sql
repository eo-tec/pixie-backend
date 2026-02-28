-- CreateTable
CREATE TABLE "public"."waitlist" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_email_key" ON "public"."waitlist"("email");
