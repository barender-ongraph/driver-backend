require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const paymentRoutes = require('./routes/payments');
const dayOffRoutes = require('./routes/dayoffs');
const reportsRoutes = require('./routes/reports');

const authenticateToken = require('./middleware/auth');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', authenticateToken, driverRoutes);
app.use('/api/payments', authenticateToken, paymentRoutes);
app.use('/api/dayoff', authenticateToken, dayOffRoutes);
app.use('/api/reports', authenticateToken, reportsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
}); 