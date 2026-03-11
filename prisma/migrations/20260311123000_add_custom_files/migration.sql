CREATE TABLE "custom_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "custom_file_deployments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customFileId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "deployedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployedRelativePath" TEXT NOT NULL,
    CONSTRAINT "custom_file_deployments_customFileId_fkey" FOREIGN KEY ("customFileId") REFERENCES "custom_files" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "custom_file_deployments_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "wordpress_installations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "custom_file_deployments_customFileId_installationId_key" ON "custom_file_deployments"("customFileId", "installationId");
CREATE INDEX "custom_file_deployments_installationId_idx" ON "custom_file_deployments"("installationId");
