const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Get all days off (with optional filtering)
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

    const daysOff = await prisma.dayOff.findMany({
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
    
    res.json(daysOff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch days off' });
  }
});

// Add new day off
router.post('/', async (req, res) => {
  try {
    const { driverId, date, reason } = req.body;
    
    // Check if day off already exists
    const existingDayOff = await prisma.dayOff.findFirst({
      where: {
        driverId: parseInt(driverId),
        date: new Date(date)
      }
    });

    if (existingDayOff) {
      return res.status(400).json({ message: 'Day off already exists for this date' });
    }

    // Check if payment exists for this date
    const existingPayment = await prisma.payment.findFirst({
      where: {
        driverId: parseInt(driverId),
        date: new Date(date)
      }
    });

    if (existingPayment) {
      return res.status(400).json({ message: 'Cannot add day off for a date with payment' });
    }

    const dayOff = await prisma.dayOff.create({
      data: {
        driverId: parseInt(driverId),
        date: new Date(date),
        reason
      }
    });
    
    res.status(201).json(dayOff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create day off' });
  }
});

// Update day off
router.put('/:id', async (req, res) => {
  try {
    const { reason } = req.body;
    const dayOff = await prisma.dayOff.update({
      where: { id: parseInt(req.params.id) },
      data: { reason }
    });
    res.json(dayOff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update day off' });
  }
});

// Delete day off
router.delete('/:id', async (req, res) => {
  try {
    await prisma.dayOff.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Day off deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete day off' });
  }
});

module.exports = router; 