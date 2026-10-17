-- AlterTable
ALTER TABLE "wordpress_installations" ADD COLUMN "turnstileCheckedAt" DATETIME;
ALTER TABLE "wordpress_installations" ADD COLUMN "turnstileScanError" TEXT;
ALTER TABLE "wordpress_installations" ADD COLUMN "turnstileStats" JSONB;
