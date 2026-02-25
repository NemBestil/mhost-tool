-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "sshPort" INTEGER NOT NULL DEFAULT 22,
    "sshPrivateKey" TEXT NOT NULL,
    "serverType" TEXT NOT NULL,
    "cpuCores" INTEGER,
    "ram" INTEGER,
    "sshIsValid" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "wordpress_installations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "unixUsername" TEXT NOT NULL,
    "installationPath" TEXT NOT NULL,
    "siteTitle" TEXT NOT NULL,
    "siteDescription" TEXT,
    "siteUrl" TEXT NOT NULL,
    "currentCve" REAL,
    "timezone" TEXT,
    "usesServerCron" BOOLEAN NOT NULL DEFAULT false,
    "adminEmail" TEXT,
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

-- CreateTable
CREATE TABLE "wordpress_plugins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoUpdate" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "latestVersion" TEXT,
    "mainFilePath" TEXT,
    CONSTRAINT "wordpress_plugins_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "wordpress_installations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wordpress_themes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoUpdate" BOOLEAN NOT NULL DEFAULT false,
    "isActiveChild" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "latestVersion" TEXT,
    CONSTRAINT "wordpress_themes_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "wordpress_installations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "uploaded_wordpress_plugins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "archivePath" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLatest" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "uploaded_wordpress_themes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "archivePath" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLatest" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "server_disks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "mountPoint" TEXT NOT NULL,
    "capacity" BIGINT NOT NULL,
    "usedCapacity" BIGINT NOT NULL,
    CONSTRAINT "server_disks_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "options" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "monitoring_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "defaultNewSiteLevel" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "monitoring_notification_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "pushoverUserKey" TEXT,
    "minAttempts" INTEGER NOT NULL DEFAULT 1,
    "criticality" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "monitoring_notification_targets_configId_fkey" FOREIGN KEY ("configId") REFERENCES "monitoring_config" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monitoring_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,
    CONSTRAINT "monitoring_events_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "wordpress_installations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "wordpress_installations_serverId_installationPath_key" ON "wordpress_installations"("serverId", "installationPath");

-- CreateIndex
CREATE UNIQUE INDEX "wordpress_plugins_installationId_slug_key" ON "wordpress_plugins"("installationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "wordpress_themes_installationId_slug_key" ON "wordpress_themes"("installationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_wordpress_plugins_name_version_key" ON "uploaded_wordpress_plugins"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_wordpress_themes_name_version_key" ON "uploaded_wordpress_themes"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_notification_targets_type_value_key" ON "monitoring_notification_targets"("type", "value");

-- CreateIndex
CREATE INDEX "monitoring_events_installationId_occurredAt_idx" ON "monitoring_events"("installationId", "occurredAt");
