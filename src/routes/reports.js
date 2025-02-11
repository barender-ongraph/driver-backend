const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get monthly report for all drivers
router.get('/monthly', async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get all active drivers
    const drivers = await prisma.driver.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        payments: {
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        daysOff: {
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });

    // Calculate summary for each driver
    const report = drivers.map(driver => {
      const totalAmount = driver.payments.reduce((sum, payment) => 
        sum + Number(payment.amount), 0);
      
      return {
        driverId: driver.id,
        driverName: driver.name,
        totalAmount,
        daysWorked: driver.payments.length,
        daysOff: driver.daysOff.length,
        totalDays: driver.payments.length + driver.daysOff.length
      };
    });

    // Calculate totals
    const summary = {
      totalPayout: report.reduce((sum, driver) => sum + driver.totalAmount, 0),
      totalDaysWorked: report.reduce((sum, driver) => sum + driver.daysWorked, 0),
      totalDaysOff: report.reduce((sum, driver) => sum + driver.daysOff, 0),
      averagePayPerDay: report.reduce((sum, driver) => 
        sum + (driver.totalAmount / (driver.daysWorked || 1)), 0) / report.length
    };

    res.json({
      month,
      year,
      driverReports: report,
      summary
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate monthly report' });
  }
});

// Get yearly summary
router.get('/yearly', async (req, res) => {
  try {
    const { year } = req.query;
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const payments = await prisma.payment.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        driver: {
          select: {
            name: true
          }
        }
      }
    });

    // Group by month
    const monthlyData = Array(12).fill(0).map((_, index) => {
      const monthPayments = payments.filter(payment => 
        payment.date.getMonth() === index
      );

      return {
        month: index + 1,
        totalAmount: monthPayments.reduce((sum, payment) => 
          sum + Number(payment.amount), 0),
        paymentsCount: monthPayments.length
      };
    });

    const yearlyTotal = monthlyData.reduce((sum, month) => 
      sum + month.totalAmount, 0);

    res.json({
      year,
      monthlyData,
      yearlyTotal,
      averageMonthly: yearlyTotal / 12
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate yearly report' });
  }
});

module.exports = router; 