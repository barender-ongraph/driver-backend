const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get all payments (with optional filtering)
router.get('/', async (req, res) => {
  try {
    const { driverId, startDate, endDate } = req.query;
    
    const where = {};
    if (driverId) where.driverId = parseInt(driverId);
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        driver: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch payments' });
  }
});

// Add new payment (will use driver's daily rate by default)
router.post('/', async (req, res) => {
  try {
    const { driverId, date, amount, notes } = req.body;
    
    // Check if payment already exists for this date
    const existingPayment = await prisma.payment.findFirst({
      where: {
        driverId: parseInt(driverId),
        date: new Date(date)
      }
    });

    if (existingPayment) {
      return res.status(400).json({ message: 'Payment already exists for this date' });
    }

    // Check if it's a day off
    const dayOff = await prisma.dayOff.findFirst({
      where: {
        driverId: parseInt(driverId),
        date: new Date(date)
      }
    });

    if (dayOff) {
      return res.status(400).json({ message: 'Cannot add payment for a day off' });
    }

    // Get driver's daily rate if amount not specified
    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(driverId) }
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    const paymentAmount = amount || driver.dailyRate;

    const payment = await prisma.payment.create({
      data: {
        driverId: parseInt(driverId),
        date: new Date(date),
        amount: parseFloat(paymentAmount),
        notes: notes || `Regular daily payment of ${paymentAmount}`
      }
    });
    
    res.status(201).json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create payment' });
  }
});

// Bulk create payments for a date range
router.post('/bulk', async (req, res) => {
  try {
    const { driverId, startDate, endDate } = req.body;

    const driver = await prisma.driver.findUnique({
      where: { id: parseInt(driverId) },
      include: {
        daysOff: {
          where: {
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Generate dates between start and end date
    const dates = [];
    let currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    while (currentDate <= lastDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Filter out days off
    const daysOffDates = driver.daysOff.map(d => d.date.toISOString().split('T')[0]);
    const workingDates = dates.filter(date => 
      !daysOffDates.includes(date.toISOString().split('T')[0])
    );

    // Create payments for working dates
    const payments = await prisma.$transaction(
      workingDates.map(date => 
        prisma.payment.create({
          data: {
            driverId: parseInt(driverId),
            date,
            amount: driver.dailyRate,
            notes: 'Bulk payment creation'
          }
        })
      )
    );

    res.status(201).json({
      message: 'Bulk payments created successfully',
      count: payments.length,
      payments
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create bulk payments' });
  }
});

// Update payment
router.put('/:id', async (req, res) => {
  try {
    const { amount, notes } = req.body;
    const payment = await prisma.payment.update({
      where: { id: parseInt(req.params.id) },
      data: {
        amount: parseFloat(amount),
        notes
      }
    });
    res.json(payment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update payment' });
  }
});

// Delete payment
router.delete('/:id', async (req, res) => {
  try {
    await prisma.payment.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete payment' });
  }
});

// Get monthly summary for a driver
router.get('/monthly/:driverId', async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const payments = await prisma.payment.findMany({
      where: {
        driverId: parseInt(req.params.driverId),
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const daysWorked = payments.length;

    res.json({
      totalAmount,
      daysWorked,
      payments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch monthly summary' });
  }
});

module.exports = router; 