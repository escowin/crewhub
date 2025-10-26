# CrewHub

A centralized API server and authentication hub for the rowing club ecosystem. CrewHub serves as the digital "boathouse manager" that provides secure access to all rowing club data and coordinates activities across multiple applications.

## 🎯 Project Goals

- **Centralized Authentication**: Single sign-on system for all rowing club applications
- **Unified API Gateway**: Single point of access for all data operations
- **Secure Data Access**: JWT-based authentication with PIN security
- **Application Coordination**: Serves as the hub connecting all club applications
- **Scalable Architecture**: Ready for future applications and integrations

## 🏗️ Architecture

### Core Systems

#### Authentication Service
- **PIN-Based Login**: Secure 6-digit PIN authentication for athletes
- **JWT Tokens**: Stateless authentication with configurable expiration
- **Rate Limiting**: 1000 requests per 15 minutes per IP
- **Account Security**: Automatic lockout and PIN reset capabilities

#### API Gateway
- **RESTful Endpoints**: Standardized API for all data operations
- **Request Routing**: Intelligent routing to appropriate services
- **Response Standardization**: Consistent response format across all endpoints
- **Error Handling**: Comprehensive error management and logging

#### Data Access Layer
- **Database Integration**: Direct connection to PostgreSQL database
- **Model Management**: Sequelize ORM for data operations
- **Query Optimization**: Efficient database queries and caching
- **Data Validation**: Input validation and sanitization

### Data Management
- **Real-time Access**: Live data access for all applications
- **Data Consistency**: Ensures data integrity across all systems
- **Audit Logging**: Complete request and authentication logs
- **Performance Monitoring**: Request timing and error tracking

## 🛠️ Technology Stack

- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT with bcrypt password hashing
- **API Framework**: Express.js with CORS and rate limiting
- **Environment**: Docker support for containerized deployment

## 📁 Project Structure

```
crewhub/
├── src/
│   ├── auth/              # Authentication service
│   │   ├── authService.ts
│   │   ├── config.ts
│   │   ├── middleware.ts
│   │   ├── routes.ts
│   │   ├── server.ts
│   │   └── types.ts
│   ├── config/            # Configuration
│   │   ├── database.ts
│   │   ├── env.ts
│   │   └── sequelize.ts
│   ├── models/            # Database models
│   │   ├── Athlete.ts
│   │   ├── Team.ts
│   │   ├── Boat.ts
│   │   ├── PracticeSession.ts
│   │   ├── Attendance.ts
│   │   ├── Lineup.ts
│   │   ├── Gauntlet.ts
│   │   ├── GauntletMatch.ts
│   │   ├── Ladder.ts
│   │   ├── LadderPosition.ts
│   │   └── UsraCategory.ts
│   ├── routes/            # API routes
│   │   ├── athletes.ts
│   │   ├── attendance.ts
│   │   ├── boats.ts
│   │   ├── gauntletMatches.ts
│   │   ├── gauntlets.ts
│   │   ├── ladderPositions.ts
│   │   ├── ladders.ts
│   │   ├── lineups.ts
│   │   ├── practiceSessions.ts
│   │   └── index.ts
│   ├── services/          # Business logic
│   │   ├── athleteService.ts
│   │   ├── attendanceService.ts
│   │   ├── ladderService.ts
│   │   ├── lineupService.ts
│   │   └── index.ts
│   ├── utils/             # Utilities
│   │   └── database.ts
│   └── index.ts           # Main server entry point
├── docs/
│   └── setup.md
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL database (boathouse_trc)
- Environment variables configured

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:escowin/crewhub.git
   cd crewhub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with database and authentication credentials
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

## 📋 Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run build` - Build TypeScript
- `npm run start` - Start production server
- `npm run clean` - Clean build directory

### Code Quality & Testing
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

### Database
- `npm run migrate:up` - Run pending migrations
- `npm run migrate:down` - Rollback last migration
- `npm run migrate:status` - Check migration status
- `npm run db:setup` - Create database and run migrations
- `npm run db:drop` - Drop database

## 🔧 Configuration

### Environment Variables
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name (boathouse_trc)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_SSL` - SSL connection (true/false)
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - JWT signing secret
- `DEFAULT_PIN` - Default PIN for new athletes
- `CORS_ORIGIN` - Allowed CORS origins
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

### Database Setup
1. Ensure PostgreSQL is running
2. Create database: `createdb boathouse_trc`
3. Run migrations: `npm run migrate:up`
4. Verify connection: `npm run test:db-connection`

## 🌐 API Endpoints

### Authentication (`/auth`)
- `POST /login` - Athlete authentication
- `POST /change-pin` - Change athlete PIN
- `POST /verify` - Verify JWT token
- `GET /athletes` - Get active athletes
- `POST /set-default-pin` - Set default PIN (admin)
- `GET /health` - Authentication service health

### Data API (`/api`)
- **Athletes**: `GET /athletes`, `GET /athletes/:id`, `PUT /athletes/:id`
- **Teams**: `GET /teams`
- **Boats**: `GET /boats`
- **Practice Sessions**: `GET /practice-sessions`
- **Attendance**: `GET /attendance`
- **Lineups**: `GET /lineups`
- **Competitive Systems**: `GET /gauntlets`, `GET /ladders`

### System
- `GET /health` - Server health check
- `GET /` - Server information

## 🔄 Integration Points

### With boathouse-etl
- **Data Source**: CrewHub reads from the same PostgreSQL database
- **ETL Coordination**: Works alongside ETL processes
- **Data Consistency**: Ensures real-time data access
- **Shared Resources**: Provides models and config via config.json approach
- **Service Optimization**: API-optimized database configuration

### With rowcalibur
- **Athlete Interface**: Provides data for athlete-facing application
- **Authentication**: Handles login and session management
- **Competitive Features**: Serves gauntlet and ladder data

### With crewassignment (future)
- **Coaching Interface**: Will provide data for coaching application
- **Team Management**: Serves team and lineup data
- **Practice Planning**: Provides session and attendance data

## 📊 Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  boathouse-etl  │    │     crewhub     │    │   rowcalibur    │
│                 │    │                 │    │                 │
│ 🏭 ETL Service  │───▶│ 🌐 API Server   │◄───│ 📱 Frontend     │
│ (Data Ingestion)│    │ (Data Access)   │    │ (Athlete App)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│         boathouse_trc                   │
│                                         │
│ 🏠 The Boathouse (Central Repository)   │
│ - Stores all equipment and records      │
│ - Central data hub                      │
└─────────────────────────────────────────┘
```

### Shared Resource Architecture
CrewHub serves as the source of truth for shared resources:
- **Database Models**: All Sequelize models defined in `src/models/`
- **Configuration**: Environment and database config in `src/config/`
- **Shared via config.json**: Boathouse-ETL references these resources dynamically
- **Service Optimization**: API-optimized database configuration for high-performance requests

## 🔒 Security & Performance

### Security Features
- **PIN Encryption**: bcrypt hashing with salt
- **Rate Limiting**: 1000 requests per 15 minutes per IP
- **Account Lockout**: Automatic lockout after failed attempts
- **JWT Expiration**: 7-day token lifetime
- **CORS Protection**: Configurable origin restrictions
- **Input Validation**: Comprehensive data validation and sanitization
- **SQL Injection Prevention**: Sequelize ORM with parameterized queries

### Performance Features
- **Connection Pooling**: Efficient database connection management
- **Response Caching**: JWT-based stateless authentication
- **Health Checks**: Service status monitoring
- **Request Logging**: Complete request and response logging
- **Error Tracking**: Comprehensive error reporting

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run start
```

### Docker
```bash
docker build -t crewhub .
docker run -p 3001:3001 crewhub
```

## 📝 License

This is proprietary software. All rights reserved.

**NO USE WITHOUT PERMISSION**: This software may not be used, copied, modified, distributed, or sold without explicit written permission from Edwin Escobar.

For licensing inquiries, commercial use, or permission requests, contact:
**Edwin Escobar**  
Email: edwin@escowinart.com

See LICENSE and LICENSING.md files for complete terms and conditions.

## 🆘 Support

For questions, issues, or licensing inquiries, please:
- Check the documentation in the `docs/` folder
- Contact Edwin Escobar at edwin@escowinart.com

---

**Built with ❤️ for the rowing community**

*CrewHub - The digital boathouse manager for modern rowing clubs*