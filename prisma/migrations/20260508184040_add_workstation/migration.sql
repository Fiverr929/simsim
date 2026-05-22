-- CreateTable
CREATE TABLE "Workstation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL DEFAULT 'My Workstation'
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workstationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'empty',
    "etsyListingId" INTEGER,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "price" REAL,
    "sku" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "videoPath" TEXT,
    "digitalFiles" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "taxonomyId" INTEGER,
    "whenMade" TEXT NOT NULL DEFAULT 'made_to_order',
    "whoMade" TEXT NOT NULL DEFAULT 'i_did',
    "isSupply" BOOLEAN NOT NULL DEFAULT false,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 999,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "isPersonalizable" BOOLEAN NOT NULL DEFAULT false,
    "personalizationInstructions" TEXT,
    "shopSectionId" INTEGER,
    "featuredListing" BOOLEAN NOT NULL DEFAULT false,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Listing_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "Workstation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Listing" ("aiGenerated", "autoRenew", "createdAt", "description", "digitalFiles", "etsyListingId", "featuredListing", "id", "images", "isPersonalizable", "isSupply", "isTaxable", "personalizationInstructions", "price", "quantity", "shopSectionId", "sku", "status", "tags", "taxonomyId", "title", "updatedAt", "videoPath", "whenMade", "whoMade") SELECT "aiGenerated", "autoRenew", "createdAt", "description", "digitalFiles", "etsyListingId", "featuredListing", "id", "images", "isPersonalizable", "isSupply", "isTaxable", "personalizationInstructions", "price", "quantity", "shopSectionId", "sku", "status", "tags", "taxonomyId", "title", "updatedAt", "videoPath", "whenMade", "whoMade" FROM "Listing";
DROP TABLE "Listing";
ALTER TABLE "new_Listing" RENAME TO "Listing";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
