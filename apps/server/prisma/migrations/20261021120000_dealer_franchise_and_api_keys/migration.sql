-- AlterTable AdminUser: add DEALER and FRANCHISE roles and dealer contact fields
ALTER TABLE `AdminUser`
  MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MONITORING', 'VENDOR', 'AUDITOR', 'DEALER', 'FRANCHISE') NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN `dealerName` VARCHAR(191) NULL,
  ADD COLUMN `dealerPhone` VARCHAR(191) NULL,
  ADD COLUMN `dealerEmail` VARCHAR(191) NULL,
  ADD COLUMN `notes` TEXT NULL;

-- AlterTable License: add customerTenant and dealerId
ALTER TABLE `License`
  ADD COLUMN `customerTenant` VARCHAR(120) NULL,
  ADD COLUMN `dealerId` VARCHAR(64) NULL;

CREATE INDEX `License_dealerId_idx` ON `License`(`dealerId`);

ALTER TABLE `License`
  ADD CONSTRAINT `License_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable DealerProduct
CREATE TABLE `DealerProduct` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `productId` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DealerProduct_userId_idx`(`userId`),
    INDEX `DealerProduct_productId_idx`(`productId`),
    UNIQUE INDEX `DealerProduct_userId_productId_key`(`userId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DealerProduct`
  ADD CONSTRAINT `DealerProduct_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DealerProduct`
  ADD CONSTRAINT `DealerProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ApiKey
CREATE TABLE `ApiKey` (
    `id` VARCHAR(36) NOT NULL,
    `key` VARCHAR(128) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `allowedDomains` VARCHAR(500) NOT NULL DEFAULT '*',
    `role` VARCHAR(64) NOT NULL DEFAULT 'READ_EXTEND',
    `dealerId` VARCHAR(64) NULL,
    `createdById` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ApiKey_key_key`(`key`),
    INDEX `ApiKey_key_idx`(`key`),
    INDEX `ApiKey_isActive_expiresAt_idx`(`isActive`, `expiresAt`),
    INDEX `ApiKey_dealerId_idx`(`dealerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ApiKey`
  ADD CONSTRAINT `ApiKey_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ApiKey`
  ADD CONSTRAINT `ApiKey_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
