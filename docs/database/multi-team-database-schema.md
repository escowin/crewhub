# Multi-Team Boathouse Database Schema

## Overview

This schema extends the single-team design to support multiple teams within a boathouse (Mens Masters, Juniors Rec, Juniors Varsity, Babs, etc.) while maintaining shared resources and cross-team capabilities.

## Schema Files

- **`schema.sql`** - Complete SQL table definitions and indexes
- **`multi-team-database-schema.md`** - This documentation file with business logic and examples

## Design Decisions

### Primary Key Strategy
- **User-manipulatable tables**: Use UUID for global uniqueness and offline sync safety:
  - `athletes.athlete_id` (UUID)
  - `boats.boat_id` (UUID) 
  - `attendance.attendance_id` (UUID)
  - `lineups.lineup_id` (UUID)
  - `seat_assignments.seat_assignment_id` (UUID)
  - `races.race_id` (UUID)
  - `regatta_registrations.registration_id` (UUID)
- **System-managed tables**: Use auto-increment integers (`SERIAL PRIMARY KEY`) for:
  - Better performance in joins and queries
  - Smaller storage footprint (4-8 bytes vs 16 bytes)
  - Human-readable IDs for debugging and logs
  - Simpler foreign key relationships

### Scrimmage Handling
- **In-club and joint-club scrimmages** are stored in the `regattas` table with `regatta_type = 'Scrimmage'`
- This unified approach allows:
  - Consistent data model across all competitive events
  - Same registration and race tracking workflows
  - Easy querying of all competitive activities
  - Flexible categorization (can add 'Time Trial', 'Head Race', etc.)

### Registration URL Field
- Added `registration_url` to `regatta_registrations` table
- Supports various registration systems:
  - External regatta websites
  - Private Google Sheets for club events
  - Internal payment portals
  - Joint-club registration systems

## Core Multi-Team Tables

### 1. Athletes Table
Based on current Google Sheets athlete data structure. See `schema.sql` for complete table definition.

**Key Features:**
- UUID primary key for global uniqueness
- PIN authentication system with bcrypt hashing
- Competitive status management (active, inactive, retired, banned)
- USRA category integration
- ETL tracking fields

#### PIN Authentication System
The athletes table includes a 6-digit PIN authentication system:

**Security Features:**
- **PIN Storage**: 6-digit PINs are hashed with bcrypt and stored with unique salts
- **Account Lockout**: Progressive lockout after failed attempts (3 attempts = 5min, 5 attempts = 15min, 6+ attempts = 1hr)
- **Rate Limiting**: Maximum 10 login attempts per 5-minute window
- **PIN Reset**: First-time users must change from default PIN
- **Session Management**: JWT tokens with 24-hour expiration and 7-day refresh tokens

**PIN Fields:**
- `pin_hash`: bcrypt hashed PIN (never store plaintext)
- `pin_salt`: Unique salt for each PIN
- `pin_created_at`: When PIN was first created
- `last_login`: Last successful login timestamp
- `failed_login_attempts`: Consecutive failed attempts counter
- `locked_until`: Account lockout expiration
- `pin_reset_required`: Force PIN change on next login

**Default PINs**: All athletes start with PIN and must change it on first login.

### 2. Boats Table
Enhanced from current boat structure. See `schema.sql` for complete table definition.

**Key Features:**
- UUID primary key for global uniqueness
- Standardized boat type notation (1x, 2x, 2-, 4x, 4+, 8+)
- Weight constraints (min/max)
- Status tracking (Available, Reserved, In Use, Maintenance, Retired)

### 3. Teams Table
Define all teams within the boathouse. See `schema.sql` for complete table definition.

**Key Features:**
- Auto-increment integer primary key
- Team management with head coach and assistant coaches
- Mailing list integration
- Flexible team types

### 4. Team Memberships Table
Track which athletes belong to which teams with different roles. See `schema.sql` for complete table definition.

**Key Features:**
- Multi-role support (Athlete, Captain, Coach, Assistant Coach, Secretary)
- Unique constraint per athlete per team
- Soft deletion with left_at timestamp

**Multi-Role Support:**
An athlete can have different roles across different teams. For example:
- **John Smith**: Athlete in "Mens Masters" + Coach in "Junior Boys Varsity"
- **Sarah Johnson**: Captain in "Womens Masters" + Assistant Coach in "Junior Girls Rec"
- **Mike Davis**: Athlete in "Mens Masters" + Secretary in "Mens Masters" (dual role)

### 5. Enhanced Practice Sessions Table
Add team context to practice sessions. See `schema.sql` for complete table definition.

**Key Features:**
- Team-specific practice sessions
- Flexible session types (Practice, Race, Erg Test, Meeting, Other)
- Location and timing information

### 6. Enhanced Attendance Table
Team-specific attendance tracking. See `schema.sql` for complete table definition.

**Key Features:**
- Team context denormalized for performance
- Flexible attendance status (Yes, No, Maybe, Late, Excused)
- Unique constraint per athlete per session

### 7. Enhanced Lineups Table
Team-specific lineup management. See `schema.sql` for complete table definition.

**Key Features:**
- Team context for lineups
- Performance metrics (total weight, average weight, average age)
- Flexible lineup types (Practice, Race, Test)

### 8. Enhanced Regatta Registrations Table
Team-specific regatta participation. See `schema.sql` for complete table definition.

**Key Features:**
- Primary team assignment for regattas
- Registration status tracking
- Coach approval workflow
- Registration URL support

### 9. Seat Assignments Table
Detailed seat assignments within lineups. See `schema.sql` for complete table definition.

**Key Features:**
- Seat number and side (Port/Starboard)
- Unique constraint per seat per lineup

**Seat Number Logic:**
- **Bow**: Always seat 1
- **Coxswain**: Seat 5 (in 4+) or seat 9 (in 8+)
- **Stroke**: Last rowing seat (seat 4 in 4+, seat 8 in 8+)
- **Other seats**: 2, 3, 6, 7 (in 8+) or 2, 3 (in 4+)

Seat names are derived from seat numbers and boat type in the application layer.

### 10. Regattas Table
For tracking competitions. See `schema.sql` for complete table definition.

**Key Features:**
- Flexible regatta types including scrimmages
- Registration management
- Date and location tracking

### 11. Races Table
Individual race events within regattas. See `schema.sql` for complete table definition.

**Key Features:**
- Race results and timing
- Placement tracking
- Distance and lane information

### 12. Erg Tests Table
For tracking performance tests. See `schema.sql` for complete table definition.

**Key Features:**
- Multiple test types (2K, 5K, 1K, etc.)
- Performance metrics (split, watts, calories)
- Test conditions tracking

### 13. USRA Categories Table
For age category management. See `schema.sql` for complete table definition.

**Key Features:**
- Age range definitions
- Pre-seeded categories
- Unique constraints

### 14. Mailing Lists Table
For team communication management. See `schema.sql` for complete table definition.

**Key Features:**
- Team-specific mailing lists
- Active/inactive status
- Email uniqueness

### 15. Gauntlet System Tables
For Rowcalibur's competitive system (using UUIDs for offline-first compatibility). See `schema.sql` for complete table definitions.

**Simplified Design Philosophy:**
- **Single Point of Control**: Gauntlet is the primary entity - creation and deletion of a gauntlet manages all related data
- **Minimal Configuration**: Removed complex configuration objects in favor of simple relational structure
- **CASCADE Deletes**: When a gauntlet is deleted, all related data is automatically removed
- **1:1 Relationship**: Each gauntlet has exactly one ladder (auto-created)
- **No Redundancy**: Eliminated duplicate fields between gauntlets and ladders

**CASCADE Delete Chain:**
```
DELETE gauntlet → CASCADE deletes:
├── gauntlet_lineups
│   └── gauntlet_seat_assignments
├── gauntlet_matches
│   └── ladder_progressions (via match_id)
└── ladders
    ├── ladder_positions
    └── ladder_progressions (via ladder_id)
```

**Tables:**
- `gauntlets` - Tournament definitions
- `gauntlet_matches` - Individual match records
- `gauntlet_lineups` - Lineup configurations
- `gauntlet_seat_assignments` - Seat assignments
- `ladders` - Ranking ladder system
- `ladder_positions` - Athlete positions
- `ladder_progressions` - Position change history

### 16. ETL Jobs Tracking Table
For monitoring data synchronization. See `schema.sql` for complete table definition.

**Key Features:**
- Job status tracking (running, completed, failed, cancelled)
- Performance metrics (records processed, failed, created, updated)
- Error handling with detailed error messages
- JSONB metadata support

## Boat Reservation System

### 17. Boat Reservations Table
Track boat usage across teams. See `schema.sql` for complete table definition.

**Key Features:**
- Cross-team boat reservation system
- Time-based availability checking
- Integration with practice sessions and lineups
- Status tracking (Reserved, In Use, Completed, Cancelled)

## Business Logic Implementation

### **Multi-Team Practice Access**

```javascript
// Get practice sessions for all teams an athlete belongs to
async function getAthletePracticeSessions(athleteId, dateRange) {
  // First, get all teams the athlete belongs to (any role)
  const athleteTeams = await TeamMembership.findAll({
    where: {
      athlete_id: athleteId,
      active: true
    },
    include: [{ model: Team }]
  });
  
  const teamIds = athleteTeams.map(membership => membership.team_id);
  
  // Get practice sessions for all their teams
  return await PracticeSession.findAll({
    where: {
      team_id: {
        [Sequelize.Op.in]: teamIds
      },
      date: {
        [Sequelize.Op.between]: dateRange
      }
    },
    include: [
      { 
        model: Team,
        attributes: ['name', 'display_name', 'team_type']
      },
      { 
        model: Attendance, 
        include: [Athlete],
        where: { athlete_id: athleteId },
        required: false // LEFT JOIN to include sessions even without attendance record
      },
      { 
        model: Lineup, 
        include: [Boat] 
      }
    ],
    order: [['date', 'ASC'], ['start_time', 'ASC']]
  });
}

// Get practice sessions with role context
async function getAthletePracticeSessionsWithRoles(athleteId, dateRange) {
  const athleteTeams = await TeamMembership.findAll({
    where: {
      athlete_id: athleteId,
      active: true
    },
    include: [{ model: Team }]
  });
  
  const teamIds = athleteTeams.map(membership => membership.team_id);
  const teamRoles = athleteTeams.reduce((acc, membership) => {
    acc[membership.team_id] = membership.role;
    return acc;
  }, {});
  
  const sessions = await PracticeSession.findAll({
    where: {
      team_id: {
        [Sequelize.Op.in]: teamIds
      },
      date: {
        [Sequelize.Op.between]: dateRange
      }
    },
    include: [
      { 
        model: Team,
        attributes: ['name', 'display_name', 'team_type']
      },
      { 
        model: Attendance, 
        include: [Athlete],
        where: { athlete_id: athleteId },
        required: false
      },
      { 
        model: Lineup, 
        include: [Boat] 
      }
    ],
    order: [['date', 'ASC'], ['start_time', 'ASC']]
  });
  
  // Add role context to each session
  return sessions.map(session => ({
    ...session.toJSON(),
    athlete_role: teamRoles[session.team_id],
    can_manage: ['Coach', 'Assistant Coach', 'Captain'].includes(teamRoles[session.team_id])
  }));
}

// Single team practice sessions (for team-specific views)
async function getTeamPracticeSessions(teamId, dateRange) {
  return await PracticeSession.findAll({
    where: {
      team_id: teamId,
      date: {
        [Sequelize.Op.between]: dateRange
      }
    },
    include: [
      { model: Team },
      { model: Attendance, include: [Athlete] },
      { model: Lineup, include: [Boat] }
    ]
  });
}
```

### **Frontend Filtering Logic**

```javascript
// Example React component logic
function PracticeSessionsView({ athleteId }) {
  const [sessions, setSessions] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [athleteTeams, setAthleteTeams] = useState([]);
  
  useEffect(() => {
    // Get athlete's teams and practice sessions
    Promise.all([
      getAthleteTeams(athleteId),
      getAthletePracticeSessionsWithRoles(athleteId, dateRange)
    ]).then(([teams, practiceSessions]) => {
      setAthleteTeams(teams);
      setSessions(practiceSessions);
    });
  }, [athleteId]);
  
  // Filter sessions based on selected team
  const filteredSessions = selectedTeam === 'all' 
    ? sessions 
    : sessions.filter(session => session.team_id === selectedTeam);
  
  return (
    <div>
      {/* Team filter dropdown */}
      <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
        <option value="all">All My Teams</option>
        {athleteTeams.map(team => (
          <option key={team.team_id} value={team.team_id}>
            {team.Team.display_name} ({team.role})
          </option>
        ))}
      </select>
      
      {/* Practice sessions list */}
      {filteredSessions.map(session => (
        <div key={session.session_id} className="practice-session">
          <h3>{session.Team.display_name} - {session.session_name}</h3>
          <p>Date: {session.date} | Time: {session.start_time}</p>
          <p>My Role: {session.athlete_role}</p>
          {session.can_manage && (
            <button>Manage Session</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### **Boat Reservation Logic**

```javascript
// Check boat availability across teams
async function checkBoatAvailability(boatId, date, startTime, endTime, excludeTeamId = null) {
  const reservations = await BoatReservation.findAll({
    where: {
      boat_id: boatId,
      reservation_date: date,
      status: ['Reserved', 'In Use'],
      [Sequelize.Op.or]: [
        {
          start_time: { [Sequelize.Op.lte]: endTime },
          end_time: { [Sequelize.Op.gte]: startTime }
        }
      ]
    }
  });
  
  // Filter out reservations from the same team (for modifications)
  const conflictingReservations = reservations.filter(r => 
    excludeTeamId ? r.team_id !== excludeTeamId : true
  );
  
  return conflictingReservations.length === 0;
}

// Create boat reservation
async function createBoatReservation(boatId, teamId, date, startTime, endTime, sessionId = null) {
  const isAvailable = await checkBoatAvailability(boatId, date, startTime, endTime);
  
  if (!isAvailable) {
    throw new Error('Boat is not available during the requested time');
  }
  
  return await BoatReservation.create({
    boat_id: boatId,
    team_id: teamId,
    reservation_date: date,
    start_time: startTime,
    end_time: endTime,
    session_id: sessionId,
    status: 'Reserved'
  });
}
```

## Key Benefits of Multi-Team Design

### **1. Shared Resources with Team Isolation**
- **Boats**: Shared across teams with reservation system
- **Athletes**: Can belong to multiple teams
- **Facilities**: Shared practice times and locations
- **Data**: Team-specific views with cross-team analytics

### **2. Flexible Team Management**
- **Dynamic Teams**: Athletes can move between teams
- **Multiple Roles**: Athletes can be athletes on one team, coaches on another
- **Team Evolution**: Teams can be created, modified, or retired
- **Cross-Team Events**: Support for inter-team competitions

### **3. Comprehensive Boat Management**
- **Reservation System**: Prevents double-booking across teams
- **Usage Tracking**: Monitor boat utilization by team
- **Maintenance Scheduling**: Coordinate maintenance across team schedules
- **Performance Analytics**: Compare boat usage patterns

### **4. Enhanced Analytics**
- **Team Performance**: Compare performance across teams
- **Resource Utilization**: Optimize boat and facility usage
- **Cross-Team Insights**: Identify trends across the boathouse
- **Capacity Planning**: Plan for growth and resource needs

## Multi-Role Management

### **Sequelize Implementation for Multi-Role Athletes**

```javascript
// Get all roles for a specific athlete
async function getAthleteRoles(athleteId) {
  return await TeamMembership.findAll({
    where: { 
      athlete_id: athleteId,
      active: true 
    },
    include: [
      { 
        model: Team,
        attributes: ['name', 'display_name', 'team_type']
      }
    ],
    order: [['role', 'ASC']]
  });
}

// Get all coaches across all teams
async function getAllCoaches() {
  return await TeamMembership.findAll({
    where: { 
      role: ['Coach', 'Assistant Coach'],
      active: true 
    },
    include: [
      { 
        model: Athlete,
        attributes: ['name', 'email', 'phone']
      },
      { 
        model: Team,
        attributes: ['name', 'display_name']
      }
    ]
  });
}

// Get athletes who are both athletes and coaches
async function getAthleteCoaches() {
  return await Athlete.findAll({
    include: [
      {
        model: TeamMembership,
        where: { 
          role: 'Athlete',
          active: true 
        },
        include: [{ model: Team }]
      },
      {
        model: TeamMembership,
        where: { 
          role: ['Coach', 'Assistant Coach'],
          active: true 
        },
        include: [{ model: Team }],
        required: true // INNER JOIN to ensure they have both roles
      }
    ]
  });
}

// Create multi-role membership
async function createMultiRoleMembership(athleteId, teamId, role) {
  // Check if athlete already has a role in this team
  const existingMembership = await TeamMembership.findOne({
    where: {
      athlete_id: athleteId,
      team_id: teamId,
      active: true
    }
  });
  
  if (existingMembership) {
    throw new Error('Athlete already has an active role in this team');
  }
  
  return await TeamMembership.create({
    athlete_id: athleteId,
    team_id: teamId,
    role: role,
    start_date: new Date()
  });
}
```

### **Role-Based Access Control**

```javascript
// Check if athlete has coaching privileges for a team
async function canCoachTeam(athleteId, teamId) {
  const membership = await TeamMembership.findOne({
    where: {
      athlete_id: athleteId,
      team_id: teamId,
      role: ['Coach', 'Assistant Coach'],
      active: true
    }
  });
  
  return !!membership;
}

// Get teams where athlete has specific role
async function getTeamsByRole(athleteId, role) {
  return await TeamMembership.findAll({
    where: {
      athlete_id: athleteId,
      role: role,
      active: true
    },
    include: [{ model: Team }]
  });
}

// Validate lineup creation permissions
async function canCreateLineup(athleteId, teamId) {
  const membership = await TeamMembership.findOne({
    where: {
      athlete_id: athleteId,
      team_id: teamId,
      role: ['Coach', 'Assistant Coach', 'Captain'],
      active: true
    }
  });
  
  return !!membership;
}
```

## Example Queries

### Get practice sessions for multi-role athlete:
```sql
-- Get all practice sessions for an athlete across all their teams
SELECT ps.session_id, ps.date, ps.start_time, ps.end_time, ps.session_name,
       t.name as team_name, t.display_name, tm.role as athlete_role,
       att.status as attendance_status
FROM practice_sessions ps
JOIN teams t ON ps.team_id = t.team_id
JOIN team_memberships tm ON t.team_id = tm.team_id
LEFT JOIN attendance att ON ps.session_id = att.session_id AND tm.athlete_id = att.athlete_id
WHERE tm.athlete_id = 'athlete-uuid-here'
  AND tm.active = true
  AND ps.date >= CURRENT_DATE
ORDER BY ps.date, ps.start_time, t.name;
```

### Get athlete's roles across all teams:
```sql
SELECT a.name as athlete_name, t.name as team_name, tm.role, tm.start_date
FROM athletes a
JOIN team_memberships tm ON a.athlete_id = tm.athlete_id
JOIN teams t ON tm.team_id = t.team_id
WHERE a.athlete_id = 'athlete-uuid-here'
  AND tm.active = true
ORDER BY t.name, tm.role;
```

### Get all coaches and their teams:
```sql
SELECT a.name as coach_name, t.name as team_name, tm.role,
       a.email, a.phone
FROM athletes a
JOIN team_memberships tm ON a.athlete_id = tm.athlete_id
JOIN teams t ON tm.team_id = t.team_id
WHERE tm.role IN ('Coach', 'Assistant Coach')
  AND tm.active = true
ORDER BY t.name, tm.role, a.name;
```

### Get athletes who are both athletes and coaches:
```sql
SELECT a.name as athlete_name,
       athlete_teams.team_name as athlete_team,
       coach_teams.team_name as coach_team,
       coach_teams.role as coaching_role
FROM athletes a
JOIN (
    SELECT tm.athlete_id, t.name as team_name
    FROM team_memberships tm
    JOIN teams t ON tm.team_id = t.team_id
    WHERE tm.role = 'Athlete' AND tm.active = true
) athlete_teams ON a.athlete_id = athlete_teams.athlete_id
JOIN (
    SELECT tm.athlete_id, t.name as team_name, tm.role
    FROM team_memberships tm
    JOIN teams t ON tm.team_id = t.team_id
    WHERE tm.role IN ('Coach', 'Assistant Coach') AND tm.active = true
) coach_teams ON a.athlete_id = coach_teams.athlete_id
ORDER BY a.name;
```

### Get team practice schedule:
```sql
SELECT ps.date, ps.start_time, ps.end_time, ps.session_name, ps.focus_area,
       COUNT(a.athlete_id) as attending_count
FROM practice_sessions ps
LEFT JOIN attendance a ON ps.session_id = a.session_id AND a.status = 'Yes'
WHERE ps.team_id = 'team-uuid-here'
  AND ps.date >= CURRENT_DATE
GROUP BY ps.session_id, ps.date, ps.start_time, ps.end_time, ps.session_name, ps.focus_area
ORDER BY ps.date, ps.start_time;
```

### Get boat availability for a team:
```sql
SELECT b.name, b.type, br.reservation_date, br.start_time, br.end_time,
       t.name as team_name, br.status
FROM boats b
LEFT JOIN boat_reservations br ON b.boat_id = br.boat_id
LEFT JOIN teams t ON br.team_id = t.team_id
WHERE br.reservation_date = '2025-01-15'
  AND br.status IN ('Reserved', 'In Use')
ORDER BY b.name, br.start_time;
```

### Get cross-team regatta participation:
```sql
SELECT t.name as team_name, r.name as regatta_name,
       COUNT(CASE WHEN rr.status = 'Committed' THEN 1 END) as committed_count,
       COUNT(CASE WHEN rr.coach_approved = true THEN 1 END) as approved_count
FROM teams t
JOIN regatta_registrations rr ON t.team_id = rr.team_id
JOIN regattas r ON rr.regatta_id = r.regatta_id
WHERE r.start_date >= CURRENT_DATE
GROUP BY t.team_id, t.name, r.regatta_id, r.name
ORDER BY t.name, r.start_date;
```

This multi-team design provides the flexibility to scale from a single team to a full boathouse while maintaining data isolation, shared resource management, and comprehensive analytics capabilities.
