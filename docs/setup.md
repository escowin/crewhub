# CrewHub Setup Guide

*Migration from boathouse-etl to centralized server architecture*

## Overview

This guide will help you migrate the centralized server functionality from `boathouse-etl` to `crewhub`, creating a dedicated API server that will serve as the central hub for all rowing club applications.

## 🎯 Migration Goals

- **Extract** authentication service from boathouse-etl
- **Move** all API routes and business logic to crewhub
- **Maintain** database connectivity and models
- **Preserve** ETL functionality in boathouse-etl
- **Create** a clean, focused API server

## 📁 Target Directory Structure

```
crewhub/
├── src/
│   ├── auth/                 # Authentication service
│   │   ├── authService.ts
│   │   ├── config.ts
│   │   ├── middleware.ts
│   │   ├── routes.ts
│   │   ├── server.ts
│   │   └── types.ts
│   ├── config/               # Configuration
│   │   ├── database.ts
│   │   ├── env.ts
│   │   └── sequelize.ts
│   ├── models/               # Database models
│   │   ├── Athlete.ts
│   │   ├── Team.ts
│   │   ├── Boat.ts
│   │   ├── PracticeSession.ts
│   │   ├── Attendance.ts
│   │   ├── Lineup.ts
│   │   ├── Gauntlet.ts
│   │   ├── GauntletMatch.ts
│   │   ├── GauntletPosition.ts
│   │   └── UsraCategory.ts
│   ├── routes/               # API routes
│   │   ├── athletes.ts
│   │   ├── attendance.ts
│   │   ├── boats.ts
│   │   ├── gauntletMatches.ts
│   │   ├── gauntlets.ts
│   │   ├── gauntletPositions.ts
│   │   ├── lineups.ts
│   │   ├── practiceSessions.ts
│   │   └── index.ts
│   ├── services/             # Business logic
│   │   ├── athleteService.ts
│   │   ├── attendanceService.ts
│   │   ├── gauntletService.ts
│   │   ├── lineupService.ts
│   │   └── index.ts
│   ├── utils/                # Utilities
│   │   └── database.ts
│   ├── migrations/           # Database migrations
│   │   └── (migration files)
│   ├── scripts/              # Utility scripts
│   │   └── (utility scripts)
│   └── index.ts              # Main server entry point
├── docs/
│   └── setup.md
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## 🔄 Migration Steps

### Step 1: Initialize CrewHub Project

```bash
cd crewhub
npm init -y
```

### Step 2: Install Dependencies

```bash
# Core dependencies
npm install express cors dotenv bcrypt jsonwebtoken
npm install express-rate-limit winston
npm install sequelize sequelize-cli pg
npm install typescript ts-node

# Development dependencies
npm install -D @types/express @types/cors @types/bcrypt
npm install -D @types/jsonwebtoken @types/node @types/pg
npm install -D @types/sequelize eslint prettier
npm install -D jest rimraf
```

### Step 3: Copy Configuration Files

**From boathouse-etl to crewhub:**

```bash
# Copy TypeScript config
cp ../boathouse-etl/tsconfig.json ./tsconfig.json

# Copy environment template
cp ../boathouse-etl/.env.example ./.env.example

# Copy gitignore
cp ../boathouse-etl/.gitignore ./.gitignore
```

### Step 4: Copy Source Code

**Copy these directories from boathouse-etl/src to crewhub/src:**

```bash
# Authentication service
cp -r ../boathouse-etl/src/auth ./src/

# Configuration
cp -r ../boathouse-etl/src/config ./src/

# Database models
cp -r ../boathouse-etl/src/models ./src/

# API routes
cp -r ../boathouse-etl/src/routes ./src/

# Business services
cp -r ../boathouse-etl/src/services ./src/

# Utilities
cp -r ../boathouse-etl/src/utils ./src/

# Database migrations
cp -r ../boathouse-etl/src/migrations ./src/

# Utility scripts
cp -r ../boathouse-etl/src/scripts ./src/
```

### Step 5: Create Main Server Entry Point

Create `src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { authRoutes } from './auth/routes';
import { apiRoutes } from './routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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
  origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
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
app.use('*', (req, res) => {
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
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log('🚀 CrewHub API Server started');
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/auth`);
      console.log(`🌐 API endpoints: http://localhost:${PORT}/api`);
      console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
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
```

### Step 6: Create Routes Index

Create `src/routes/index.ts`:

```typescript
import { Router } from 'express';
import athleteRoutes from './athletes';
import attendanceRoutes from './attendance';
import boatRoutes from './boats';
import gauntletRoutes from './gauntlets';
import gauntletMatchRoutes from './gauntletMatches';
import ladderRoutes from './ladders';
import ladderPositionRoutes from './ladderPositions';
import lineupRoutes from './lineups';
import practiceSessionRoutes from './practiceSessions';

const router = Router();

// Mount all route modules
router.use('/athletes', athleteRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/boats', boatRoutes);
router.use('/gauntlets', gauntletRoutes);
router.use('/gauntlet-matches', gauntletMatchRoutes);
router.use('/gauntlet-positions', gauntletPositionRoutes);
router.use('/lineups', lineupRoutes);
router.use('/practice-sessions', practiceSessionRoutes);

export { router as apiRoutes };
```

### Step 7: Update Package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "clean": "rimraf dist",
    "prebuild": "npm run clean",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "migrate:up": "npx sequelize-cli db:migrate",
    "migrate:down": "npx sequelize-cli db:migrate:undo",
    "migrate:status": "npx sequelize-cli db:migrate:status",
    "db:setup": "npx sequelize-cli db:create && npm run migrate:up",
    "db:drop": "npx sequelize-cli db:drop"
  }
}
```

### Step 8: Environment Configuration

Create `.env` file:

```bash
# Database Configuration (matching boathouse-etl pattern)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=boathouse_*
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_SSL=false

# Server Configuration
PORT=3001
NODE_ENV=development

# Authentication (used by crewhub auth service)
JWT_SECRET=super-secret-jwt-key # run node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" to generate a new secret
DEFAULT_PIN=000000 # Default PIN for new athletes

# CORS Configuration (used by crewhub auth service)
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002

# Logging
LOG_LEVEL=info
```

### Step 9: Update Database Configuration

The database configuration is already set up to use the individual DB_* environment variables (matching boathouse-etl pattern). No changes needed to `src/config/database.ts`.

### Step 10: Database Configuration

CrewHub will use the same `boathouse_*` database as boathouse-etl. This maintains the thematic consistency where:
- **boathouse_*** = The central data repository (the "boathouse" where all data is stored)
- **crewhub** = The API server that provides access to the boathouse data
- **boathouse-etl** = The ETL service that populates the boathouse with data

No database changes needed - crewhub will connect to the existing `boathouse_*` database.

### Step 11: Test the Migration

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm run dev
```

## 🔌 Port Management Strategy

To avoid conflicts between services, use this port allocation:

| Service | Port | Purpose | URL |
|---------|------|---------|-----|
| **boathouse-etl** | `3000` | ETL service (data processing) | `http://localhost:3000` |
| **crewhub** | `3001` | API server (authentication + data) | `http://localhost:3001` |
| **rowcalibur** | `3002` | Frontend client (React app) | `http://localhost:3002` |
| **crewassignment** | `3003` | Coaching app (future) | `http://localhost:3003` |

### Port Configuration Files

**crewhub/.env:**
```bash
PORT=3001
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173
```

**boathouse-etl/.env:**
```bash
PORT=3000
AUTH_PORT=3000  # If running auth service
```

**rowcalibur/.env:**
```bash
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_AUTH_URL=http://localhost:3001/auth
PORT=3002
```

## 🔧 Post-Migration Tasks

### 1. Update boathouse-etl

After migration, remove these from boathouse-etl:

```bash
# Remove authentication service
rm -rf src/auth/

# Remove API routes
rm -rf src/routes/

# Remove business services
rm -rf src/services/

# Update package.json to remove unused dependencies
# Remove: express, cors, bcrypt, jsonwebtoken, express-rate-limit
```

### 2. Update Client Applications

Update rowcalibur and future applications to point to crewhub:

```typescript
// Change API base URL from boathouse-etl to crewhub
const API_BASE_URL = 'http://localhost:3001/api';
const AUTH_BASE_URL = 'http://localhost:3001/auth';
```

## 🚀 Verification Checklist

- [ ] CrewHub server starts without errors
- [ ] Authentication endpoints work (`/auth/login`, `/auth/verify`)
- [ ] API endpoints respond correctly (`/api/athletes`, `/api/boats`, etc.)
- [ ] Database connections work
- [ ] CORS is configured properly
- [ ] Rate limiting is active
- [ ] Health check endpoint responds
- [ ] Client applications can connect to new API

## 🔍 Troubleshooting

### Common Issues

1. **Port conflicts**: Change PORT in .env if 3001 is in use
2. **Database connection**: Verify DATABASE_URL is correct
3. **CORS errors**: Update CORS_ORIGIN in .env
4. **Missing dependencies**: Run `npm install` again
5. **TypeScript errors**: Check tsconfig.json paths

### Debug Commands

```bash
# Check database connection
npm run test:db-connection

# Verify environment variables
npm run check:config

# Run linting
npm run lint

# Check TypeScript compilation
npm run build
```

## 📚 Next Steps

1. **Test thoroughly** with existing client applications
2. **Update documentation** for new API endpoints
3. **Set up monitoring** and logging
4. **Plan deployment** strategy
5. **Update CI/CD** pipelines
