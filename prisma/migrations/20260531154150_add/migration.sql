-- CreateEnum
CREATE TYPE "AlertRuleSource" AS ENUM ('APP', 'TEST');

-- AlterTable
ALTER TABLE "AlertRule" ADD COLUMN     "source" "AlertRuleSource" NOT NULL DEFAULT 'APP';
