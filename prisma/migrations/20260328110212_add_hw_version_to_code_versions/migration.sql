-- AlterTable
ALTER TABLE "public"."code_versions" ADD COLUMN     "hw_version" TEXT NOT NULL DEFAULT 'v1';

-- CreateIndex
CREATE INDEX "code_versions_hw_version_version_idx" ON "public"."code_versions"("hw_version", "version");
