/*
  Warnings:

  - The values [WEBHOOK] on the enum `NotificationChannelType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationChannelType_new" AS ENUM ('DISCORD', 'TELEGRAM');
ALTER TABLE "NotificationChannel" ALTER COLUMN "type" TYPE "NotificationChannelType_new" USING ("type"::text::"NotificationChannelType_new");
ALTER TYPE "NotificationChannelType" RENAME TO "NotificationChannelType_old";
ALTER TYPE "NotificationChannelType_new" RENAME TO "NotificationChannelType";
DROP TYPE "public"."NotificationChannelType_old";
COMMIT;
