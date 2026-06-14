-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'SUPPRESSED';

-- AlterTable
ALTER TABLE "app_config" ADD COLUMN     "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true;
