import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { runMigrations } from './utils/migrations';
import { getDatabase } from './utils/database';
import projectRoutes from './routes/projectRoutes';
import videoRoutes from './routes/videoRoutes';
import processingRoutes from './routes/processingRoutes';
import qualityRoutes from './routes/qualityRoutes';
import { SocketService } from './services/SocketService';
import { VideoProcessingService } from './services/VideoProcessingService';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api', videoRoutes);
app.use('/api', processingRoutes);
app.use('/api', qualityRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stitchable API is running' });
});

// Initialize services
const socketService = new SocketService(io);
const videoProcessingService = new VideoProcessingService();

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