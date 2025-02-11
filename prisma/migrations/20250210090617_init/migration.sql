/*
  Warnings:

  - Added the required column `dailyRate` to the `Driver` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `driver` ADD COLUMN `dailyRate` DECIMAL(10, 2) NOT NULL;
