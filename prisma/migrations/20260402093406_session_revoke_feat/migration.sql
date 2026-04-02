-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "revokeAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetTokenExpiry" TIMESTAMP(3);
