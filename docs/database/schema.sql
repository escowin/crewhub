-- Multi-Team Boathouse Database Schema
-- This file contains the complete SQL table definitions for the boathouse ecosystem
-- See multi-team-database-schema.md for detailed documentation and business logic

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- USRA Categories Table
CREATE TABLE usra_categories (
    usra_category_id SERIAL PRIMARY KEY,
    
    -- Category Details
    start_age INTEGER NOT NULL,
    end_age INTEGER NOT NULL,
    category TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX idx_usra_categories_unique ON usra_categories(start_age, end_age, category);
CREATE INDEX idx_usra_categories_start_age ON usra_categories(start_age);
CREATE INDEX idx_usra_categories_end_age ON usra_categories(end_age);

-- Athletes Table
CREATE TABLE athletes (
    athlete_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Information
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    
    -- Rowing Profile
    type TEXT NOT NULL CHECK (type IN ('Cox', 'Rower', 'Rower & Coxswain')),
    gender CHAR(1) CHECK (gender IN ('M', 'F')),
    birth_year INTEGER,
    
    -- Rowing Skills & Preferences
    discipline TEXT CHECK (discipline IN ('Sweep', 'Scull', 'Sweep & Scull')),
    side TEXT CHECK (side IN ('Starboard', 'Prefer Starboard', 'Either', 'Prefer Port', 'Port')),
    bow_in_dark BOOLEAN,
    
    -- Physical Attributes
    weight_kg DECIMAL(5,2),
    height_cm INTEGER,
    
    -- Experience & Categories
    experience_years INTEGER,
    usra_age_category_id INTEGER REFERENCES usra_categories(usra_category_id),
    us_rowing_number TEXT,
    
    -- Emergency Contact
    emergency_contact TEXT,
    emergency_contact_phone TEXT,
    
    -- Status
    active BOOLEAN DEFAULT true,
    competitive_status TEXT DEFAULT 'active' CHECK (competitive_status IN ('active', 'inactive', 'retired', 'banned')),
    retirement_reason TEXT CHECK (retirement_reason IN ('deceased', 'transferred', 'graduated', 'personal', 'unknown')),
    retirement_date DATE,
    ban_reason TEXT CHECK (ban_reason IN ('misconduct', 'safety_violation', 'harassment', 'other')),
    ban_date DATE,
    ban_notes TEXT,
    
    -- PIN Authentication
    pin_hash VARCHAR(255),
    pin_salt VARCHAR(255),
    pin_created_at TIMESTAMP,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    pin_reset_required BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    etl_source TEXT DEFAULT 'google_sheets',
    etl_last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for athletes table
CREATE INDEX idx_athletes_name ON athletes(name);
CREATE INDEX idx_athletes_type ON athletes(type);
CREATE INDEX idx_athletes_active ON athletes(active);
CREATE INDEX idx_athletes_competitive_status ON athletes(competitive_status);
CREATE INDEX idx_athletes_weight ON athletes(weight_kg);
CREATE INDEX idx_athletes_last_login ON athletes(last_login);
CREATE INDEX idx_athletes_locked_until ON athletes(locked_until);
CREATE INDEX idx_athletes_pin_reset_required ON athletes(pin_reset_required);

-- Boats Table
CREATE TABLE boats (
    boat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Information
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('1x', '2x', '2-', '4x', '4+', '8+')),
    status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Reserved', 'In Use', 'Maintenance', 'Retired')),
    
    -- Physical Specifications
    description TEXT,
    min_weight_kg DECIMAL(5,2),
    max_weight_kg DECIMAL(5,2),
    rigging_type TEXT,
    
    -- Additional Details
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    etl_source TEXT DEFAULT 'google_sheets',
    etl_last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_boats_name ON boats(name);
CREATE INDEX idx_boats_type ON boats(type);
CREATE INDEX idx_boats_status ON boats(status);

-- Teams Table
CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    
    -- Team Information
    name TEXT NOT NULL,
    team_type TEXT,
    description TEXT,
    
    -- Team Management
    head_coach_id UUID REFERENCES athletes(athlete_id),
    assistant_coaches UUID[],
    mailing_list_id INTEGER REFERENCES mailing_lists(mailing_list_id),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_teams_name ON teams(name);
CREATE INDEX idx_teams_team_type ON teams(team_type);
CREATE INDEX idx_teams_mailing_list_id ON teams(mailing_list_id);

-- Team Memberships Table
CREATE TABLE team_memberships (
    membership_id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(team_id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES athletes(athlete_id) ON DELETE CASCADE,
    
    -- Membership Details
    role TEXT DEFAULT 'Athlete' CHECK (role IN ('Athlete', 'Captain', 'Coach', 'Assistant Coach', 'Secretary')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one membership per athlete per team
    UNIQUE(team_id, athlete_id)
);

-- Indexes
CREATE INDEX idx_team_memberships_team_id ON team_memberships(team_id);
CREATE INDEX idx_team_memberships_athlete_id ON team_memberships(athlete_id);
CREATE INDEX idx_team_memberships_role ON team_memberships(role);

-- Practice Sessions Table
CREATE TABLE practice_sessions (
    session_id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(team_id) ON DELETE CASCADE,
    
    -- Session Details
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    location TEXT,
    session_type TEXT NOT NULL DEFAULT 'Practice' CHECK (session_type IN ('Practice', 'Race', 'Erg Test', 'Meeting', 'Other')),
    
    -- Additional Information
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_practice_sessions_team_id ON practice_sessions(team_id);
CREATE INDEX idx_practice_sessions_date ON practice_sessions(date);
CREATE INDEX idx_practice_sessions_team_date ON practice_sessions(team_id, date);

-- Attendance Table
CREATE TABLE attendance (
    attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id INTEGER REFERENCES practice_sessions(session_id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES athletes(athlete_id) ON DELETE CASCADE,
    
    -- Attendance Status
    status TEXT CHECK (status IN ('Yes', 'No', 'Maybe', 'Late', 'Excused')),
    notes TEXT,
    
    -- Team Context (denormalized for performance)
    team_id INTEGER REFERENCES teams(team_id),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    etl_source TEXT DEFAULT 'google_sheets',
    etl_last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per athlete per session
    UNIQUE(session_id, athlete_id)
);

-- Indexes
CREATE INDEX idx_attendance_session_id ON attendance(session_id);
CREATE INDEX idx_attendance_athlete_id ON attendance(athlete_id);
CREATE INDEX idx_attendance_team_id ON attendance(team_id);
CREATE INDEX idx_attendance_status ON attendance(status);

-- Lineups Table
CREATE TABLE lineups (
    lineup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id INTEGER REFERENCES practice_sessions(session_id) ON DELETE CASCADE,
    boat_id UUID REFERENCES boats(boat_id) ON DELETE CASCADE,
    
    -- Team Context
    team_id INTEGER REFERENCES teams(team_id),
    
    -- Lineup Details
    lineup_name TEXT,
    lineup_type TEXT NOT NULL CHECK (lineup_type IN ('Practice', 'Race', 'Test')),
    
    -- Performance Metrics
    total_weight_kg DECIMAL(6,2),
    average_weight_kg DECIMAL(5,2),
    average_age DECIMAL(4,1),
    
    -- Additional Information
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    etl_source TEXT DEFAULT 'google_sheets',
    etl_last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_lineups_session_id ON lineups(session_id);
CREATE INDEX idx_lineups_boat_id ON lineups(boat_id);
CREATE INDEX idx_lineups_team_id ON lineups(team_id);

-- Seat Assignments Table
CREATE TABLE seat_assignments (
    seat_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lineup_id UUID REFERENCES lineups(lineup_id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES athletes(athlete_id) ON DELETE CASCADE,
    
    -- Seat Information
    seat_number INTEGER NOT NULL,
    side TEXT CHECK (side IN ('Port', 'Starboard')),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one athlete per seat per lineup
    UNIQUE(lineup_id, seat_number)
);

-- Indexes
CREATE INDEX idx_seat_assignments_lineup_id ON seat_assignments(lineup_id);
CREATE INDEX idx_seat_assignments_athlete_id ON seat_assignments(athlete_id);

-- ============================================================================
-- COMPETITIVE SYSTEM TABLES
-- ============================================================================

-- Regattas Table
CREATE TABLE regattas (
    regatta_id SERIAL PRIMARY KEY,
    
    -- Basic Information
    name TEXT NOT NULL,
    location TEXT,
    body_of_water TEXT,
    
    -- Dates
    start_date DATE,
    end_date DATE,
    registration_deadline DATE,
    
    -- Registration Management
    registration_open BOOLEAN DEFAULT true,
    registration_notes TEXT,
    
    -- Additional Details
    regatta_type TEXT CHECK (regatta_type IN ('Local', 'Regional', 'National', 'International', 'Scrimmage')),
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_regattas_name ON regattas(name);
CREATE INDEX idx_regattas_start_date ON regattas(start_date);
CREATE INDEX idx_regattas_registration_open ON regattas(registration_open);
CREATE INDEX idx_regattas_regatta_type ON regattas(regatta_type);

-- Regatta Registrations Table
CREATE TABLE regatta_registrations (
    registration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regatta_id INTEGER REFERENCES regattas(regatta_id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES athletes(athlete_id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(team_id),
    
    -- Registration Status
    status TEXT NOT NULL CHECK (status IN ('Interested', 'Committed', 'Declined', 'Waitlisted')),
    
    -- Athlete Preferences
    preferred_events TEXT[],
    availability_notes TEXT,
    
    -- Coach Management
    coach_notes TEXT,
    coach_approved BOOLEAN DEFAULT false,
    
    -- Registration Information
    registration_url TEXT,
    
    -- Registration Timeline
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    coach_reviewed_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one registration per athlete per regatta
    UNIQUE(regatta_id, athlete_id)
);

-- Indexes
CREATE INDEX idx_regatta_registrations_regatta_id ON regatta_registrations(regatta_id);
CREATE INDEX idx_regatta_registrations_athlete_id ON regatta_registrations(athlete_id);
CREATE INDEX idx_regatta_registrations_team_id ON regatta_registrations(team_id);
CREATE INDEX idx_regatta_registrations_status ON regatta_registrations(status);

-- Races Table
CREATE TABLE races (
    race_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regatta_id INTEGER REFERENCES regattas(regatta_id) ON DELETE CASCADE,
    lineup_id UUID REFERENCES lineups(lineup_id),
    
    -- Race Details
    event_name TEXT NOT NULL,
    race_date DATE,
    race_time TIME,
    distance_meters INTEGER DEFAULT 2000,
    
    -- Results
    result_time_seconds INTEGER,
    placement INTEGER,
    total_entries INTEGER,
    
    -- Additional Information
    lane_number INTEGER,
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_races_regatta_id ON races(regatta_id);
CREATE INDEX idx_races_lineup_id ON races(lineup_id);
CREATE INDEX idx_races_race_date ON races(race_date);

-- Erg Tests Table
CREATE TABLE erg_tests (
    test_id SERIAL PRIMARY KEY,
    athlete_id UUID REFERENCES athletes(athlete_id) ON DELETE CASCADE,
    
    -- Test Details
    test_date DATE NOT NULL,
    test_type TEXT NOT NULL CHECK (test_type IN ('2K', '5K', '1K', '6K', '10K', '30min', '1hour')),
    distance_meters INTEGER,
    time_seconds INTEGER,
    
    -- Performance Metrics
    split_seconds DECIMAL(5,2),
    watts DECIMAL(6,2),
    calories INTEGER,
    
    -- Additional Information
    notes TEXT,
    test_conditions TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_erg_tests_athlete_id ON erg_tests(athlete_id);
CREATE INDEX idx_erg_tests_test_date ON erg_tests(test_date);
CREATE INDEX idx_erg_tests_test_type ON erg_tests(test_type);

-- ============================================================================
-- GAUNTLET & LADDER SYSTEM TABLES
-- ============================================================================

-- Gauntlets Table
CREATE TABLE gauntlets (
    gauntlet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Gauntlet Details
    name TEXT NOT NULL,
    description TEXT,
    boat_type TEXT NOT NULL CHECK (boat_type IN ('1x', '2x', '2-', '4x', '4+', '8+')),
    created_by UUID NOT NULL REFERENCES athletes(athlete_id),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'completed', 'cancelled')),
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_gauntlets_created_by ON gauntlets(created_by);
CREATE INDEX idx_gauntlets_status ON gauntlets(status);
CREATE INDEX idx_gauntlets_boat_type ON gauntlets(boat_type);

-- Gauntlet Matches Table
CREATE TABLE gauntlet_matches (
    match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gauntlet_id UUID REFERENCES gauntlets(gauntlet_id) ON DELETE CASCADE,
    user_lineup_id UUID NOT NULL REFERENCES gauntlet_lineups(gauntlet_lineup_id) ON DELETE CASCADE,
    challenger_lineup_id UUID NOT NULL REFERENCES gauntlet_lineups(gauntlet_lineup_id) ON DELETE CASCADE,
    
    -- Match Details
    workout TEXT NOT NULL,
    sets INTEGER NOT NULL,
    user_wins INTEGER NOT NULL DEFAULT 0,
    user_losses INTEGER NOT NULL DEFAULT 0,
    match_date DATE NOT NULL,
    
    -- Additional Information
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_gauntlet_matches_gauntlet_id ON gauntlet_matches(gauntlet_id);
CREATE INDEX idx_gauntlet_matches_user_lineup_id ON gauntlet_matches(user_lineup_id);
CREATE INDEX idx_gauntlet_matches_challenger_lineup_id ON gauntlet_matches(challenger_lineup_id);
CREATE INDEX idx_gauntlet_matches_match_date ON gauntlet_matches(match_date);

-- Gauntlet Lineups Table
CREATE TABLE gauntlet_lineups (
    gauntlet_lineup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gauntlet_id UUID REFERENCES gauntlets(gauntlet_id) ON DELETE CASCADE,
    match_id UUID REFERENCES gauntlet_matches(match_id) ON DELETE SET NULL,
    boat_id UUID REFERENCES boats(boat_id),
    is_user_lineup BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_gauntlet_lineups_gauntlet_id ON gauntlet_lineups(gauntlet_id);
CREATE INDEX idx_gauntlet_lineups_match_id ON gauntlet_lineups(match_id);
CREATE INDEX idx_gauntlet_lineups_boat_id ON gauntlet_lineups(boat_id);
CREATE INDEX idx_gauntlet_lineups_is_user_lineup ON gauntlet_lineups(is_user_lineup);

-- Gauntlet Seat Assignments Table
CREATE TABLE gauntlet_seat_assignments (
    gauntlet_seat_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gauntlet_lineup_id UUID REFERENCES gauntlet_lineups(gauntlet_lineup_id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES athletes(athlete_id) ON DELETE CASCADE,
    seat_number INTEGER NOT NULL CHECK (seat_number >= 1 AND seat_number <= 8),
    side TEXT NOT NULL CHECK (side IN ('port', 'starboard', 'scull')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one athlete per seat per lineup
    UNIQUE(gauntlet_lineup_id, seat_number)
);

-- Indexes
CREATE INDEX idx_gauntlet_seat_assignments_lineup_id ON gauntlet_seat_assignments(gauntlet_lineup_id);
CREATE INDEX idx_gauntlet_seat_assignments_athlete_id ON gauntlet_seat_assignments(athlete_id);
CREATE INDEX idx_gauntlet_seat_assignments_seat_number ON gauntlet_seat_assignments(seat_number);

-- Gauntlet Positions Table
CREATE TABLE gauntlet_positions (
    position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gauntlet_id UUID NOT NULL REFERENCES gauntlets(gauntlet_id) ON DELETE CASCADE,
    gauntlet_lineup_id UUID NOT NULL REFERENCES gauntlet_lineups(gauntlet_lineup_id) ON DELETE CASCADE,
    
    -- Position Details
    position INTEGER NOT NULL,
    previous_position INTEGER,
    
    -- Statistics
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    total_matches INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    
    -- Streak Information
    streak_type TEXT CHECK (streak_type IN ('win', 'loss', 'draw', 'none')),
    streak_count INTEGER DEFAULT 0,
    
    -- Dates
    last_match_date DATE,
    joined_date DATE DEFAULT CURRENT_DATE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one position per lineup per gauntlet
    UNIQUE(gauntlet_id, gauntlet_lineup_id)
);

-- Indexes
CREATE INDEX idx_gauntlet_positions_gauntlet_id ON gauntlet_positions(gauntlet_id);
CREATE INDEX idx_gauntlet_positions_gauntlet_lineup_id ON gauntlet_positions(gauntlet_lineup_id);
CREATE INDEX idx_gauntlet_positions_position ON gauntlet_positions(position);

-- ============================================================================
-- UTILITY TABLES
-- ============================================================================

-- Mailing Lists Table
CREATE TABLE mailing_lists (
    mailing_list_id SERIAL PRIMARY KEY,
    
    -- Mailing List Details
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    description TEXT,
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX idx_mailing_lists_email ON mailing_lists(email);
CREATE INDEX idx_mailing_lists_name ON mailing_lists(name);
CREATE INDEX idx_mailing_lists_active ON mailing_lists(active);

-- ETL Jobs Tracking Table
CREATE TABLE etl_jobs (
    job_id SERIAL PRIMARY KEY,
    
    -- Job Details
    job_type TEXT NOT NULL CHECK (job_type IN ('full_etl', 'incremental_etl', 'athletes_sync', 'boats_sync', 'attendance_sync')),
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    
    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    
    -- Statistics
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    
    -- Error Handling
    error_message TEXT,
    error_details JSONB,
    
    -- Additional Information
    metadata JSONB,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_etl_jobs_status ON etl_jobs(status);
CREATE INDEX idx_etl_jobs_started_at ON etl_jobs(started_at);
CREATE INDEX idx_etl_jobs_job_type ON etl_jobs(job_type);

-- Boat Reservations Table
CREATE TABLE boat_reservations (
    reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    boat_id UUID REFERENCES boats(boat_id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(team_id) ON DELETE CASCADE,
    
    -- Reservation Details
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Reservation Context
    session_id INTEGER REFERENCES practice_sessions(session_id),
    lineup_id UUID REFERENCES lineups(lineup_id),
    
    -- Reservation Status
    status TEXT DEFAULT 'Reserved' CHECK (status IN ('Reserved', 'In Use', 'Completed', 'Cancelled')),
    
    -- Additional Information
    notes TEXT,
    reserved_by UUID REFERENCES athletes(athlete_id),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_boat_reservations_boat_id ON boat_reservations(boat_id);
CREATE INDEX idx_boat_reservations_team_id ON boat_reservations(team_id);
CREATE INDEX idx_boat_reservations_date ON boat_reservations(reservation_date);
CREATE INDEX idx_boat_reservations_boat_date ON boat_reservations(boat_id, reservation_date);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert USRA Categories
INSERT INTO usra_categories (start_age, end_age, category) VALUES
(15, 15, 'U15'),
(16, 17, 'U17'),
(18, 19, 'U19'),
(20, 23, 'U23'),
(24, 26, 'AA'),
(27, 29, 'A'),
(30, 34, 'B'),
(35, 39, 'C'),
(40, 44, 'D'),
(45, 49, 'E'),
(50, 54, 'F'),
(55, 59, 'G'),
(60, 64, 'H'),
(65, 69, 'I'),
(70, 74, 'J'),
(75, 99, 'K');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE athletes IS 'Core athlete information with PIN authentication system';
COMMENT ON TABLE boats IS 'Boat inventory with standardized type notation';
COMMENT ON TABLE teams IS 'Team definitions and compositions';
COMMENT ON TABLE team_memberships IS 'Athlete-team relationships with roles';
COMMENT ON TABLE practice_sessions IS 'Practice session scheduling by team';
COMMENT ON TABLE attendance IS 'Practice attendance tracking';
COMMENT ON TABLE lineups IS 'Practice lineup management';
COMMENT ON TABLE seat_assignments IS 'Detailed seat assignments within lineups';
COMMENT ON TABLE regattas IS 'Competition and regatta management';
COMMENT ON TABLE regatta_registrations IS 'Athlete regatta participation';
COMMENT ON TABLE races IS 'Individual race events within regattas';
COMMENT ON TABLE erg_tests IS 'Performance test tracking';
COMMENT ON TABLE usra_categories IS 'Age category classifications';
COMMENT ON TABLE mailing_lists IS 'Team communication management';
COMMENT ON TABLE gauntlets IS 'Gauntlet tournament system';
COMMENT ON TABLE gauntlet_matches IS 'Individual gauntlet matches';
COMMENT ON TABLE gauntlet_lineups IS 'Gauntlet lineup configurations';
COMMENT ON TABLE gauntlet_seat_assignments IS 'Seat assignments for gauntlet lineups';
COMMENT ON TABLE gauntlet_positions IS 'Lineup positions in gauntlets (references gauntlet_id directly, tracks position history via previous_position and position fields)';
COMMENT ON TABLE etl_jobs IS 'ETL job tracking and monitoring';
COMMENT ON TABLE boat_reservations IS 'Boat usage scheduling across teams';
