# CrewHub ↔ Boathouse-ETL ↔ RowCalibur Architecture & Data Flow

## System Overview

This document diagrams the relationship between **CrewHub** (API server), **boathouse-etl** (ETL service), and **RowCalibur** (frontend), showing how athlete data flows between the microservices at different authentication levels.

## Current Microservices Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                ROWCALIBUR FRONTEND                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   Logged Out    │  │   Logged In     │  │  Profile View   │                │
│  │   State         │  │   State         │  │   State         │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ROWCALIBUR BACKEND                                  │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        ROUTES LAYER                                    │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │   dataRoutes.ts │  │   auth.ts       │  │   boatsRoutes.ts│        │   │
│  │  │                 │  │                 │  │                 │        │   │
│  │  │ GET /athletes   │  │ POST /login     │  │ GET /boats      │        │   │
│  │  │ (no auth)       │  │ POST /verify    │  │ (auth required) │        │   │
│  │  │                 │  │                 │  │                 │        │   │
│  │  │ GET /athletes/  │  │                 │  │                 │        │   │
│  │  │ detailed        │  │                 │  │                 │        │   │
│  │  │ (auth required) │  │                 │  │                 │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                │                                               │
│                                ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      SERVICES LAYER                                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │PostgresDataService│  │  authService.ts │  │googleSheetsService│     │   │
│  │  │                 │  │                 │  │                 │        │   │
│  │  │ getAthletes()   │  │ login()         │  │ (fallback)      │        │   │
│  │  │ getDetailedAthletes()│ verifyToken() │  │                 │        │   │
│  │  │ getBoats()      │  │                 │  │                 │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                CREWHUB API SERVER                              │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        ROUTES LAYER                                    │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │   auth.ts       │  │   athletes.ts   │  │   boats.ts      │        │   │
│  │  │                 │  │                 │  │                 │        │   │
│  │  │ POST /auth/login│  │ GET /api/athletes│  │ GET /api/boats  │        │   │
│  │  │ POST /auth/verify│  │ GET /api/athletes/:id│ GET /api/boats/:id│    │   │
│  │  │ GET /auth/athletes│ │ PUT /api/athletes/:id│                 │        │   │
│  │  │ POST /auth/change-pin│                 │                 │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                │                                               │
│                                ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      SERVICES LAYER                                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │  authService.ts │  │ athleteService.ts│  │ lineupService.ts│        │   │
│  │  │                 │  │                 │  │                 │        │   │
│  │  │ login()         │  │ getAthletes()   │  │ getLineups()    │        │   │
│  │  │ verifyToken()   │  │ getAthleteById() │  │ createLineup()  │        │   │
│  │  │ changePin()     │  │ updateAthlete() │  │                 │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                │                                               │
│                                ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        MODELS LAYER                                  │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │   Athlete Model  │  │   Boat Model    │  │   Team Model    │        │   │
│  │  │                 │  │                 │  │                 │        │   │
│  │  │ findAll()       │  │ findAll()       │  │ findAll()       │        │   │
│  │  │ findByPk()      │  │ findByPk()      │  │ findByPk()      │        │   │
│  │  │ create()        │  │ create()        │  │ create()        │        │   │
│  │  │ update()        │  │ update()        │  │ update()        │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            BOATHOUSE-ETL SERVICE                               │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        ETL ORCHESTRATOR                               │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │ orchestrator.ts │  │ athletes.ts     │  │ boats.ts        │        │   │
│  │  │                 │  │                 │  │                 │        │   │
│  │  │ runFullETL()    │  │ extractAthletes()│ extractBoats()   │        │   │
│  │  │ runIncremental()│  │ transformAthletes()│ transformBoats()│        │   │
│  │  │ validateData()  │  │ loadAthletes()  │  │ loadBoats()     │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                │                                               │
│                                ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      SHARED RESOURCES                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │ shared/index.ts │  │ config.json     │  │ google-sheets-  │        │   │
│  │  │                 │  │                 │  │ service.ts      │        │   │
│  │  │ getModels()     │  │ shared paths    │  │                 │        │   │
│  │  │ getConfig()     │  │ to CrewHub       │  │ extractData()   │        │   │
│  │  │ getAuth()       │  │ resources        │  │ validateData() │        │   │
│  │  │ getServices()   │  │                 │  │                 │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE SHEETS DATA SOURCE                              │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   Athletes      │  │     Boats       │  │   Teams         │                │
│  │   Sheet         │  │     Sheet       │  │   Sheet         │                │
│  │                 │  │                 │  │                 │                │
│  │ name            │  │ name            │  │ name            │                │
│  │ email           │  │ type            │  │ team_type       │                │
│  │ phone           │  │ rigging_type    │  │ description     │                │
│  │ us_rowing_number│  │ status          │  │                 │                │
│  │ active          │  │ min_weight_kg   │  │                 │                │
│  │ competitive_status│ max_weight_kg   │  │                 │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                ▲
                                │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            SHARED DATABASE                                    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        boathouse_trc                                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │   Athletes      │  │     Boats       │  │   Teams         │        │   │
│  │  │   Table         │  │     Table       │  │   Table         │        │   │
│  │  │                 │  │                 │  │                 │        │   │
│  │  │ athlete_id      │  │ boat_id         │  │ team_id         │        │   │
│  │  │ name            │  │ name            │  │ name            │        │   │
│  │  │ email           │  │ type            │  │ team_type       │        │   │
│  │  │ phone           │  │ rigging_type    │  │ description     │        │   │
│  │  │ us_rowing_number│  │ status          │  │                 │        │   │
│  │  │ active          │  │ min_weight_kg   │  │                 │        │   │
│  │  │ competitive_status│ max_weight_kg   │  │                 │        │   │
│  │  │ pin_hash        │  │                 │  │                 │        │   │
│  │  │ pin_salt        │  │                 │  │                 │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow by Authentication State

### 1. LOGGED OUT STATE
```
RowCalibur Frontend (Logged Out)
    ↓ GET /api/athletes (no auth)
RowCalibur Backend (dataRoutes.ts)
    ↓ getAthletes()
PostgresDataService
    ↓ GET /auth/athletes
Boathouse-ETL (routes.ts)
    ↓ getActiveAthletes()
AuthService
    ↓ SELECT athlete_id, name FROM athletes WHERE active=true AND competitive_status='active'
Database (Athletes Table)
```

**Data Returned:**
```json
{
  "success": true,
  "data": [
    {"athlete_id": "ATH001", "name": "John Doe"},
    {"athlete_id": "ATH002", "name": "Jane Smith"}
  ]
}
```

### 2. LOGGED IN STATE (Detailed Athletes)
```
RowCalibur Frontend (Logged In)
    ↓ GET /api/athletes/detailed (with Bearer token)
RowCalibur Backend (dataRoutes.ts)
    ↓ getDetailedAthletes(authToken)
PostgresDataService
    ↓ GET /api/athletes (with Authorization header)
Boathouse-ETL (athletes.ts)
    ↓ authMiddleware.verifyToken + Athlete.findAll()
Database (Athletes Table)
```

**Data Returned:**
```json
{
  "success": true,
  "data": [
    {
      "athlete_id": "ATH001",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234",
      "weight_kg": 75,
      "birth_year": 1990,
      "type": "Rower",
      "active": true,
      "competitive_status": "active"
    }
  ]
}
```

### 3. PROFILE VIEW STATE (Individual Athlete)
```
RowCalibur Frontend (Profile View)
    ↓ GET /api/athletes/:id/profile (with Bearer token)
RowCalibur Backend (dataRoutes.ts)
    ↓ getAthleteProfile(athleteId)
PostgresDataService
    ↓ GET /api/athletes/:id (with Authorization header)
Boathouse-ETL (athletes.ts)
    ↓ authMiddleware.verifyToken + Athlete.findOne()
Database (Athletes Table)
```

**Data Returned:**
```json
{
  "success": true,
  "data": {
    "athlete_id": "ATH001",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "us_rowing_number": "12345",
    "emergency_contact": "Jane Doe",
    "emergency_contact_phone": "555-5678",
    "weight_kg": 75,
    "birth_year": 1990,
    "type": "Rower",
    "discipline": "Sweep & Scull",
    "side": "Either",
    "bow_in_dark": false,
    "experience": 5,
    "active": true,
    "competitive_status": "active"
  }
}
```

## Key Authentication Levels

### Level 1: Public (No Authentication)
- **Endpoint:** `GET /auth/athletes` (Boathouse-ETL)
- **Purpose:** Athlete selection for login
- **Data:** Only `athlete_id` and `name`
- **Used by:** RowCalibur's `getAthletes()` method

### Level 2: Authenticated (Bearer Token Required)
- **Endpoint:** `GET /api/athletes` (Boathouse-ETL)
- **Purpose:** Detailed athlete data for IndexedDB storage
- **Data:** All athlete fields except sensitive information
- **Used by:** RowCalibur's `getDetailedAthletes()` method

### Level 3: Individual Profile (Bearer Token Required)
- **Endpoint:** `GET /api/athletes/:id` (Boathouse-ETL)
- **Purpose:** Complete athlete profile with contact details
- **Data:** All athlete fields including contact information
- **Used by:** RowCalibur's `getAthleteProfile()` method

## How to Add Key-Values to Athlete Fetch Requests

### 1. Adding Fields to Boathouse-ETL Database
First, add the new field to the Athletes table in Boathouse-ETL:

```sql
ALTER TABLE athletes ADD COLUMN new_field VARCHAR(255);
```

### 2. Updating Boathouse-ETL Athlete Model
Update the Athlete model in `src/models/Athlete.ts`:

```typescript
export interface AthleteAttributes {
  // ... existing fields
  new_field?: string;
}
```

### 3. Updating Boathouse-ETL Routes
Modify the `attributes` array in `src/routes/athletes.ts`:

```typescript
// For public endpoint (Level 1)
attributes: ['athlete_id', 'name'] // Keep minimal

// For authenticated endpoint (Level 2)
attributes: [
  'athlete_id', 'name', 'email', 'phone', 'weight_kg', 
  'birth_year', 'type', 'active', 'competitive_status',
  'new_field' // Add your new field here
]

// For individual profile (Level 3)
attributes: [
  'athlete_id', 'name', 'email', 'phone', 'us_rowing_number',
  'emergency_contact', 'emergency_contact_phone', 'weight_kg',
  'birth_year', 'type', 'discipline', 'side',
  'bow_in_dark', 'experience', 'active', 'competitive_status',
  'new_field' // Add your new field here
]
```

### 4. Updating RowCalibur Interfaces
Update the Athlete interface in `src/services/postgresDataService.ts`:

```typescript
export interface Athlete {
  id: string;
  name: string;
  type: 'Cox' | 'Rower' | 'Rower & Coxswain';
  // ... existing fields
  new_field?: string; // Add your new field here
}
```

### 5. Example: Adding `rigging_type` to Boats (Already Implemented)
This is how `rigging_type` was added to boats:

**Boathouse-ETL (`src/routes/boats.ts`):**
```typescript
attributes: [
  'boat_id', 'name', 'type', 'status',
  'rigging_type', // ← Added here
  'min_weight_kg', 'max_weight_kg'
]
```

**RowCalibur (`src/services/postgresDataService.ts`):**
```typescript
export interface Boat {
  name: string;
  status: string;
  type: string;
  riggingType?: string; // ← Added here (camelCase for frontend)
  minWeight?: number;
  maxWeight?: number;
}
```

**Data transformation in RowCalibur:**
```typescript
const boatData = {
  id: boat.dataValues.boat_id,
  name: boat.dataValues.name,
  type: boat.dataValues.type,
  riggingType: boat.dataValues.rigging_type, // ← Transform snake_case to camelCase
  status: boat.dataValues.status,
  minWeight: boat.dataValues.min_weight_kg,
  maxWeight: boat.dataValues.max_weight_kg
};
```

## Summary

The architecture follows a clear pattern:
1. **RowCalibur Frontend** makes requests to **RowCalibur Backend**
2. **RowCalibur Backend** uses **PostgresDataService** to make API calls to **Boathouse-ETL**
3. **Boathouse-ETL** serves different data levels based on authentication
4. Data flows back through the same chain with appropriate transformations

To add new fields, you need to:
1. Add to Boathouse-ETL database and model
2. Include in the appropriate `attributes` array based on authentication level
3. Update RowCalibur interfaces
4. Handle any necessary data transformations (snake_case ↔ camelCase)
