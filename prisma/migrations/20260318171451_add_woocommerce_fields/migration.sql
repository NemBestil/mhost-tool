-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_wordpress_installations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "unixUsername" TEXT NOT NULL,
    "autoLoginUser" TEXT,
    "installationPath" TEXT NOT NULL,
    "siteTitle" TEXT NOT NULL,
    "siteDescription" TEXT,
    "siteUrl" TEXT NOT NULL,
    "currentCve" REAL,
    "timezone" TEXT,
    "usesServerCron" BOOLEAN NOT NULL DEFAULT false,
    "adminEmail" TEXT,
    "hasWooCommerce" BOOLEAN NOT NULL DEFAULT false,
    "wooCommerceEmail" TEXT,
    "phpVersion" TEXT,
    "phpMemoryLimit" TEXT,
    "lastScanAt" DATETIME,
    "monitoringLevel" TEXT NOT NULL DEFAULT 'NONE',
    "monitoringStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "monitoringCurrentStatusSince" DATETIME,
    "monitoringLastCheckedAt" DATETIME,
    "monitoringTestWpLogin" BOOLEAN NOT NULL DEFAULT false,
    "monitoringFrontpageStatusMin" INTEGER NOT NULL DEFAULT 200,
    "monitoringFrontpageStatusMax" INTEGER NOT NULL DEFAULT 299,
    "monitoringFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "wordpress_installations_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_wordpress_installations" ("adminEmail", "autoLoginUser", "currentCve", "id", "installationPath", "lastScanAt", "monitoringCurrentStatusSince", "monitoringFailedAttempts", "monitoringFrontpageStatusMax", "monitoringFrontpageStatusMin", "monitoringLastCheckedAt", "monitoringLevel", "monitoringStatus", "monitoringTestWpLogin", "phpMemoryLimit", "phpVersion", "serverId", "siteDescription", "siteTitle", "siteUrl", "timezone", "unixUsername", "usesServerCron") SELECT "adminEmail", "autoLoginUser", "currentCve", "id", "installationPath", "lastScanAt", "monitoringCurrentStatusSince", "monitoringFailedAttempts", "monitoringFrontpageStatusMax", "monitoringFrontpageStatusMin", "monitoringLastCheckedAt", "monitoringLevel", "monitoringStatus", "monitoringTestWpLogin", "phpMemoryLimit", "phpVersion", "serverId", "siteDescription", "siteTitle", "siteUrl", "timezone", "unixUsername", "usesServerCron" FROM "wordpress_installations";
DROP TABLE "wordpress_installations";
ALTER TABLE "new_wordpress_installations" RENAME TO "wordpress_installations";
CREATE UNIQUE INDEX "wordpress_installations_serverId_installationPath_key" ON "wordpress_installations"("serverId", "installationPath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
