import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRoutes from './auth/routes';
import { apiRoutes } from './routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env['PORT'] || '3001', 10);

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(globalLimiter);
app.use(cors({
  origin: process.env['CORS_ORIGIN']?.split(',') || ['*'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'crewhub-api'
    },
    message: 'CrewHub API is healthy'
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'CrewHub API Server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: '/auth',
        api: '/api',
        health: '/health'
      }
    },
    message: 'CrewHub API server is running'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    error: 'NOT_FOUND',
    data: {
      path: req.originalUrl,
      method: req.method
    }
  });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: 'INTERNAL_ERROR',
    ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`
 ██████ ██████  ███████ ██     ██ ██   ██ ██    ██ ██████  
██      ██   ██ ██      ██     ██ ██   ██ ██    ██ ██   ██ 
██      ██████  █████   ██  █  ██ ███████ ██    ██ ██████  
██      ██   ██ ██      ██ ███ ██ ██   ██ ██    ██ ██   ██ 
 ██████ ██   ██ ███████  ███ ███  ██   ██  ██████  ██████  
by Edwin Escobar (https://github.com/escowin/crewhub)
`);
      console.log('🚀 CrewHub API Server started');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/auth`);
      console.log(`🌐 API endpoints: http://localhost:${PORT}/api`);
      console.log(`⚙️  Environment: ${process.env['NODE_ENV'] || 'development'}`);
      resolve();
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        reject(err);
      } else {
        console.error('❌ Server error:', err);
        reject(err);
      }
    });
  });
};

// Start the server
if (require.main === module) {
  startServer().catch((err) => {
    console.error('❌ Server startup failed:', err);
    process.exit(1);
  });
}

export default app;