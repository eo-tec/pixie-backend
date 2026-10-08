-- CreateTable
CREATE TABLE "public"."prelaunch_visits" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitor_id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "lang" TEXT,
    "utm_source" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,

    CONSTRAINT "prelaunch_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prelaunch_leads" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "visitor_id" TEXT,
    "lang" TEXT,
    "source" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "reserve_viewed_at" TIMESTAMPTZ(6),
    "declined_at" TIMESTAMPTZ(6),
    "reserved_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),
    "amount_cents" INTEGER,
    "currency" TEXT,
    "stripe_session_id" TEXT,
    "stripe_payment_id" TEXT,

    CONSTRAINT "prelaunch_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prelaunch_survey_responses" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lead_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "answers" JSONB NOT NULL,

    CONSTRAINT "prelaunch_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prelaunch_visits_created_at_idx" ON "public"."prelaunch_visits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "prelaunch_visits_visitor_id_page_key" ON "public"."prelaunch_visits"("visitor_id", "page");

-- CreateIndex
CREATE UNIQUE INDEX "prelaunch_leads_token_key" ON "public"."prelaunch_leads"("token");

-- CreateIndex
CREATE UNIQUE INDEX "prelaunch_leads_email_key" ON "public"."prelaunch_leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "prelaunch_leads_stripe_session_id_key" ON "public"."prelaunch_leads"("stripe_session_id");

-- CreateIndex
CREATE INDEX "prelaunch_leads_created_at_idx" ON "public"."prelaunch_leads"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "prelaunch_survey_responses_lead_id_kind_key" ON "public"."prelaunch_survey_responses"("lead_id", "kind");

-- AddForeignKey
ALTER TABLE "public"."prelaunch_survey_responses" ADD CONSTRAINT "prelaunch_survey_responses_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."prelaunch_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

