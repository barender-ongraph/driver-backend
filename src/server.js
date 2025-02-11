require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const morgan = require('morgan'); // for logging

// Import routes
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const paymentRoutes = require('./routes/payments');
const dayOffRoutes = require('./routes/dayoffs');
const reportsRoutes = require('./routes/reports');

// Import middleware
const authenticateToken = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Initialize
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev')); // Log requests

// API Routes with base path
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);  // This route contains both /:id/payments and /:id/payment-history
app.use('/api/payments', paymentRoutes);
app.use('/api/dayoff', dayOffRoutes);
app.use('/api/reports', reportsRoutes);

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Log available routes
console.log('Available routes:');
console.log('- GET /api/drivers/:id/payments');
console.log('- GET /api/drivers/:id/payment-history'); // Added new endpoint to logging
console.log('- GET /api/drivers/:id/stats');

// Global error handling
app.use(errorHandler);

// 404 handler - Keep this after all valid routes
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    message: 'Route not found',
    path: req.url,
    method: req.method
  });
});

// Database connection and server startup
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connection established');

    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Available routes:`);
      console.log(`- GET /api/drivers/:id/payments`);
      console.log(`- GET /api/drivers/:id/payment-history`);
      console.log(`- GET /api/drivers/:id/stats`);
      // Add other routes for reference
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app; // For testing purposes 