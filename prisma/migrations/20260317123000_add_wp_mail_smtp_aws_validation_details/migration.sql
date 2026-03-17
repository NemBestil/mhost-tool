ALTER TABLE "wordpress_installation_wp_mail_smtp" ADD COLUMN "amazonSesCredentialsValid" BOOLEAN;
ALTER TABLE "wordpress_installation_wp_mail_smtp" ADD COLUMN "amazonSesLastCheckedAt" DATETIME;
ALTER TABLE "wordpress_installation_wp_mail_smtp" ADD COLUMN "amazonSesErrorMessage" TEXT;
ALTER TABLE "wordpress_installation_wp_mail_smtp" ADD COLUMN "amazonSesIdentitiesJson" TEXT;
