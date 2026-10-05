ALTER TABLE `AdminUser`
  MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MONITORING', 'VENDOR', 'AUDITOR') NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN `tenantId` VARCHAR(191) NULL,
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `AuditLog`
  ADD COLUMN `tenantId` VARCHAR(191) NULL;

CREATE INDEX `AdminUser_tenantId_idx` ON `AdminUser`(`tenantId`);
CREATE INDEX `AdminUser_role_isActive_idx` ON `AdminUser`(`role`, `isActive`);
CREATE INDEX `AuditLog_tenantId_createdAt_idx` ON `AuditLog`(`tenantId`, `createdAt`);

ALTER TABLE `AdminUser`
  ADD CONSTRAINT `AdminUser_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AuditLog`
  ADD CONSTRAINT `AuditLog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
