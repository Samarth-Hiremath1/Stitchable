# Stitchable

AI-powered multi-source video stitching web application that enables collaborative video creation.

## Project Structure

```
├── src/                    # Backend source code
│   ├── controllers/        # API route controllers
│   ├── services/          # Business logic services
│   ├── models/            # Data models
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   └── server.ts          # Main server file
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   └── package.json
├── uploads/               # File storage directories
│   ├── videos/           # Uploaded video files
│   ├── thumbnails/       # Generated thumbnails
│   └── processed/        # Final processed videos
└── package.json          # Backend dependencies
```

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

1. Install backend dependencies:
```bash
npm install
```

2. Install frontend dependencies:
```bash
cd frontend && npm install
```

### Running the Application

1. Start both backend and frontend in development mode:
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend development server on http://localhost:3000

2. Or run them separately:

Backend only:
```bash
npm run dev:backend
```

Frontend only:
```bash
npm run dev:frontend
```

### Building for Production

```bash
npm run build
```

### Testing

```bash
npm test
```

## Technology Stack

**Backend:**
- Node.js with Express.js
- TypeScript
- Socket.io for real-time updates
- SQLite with better-sqlite3
- Multer for file uploads

**Frontend:**
- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- React Query for state management

**Video Processing:**
- FFmpeg for video manipulation
- OpenCV for computer vision
- TensorFlow.js for ML models
