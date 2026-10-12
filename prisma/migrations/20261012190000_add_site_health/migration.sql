-- AlterTable
ALTER TABLE "wordpress_installations" ADD COLUMN "cronCheckedAt" DATETIME;
ALTER TABLE "wordpress_installations" ADD COLUMN "cronLastRunAt" DATETIME;
ALTER TABLE "wordpress_installations" ADD COLUMN "cronMonitorStartedAt" DATETIME;
ALTER TABLE "wordpress_installations" ADD COLUMN "cronScanError" TEXT;
ALTER TABLE "wordpress_installations" ADD COLUMN "worldlineCheckedAt" DATETIME;
ALTER TABLE "wordpress_installations" ADD COLUMN "worldlineScanError" TEXT;
ALTER TABLE "wordpress_installations" ADD COLUMN "worldlineStats" JSONB;
