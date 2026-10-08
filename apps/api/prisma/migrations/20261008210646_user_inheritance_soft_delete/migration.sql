/*
  Warnings:

  - You are about to drop the column `companyId` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Driver` table. All the data in the column will be lost.
  - Added the required column `fullName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Driver" DROP CONSTRAINT "Driver_companyId_fkey";

-- DropIndex
DROP INDEX "Driver_companyId_idx";

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "companyId",
DROP COLUMN "fullName",
DROP COLUMN "phone";

-- AlterTable
ALTER TABLE "Hub" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "phone" TEXT;

UPDATE "User" SET "fullName" = split_part("email", '@', 1) WHERE "fullName" IS NULL;
ALTER TABLE "User" ALTER COLUMN "fullName" SET NOT NULL;
