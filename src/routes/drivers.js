const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: {
        isActive: true
      },
      include: {
        _count: {
          select: {
            payments: true,
            daysOff: true
          }
        }
      }
    });
    res.json(drivers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch drivers' });
  }
});

// // Get single driver with details
// router.get('/:id', async (req, res) => {
//   try {
//     const driver = await prisma.driver.findUnique({
//       where: { id: parseInt(req.params.id) },
//       include: {
//         payments: true,
//         daysOff: true
//       }
//     });
//     if (!driver) {
//       return res.status(404).json({ message: 'Driver not found' });
//     }
//     res.json(driver);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Failed to fetch driver' });
//   }
// });

// Create new driver with daily rate
router.post('/', async (req, res) => {
  try {
    const { name, phoneNumber, dailyRate } = req.body;
    
    const driver = await prisma.driver.create({
      data: {
        name,
        phoneNumber,
        dailyRate: parseFloat(dailyRate)
      }
    });

    res.status(201).json(driver);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create driver' });
  }
});

// Update driver
router.put('/:id', async (req, res) => {
  try {
    const { name, phoneNumber, dailyRate } = req.body;
    const driver = await prisma.driver.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        phoneNumber,
        dailyRate: parseFloat(dailyRate)
      }
    });
    res.json(driver);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update driver' });
  }
});

// Delete driver (soft delete by setting isActive to false)
router.delete('/:id', async (req, res) => {
  try {
    const driver = await prisma.driver.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    res.json({ message: 'Driver deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to deactivate driver' });
  }
});

// Get driver's payment summary
router.get('/:id/payment-summary', async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get driver details
    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(id) },
      include: {
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

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Calculate working days in the month
    const totalDaysInMonth = endDate.getDate();
    const daysOff = driver.daysOff.length;
    const workingDays = totalDaysInMonth - daysOff;

    // Calculate expected and actual payments
    const expectedAmount = workingDays * Number(driver.dailyRate);
    const actualAmount = driver.payments.reduce((sum, payment) => 
      sum + Number(payment.amount), 0);

    res.json({
      driverId: driver.id,
      driverName: driver.name,
      month,
      year,
      dailyRate: driver.dailyRate,
      totalDaysInMonth,
      daysOff,
      workingDays,
      expectedAmount,
      actualAmount,
      difference: actualAmount - expectedAmount,
      payments: driver.payments,
      daysOffDetails: driver.daysOff
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch payment summary' });
  }
});

// Add this new route to get stats for all drivers
router.get('/stats', async (req, res) => {
  try {
    // Get current month and year if not provided
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
    const targetYear = parseInt(year) || currentDate.getFullYear();

    // Calculate start and end dates for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    // Get all active drivers with their payments and days off
    const drivers = await prisma.driver.findMany({
      where: {
        isActive: true
      },
      include: {
        payments: {
          where: {
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          select: {
            amount: true
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

    // Transform the data into the required format
    const stats = drivers.reduce((acc, driver) => {
      const totalPayment = driver.payments.reduce((sum, payment) => 
        sum + Number(payment.amount), 0);

      acc[driver.id] = {
        daysOff: driver.daysOff.length,
        totalPayment: totalPayment
      };

      return acc;
    }, {});

    res.json(stats);

  } catch (error) {
    console.error('Error fetching driver stats:', error);
    res.status(500).json({ message: 'Failed to fetch driver statistics' });
  }
});

// Optional: Enhanced version with more details
router.get('/stats/detailed', async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
    const targetYear = parseInt(year) || currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const drivers = await prisma.driver.findMany({
      where: {
        isActive: true
      },
      include: {
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

    const stats = drivers.reduce((acc, driver) => {
      const totalPayment = driver.payments.reduce((sum, payment) => 
        sum + Number(payment.amount), 0);
      
      const daysInMonth = endDate.getDate();
      const daysOff = driver.daysOff.length;
      const workingDays = driver.payments.length;
      const expectedWorkingDays = daysInMonth - daysOff;
      const expectedAmount = expectedWorkingDays * Number(driver.dailyRate);

      acc[driver.id] = {
        daysOff,
        totalPayment,
        driverName: driver.name,
        dailyRate: Number(driver.dailyRate),
        workingDays,
        expectedWorkingDays,
        expectedAmount,
        difference: totalPayment - expectedAmount,
        lastPaymentDate: driver.payments.length > 0 
          ? new Date(Math.max(...driver.payments.map(p => new Date(p.date)))).toISOString().split('T')[0]
          : null
      };

      return acc;
    }, {});

    res.json(stats);

  } catch (error) {
    console.error('Error fetching detailed driver stats:', error);
    res.status(500).json({ message: 'Failed to fetch detailed driver statistics' });
  }
});

router.get('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate driver ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid driver ID' });
    }

    // Get driver with all payments and days off
    const driver = await prisma.driver.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        payments: {
          orderBy: {
            date: 'desc'
          }
        },
        daysOff: {
          orderBy: {
            date: 'desc'
          }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Helper function to check if date is weekend
    const isWeekend = (date) => {
      const day = date.getDay();
      return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
    };

    // Get current month's first day and last day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    currentMonthStart.setHours(0, 0, 0, 0);
    
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    currentMonthEnd.setHours(0, 0, 0, 0);
    
    const joinDate = new Date(driver.joinDate);
    joinDate.setHours(0, 0, 0, 0);

    // Determine start date - use join date if it's after current month start
    const startDate = joinDate > currentMonthStart ? joinDate : currentMonthStart;

    // Get all dates for actual payments (up to today)
    const actualDates = [];
    let currentDate = new Date(today);
    while (currentDate >= startDate) {
      if (!isWeekend(currentDate)) {
        actualDates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Get all dates for expected payments (including future dates)
    const expectedDates = [];
    currentDate = new Date(startDate);
    while (currentDate <= currentMonthEnd) {
      if (!isWeekend(currentDate)) {
        expectedDates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create maps for existing payments and days off
    const existingPayments = new Map(
      driver.payments.map(payment => [
        payment.date.toISOString().split('T')[0],
        payment
      ])
    );

    const daysOffSet = new Set(
      driver.daysOff.map(dayOff => 
        dayOff.date.toISOString().split('T')[0]
      )
    );

    // Generate actual payments (up to today)
    const actualPayments = actualDates
      .filter(date => !daysOffSet.has(date.toISOString().split('T')[0]))
      .map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const existingPayment = existingPayments.get(dateStr);

        if (existingPayment) {
          return {
            id: existingPayment.id,
            date: dateStr,
            amount: Number(existingPayment.amount),
            notes: existingPayment.notes || 'Regular payment',
            isAutoGenerated: false
          };
        } else {
          return {
            id: null,
            date: dateStr,
            amount: Number(driver.dailyRate),
            notes: 'Auto-generated based on daily rate',
            isAutoGenerated: true
          };
        }
      });

    // Calculate expected working days for the entire month
    const expectedWorkingDays = expectedDates
      .filter(date => !daysOffSet.has(date.toISOString().split('T')[0]))
      .length;

    // Calculate expected payment for the entire month
    const monthlyExpectedPayment = expectedWorkingDays * Number(driver.dailyRate);

    // Calculate actual payment up to today (including both DB and default payments)
    const monthlyActualPayment = actualPayments.reduce((sum, payment) => {
      return sum + payment.amount;
    }, 0);

    // Calculate remaining days (future working days)
    const remainingDays = expectedDates
      .filter(date => {
        const dateObj = new Date(date);
        return dateObj > today && !daysOffSet.has(date.toISOString().split('T')[0]);
      })
      .length;

    // Calculate remaining amount for future days
    const remaining = remainingDays * Number(driver.dailyRate);

    const response = {
      driverId: driver.id,
      driverName: driver.name,
      dailyRate: Number(driver.dailyRate),
      joinDate: driver.joinDate,
      currentDate: today.toISOString().split('T')[0],
      currentMonth: {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        workingDays: expectedWorkingDays,
        actualPayments: actualPayments.length,
        expectedPayment: monthlyExpectedPayment,
        actualPayment: monthlyActualPayment,
        remainingBalance: monthlyExpectedPayment - monthlyActualPayment,
        remaining: remaining,
        remainingDays: remainingDays,
        daysOff: driver.daysOff.filter(day => {
          const date = new Date(day.date);
          return date >= startDate && date <= currentMonthEnd;
        }).length
      },
      summary: {
        totalDays: actualPayments.length,
        totalActualPayments: monthlyActualPayment,
        totalExpectedPayments: monthlyExpectedPayment,
        daysMissingPayment: actualPayments.filter(p => p.isAutoGenerated).length,
        daysOff: driver.daysOff.length
      },
      payments: actualPayments,
      daysOff: driver.daysOff.map(day => ({
        date: day.date.toISOString().split('T')[0],
        reason: day.reason
      }))
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching driver payments:', error);
    res.status(500).json({ 
      message: 'Failed to fetch driver payments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// New endpoint for total payment history
router.get('/:id/payment-history', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate driver ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'Invalid driver ID' });
    }

    // Get driver with all payments and days off
    const driver = await prisma.driver.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        payments: {
          orderBy: {
            date: 'desc'
          }
        },
        daysOff: {
          orderBy: {
            date: 'desc'
          }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Helper function to check if date is weekend
    const isWeekend = (date) => {
      const day = date.getDay();
      return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
    };

    // Set up dates
    const joinDate = new Date(driver.joinDate);
    joinDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create map of existing payments
    const existingPayments = new Map(
      driver.payments.map(payment => [
        payment.date.toISOString().split('T')[0],
        payment
      ])
    );

    // Create set of days off
    const daysOffSet = new Set(
      driver.daysOff.map(dayOff => 
        dayOff.date.toISOString().split('T')[0]
      )
    );

    // Generate all payments
    const allPayments = [];
    let currentDate = new Date(today);
    let totalActualAmount = 0;
    let totalExpectedAmount = 0;
    let actualPaymentDays = 0;
    let defaultRateDays = 0;

    while (currentDate >= joinDate) {
      if (!isWeekend(currentDate)) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        if (!daysOffSet.has(dateStr)) {
          const existingPayment = existingPayments.get(dateStr);
          
          if (existingPayment) {
            totalActualAmount += Number(existingPayment.amount);
            totalExpectedAmount += Number(existingPayment.amount);
            actualPaymentDays++;
            
            allPayments.push({
              id: existingPayment.id,
              date: dateStr,
              amount: Number(existingPayment.amount),
              notes: existingPayment.notes || 'Regular payment',
              isActual: true
            });
          } else {
            totalExpectedAmount += Number(driver.dailyRate);
            defaultRateDays++;
            
            allPayments.push({
              date: dateStr,
              amount: Number(driver.dailyRate),
              notes: 'Auto-generated based on daily rate',
              isActual: false
            });
          }
        }
      }
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Group payments by month
    const monthlyBreakdown = allPayments.reduce((acc, payment) => {
      const [year, month] = payment.date.split('-');
      const key = `${year}-${month}`;
      
      if (!acc[key]) {
        acc[key] = {
          month: parseInt(month),
          year: parseInt(year),
          actualAmount: 0,
          expectedAmount: 0,
          workingDays: 0,
          actualPaymentDays: 0,
          defaultRateDays: 0,
          payments: []
        };
      }
      
      acc[key].workingDays++;
      acc[key].expectedAmount += payment.amount;
      acc[key].payments.push(payment);
      
      if (payment.isActual) {
        acc[key].actualAmount += payment.amount;
        acc[key].actualPaymentDays++;
      } else {
        acc[key].defaultRateDays++;
      }
      
      return acc;
    }, {});

    const response = {
      driverInfo: {
        id: driver.id,
        name: driver.name,
        dailyRate: Number(driver.dailyRate),
        joinDate: joinDate.toISOString().split('T')[0],
        totalDays: allPayments.length
      },
      summary: {
        totalWorkingDays: allPayments.length,
        actualPaymentDays,
        defaultRateDays,
        daysOff: driver.daysOff.length,
        totalActualAmount,
        totalExpectedAmount,
        remainingBalance: totalExpectedAmount - totalActualAmount,
        completionPercentage: ((totalActualAmount / totalExpectedAmount) * 100).toFixed(2)
      },
      monthlyBreakdown: Object.values(monthlyBreakdown)
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        }),
      payments: allPayments,
      daysOff: driver.daysOff.map(day => ({
        date: day.date.toISOString().split('T')[0],
        reason: day.reason
      }))
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ 
      message: 'Failed to fetch payment history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 