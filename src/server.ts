import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { runMigrations } from './utils/migrations';
import { getDatabase } from './utils/database';
import projectRoutes from './routes/projectRoutes';
import videoRoutes from './routes/videoRoutes';
import { createProcessingRoutes } from './routes/processingRoutes';
import qualityRoutes from './routes/qualityRoutes';
import { createWorkflowRoutes } from './routes/workflowRoutes';
import { SocketService } from './services/SocketService';
import { VideoProcessingService } from './services/VideoProcessingService';
import { CleanupService } from './services/CleanupService';
import { HealthMonitorService } from './services/HealthMonitorService';
import { ErrorHandlingService } from './services/ErrorHandlingService';
import { SecurityMiddleware } from './middleware/security';
import { ErrorHandler } from './middleware/errorHandler';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

// Security middleware (should be first)
app.use(SecurityMiddleware.securityHeaders);
app.use(SecurityMiddleware.addRequestId);

// Rate limiting for API routes
app.use('/api', SecurityMiddleware.apiRateLimit);

// CORS and body parsing middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Secure static file serving
app.use('/uploads', SecurityMiddleware.secureFileHeaders, express.static(path.join(__dirname, '../uploads')));

// Initialize services
const socketService = new SocketService(io);
const videoProcessingService = new VideoProcessingService();
const cleanupService = new CleanupService();
const healthService = new HealthMonitorService();
const errorService = new ErrorHandlingService(socketService);

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api', videoRoutes);
app.use('/api', createProcessingRoutes(socketService));
app.use('/api', qualityRoutes);
app.use('/api', createWorkflowRoutes(socketService));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stitchable API is running' });
});

// 404 handler for undefined routes
app.use(ErrorHandler.notFound);

// Global error handling middleware (must be last)
app.use(errorService.createExpressMiddleware());
app.use(ErrorHandler.handle);

// Socket.io connection handling
io.on('connection', (socket) => {
  socketService.handleConnection(socket);
});

// Initialize database and run migrations
try {
  console.log('Initializing database...');
  getDatabase(); // Initialize database connection
  runMigrations(); // Run any pending migrations
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Start background services
const healthMonitorInterval = healthService.startMonitoring(5); // Check every 5 minutes
const cleanupInterval = cleanupService.scheduleCleanup(24, { // Run daily cleanup
  tempFileMaxAge: 24, // 24 hours
  projectMaxAge: 30   // 30 days
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  clearInterval(healthMonitorInterval);
  clearInterval(cleanupInterval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  clearInterval(healthMonitorInterval);
  clearInterval(cleanupInterval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Background services started:');
  console.log('- Health monitoring (5 min intervals)');
  console.log('- Automatic cleanup (24 hour intervals)');
});

export { app, io };