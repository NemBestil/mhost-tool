ALTER TABLE "monitoring_notification_targets"
ADD COLUMN "emailNotifyOnUp" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "monitoring_notification_targets"
ADD COLUMN "emailNotifyHigh" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "monitoring_notification_targets"
ADD COLUMN "emailNotifyNormal" BOOLEAN NOT NULL DEFAULT true;
