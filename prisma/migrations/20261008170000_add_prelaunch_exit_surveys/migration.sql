-- CreateTable
CREATE TABLE "public"."prelaunch_exit_surveys" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitor_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "text" TEXT,
    "lang" TEXT,
    "utm_source" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,

    CONSTRAINT "prelaunch_exit_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prelaunch_exit_surveys_visitor_id_key" ON "public"."prelaunch_exit_surveys"("visitor_id");

-- CreateIndex
CREATE INDEX "prelaunch_exit_surveys_created_at_idx" ON "public"."prelaunch_exit_surveys"("created_at");

