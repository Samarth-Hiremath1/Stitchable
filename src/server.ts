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
import { SocketService } from './services/SocketService';
import { VideoProcessingService } from './services/VideoProcessingService';
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

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api', videoRoutes);
app.use('/api', createProcessingRoutes(socketService));
app.use('/api', qualityRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stitchable API is running' });
});

// 404 handler for undefined routes
app.use(ErrorHandler.notFound);

// Global error handling middleware (must be last)
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, io };