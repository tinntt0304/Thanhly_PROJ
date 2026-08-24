-- CreateTable
CREATE TABLE "FacebookGroup" (
    "id" TEXT NOT NULL,
    "fbId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visibility" TEXT,
    "memberCount" INTEGER,
    "postsPerDay" DOUBLE PRECISION,
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstFoundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacebookGroup_fbId_key" ON "FacebookGroup"("fbId");

-- CreateIndex
CREATE INDEX "FacebookGroup_lastSeenAt_idx" ON "FacebookGroup"("lastSeenAt");

-- CreateTable
CREATE TABLE "FacebookKeywordSearch" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "maxItems" INTEGER NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacebookKeywordSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacebookKeywordSearch_keyword_searchedAt_idx" ON "FacebookKeywordSearch"("keyword", "searchedAt");
