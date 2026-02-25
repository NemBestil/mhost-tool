-- CreateTable
CREATE TABLE "user_sessions" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");
