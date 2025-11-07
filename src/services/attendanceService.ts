import { Attendance, PracticeSession, TeamMembership } from '../models';
import sequelize from '../config/database';
import { Op } from 'sequelize';

export interface AttendanceSubmissionData {
  session_id: number;
  athlete_id: string;
  status: 'Yes' | 'No' ;
  notes?: string;
  team_id: number;
  client_id?: string; // Optional client-generated UUID for offline sync
  timestamp?: number; // Client timestamp for conflict resolution
}

export interface AttendanceConflictResolution {
  strategy: 'client_wins' | 'server_wins' | 'latest_wins' | 'merge_notes';
  clientData: AttendanceSubmissionData;
  serverData: Attendance;
}

export class AttendanceService {
  /**
   * Create or update attendance with enhanced conflict resolution
   * This method handles concurrent submissions and offline sync scenarios
   */
  async upsertAttendance(
    data: AttendanceSubmissionData,
    conflictResolution: AttendanceConflictResolution['strategy'] = 'latest_wins'
  ): Promise<{ success: boolean; data?: Attendance; conflict?: AttendanceConflictResolution; error?: string }> {
    const transaction = await sequelize.transaction();
    
    try {
      // First, check if attendance record already exists
      const existingRecord = await Attendance.findOne({
        where: {
          session_id: data.session_id,
          athlete_id: data.athlete_id
        },
        transaction
      });

      let attendanceRecord: Attendance;

      if (existingRecord) {
        // Handle conflict resolution
        const conflict = await this.resolveConflict(
          data,
          existingRecord,
          conflictResolution
        );

        if (conflict) {
          await transaction.rollback();
          return {
            success: false,
            conflict,
            error: 'Conflict detected - manual resolution required'
          };
        }

        // Update existing record
        const updateData: any = {
          status: data.status,
          etl_source: 'api',
          etl_last_sync: new Date()
        };
        
        if (data.notes !== undefined) {
          updateData.notes = data.notes;
        }
        
        attendanceRecord = await existingRecord.update(updateData, { transaction });

      } else {
        // Create new record with UUID
        const createData: any = {
          session_id: data.session_id,
          athlete_id: data.athlete_id,
          status: data.status,
          team_id: data.team_id,
          etl_source: 'api',
          etl_last_sync: new Date()
        };
        
        if (data.client_id !== undefined) {
          createData.attendance_id = data.client_id;
        }
        
        if (data.notes !== undefined) {
          createData.notes = data.notes;
        }
        
        attendanceRecord = await Attendance.create(createData, { transaction });
      }

      await transaction.commit();
      return {
        success: true,
        data: attendanceRecord
      };

    } catch (error: any) {
      await transaction.rollback();
      console.error('Error in upsertAttendance:', error);
      
      // Handle specific database errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        return {
          success: false,
          error: 'Duplicate attendance record detected'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to save attendance'
      };
    }
  }

  /**
   * Resolve conflicts between client and server data
   */
  private async resolveConflict(
    clientData: AttendanceSubmissionData,
    serverData: Attendance,
    strategy: AttendanceConflictResolution['strategy']
  ): Promise<AttendanceConflictResolution | null> {
    // Check if there's actually a conflict
    const hasConflict = (
      clientData.status !== serverData.status ||
      clientData.notes !== serverData.notes
    );

    if (!hasConflict) {
      return null; // No conflict, proceed with update
    }

    // Create conflict object
    const conflict: AttendanceConflictResolution = {
      strategy,
      clientData,
      serverData
    };

    // Apply conflict resolution strategy
    switch (strategy) {
      case 'client_wins':
        // Client data takes precedence - no conflict to resolve
        return null;

      case 'server_wins':
        // Server data takes precedence - no update needed
        return null;

      case 'latest_wins':
        // Compare timestamps if available
        if (clientData.timestamp && serverData.updated_at) {
          const clientTime = new Date(clientData.timestamp);
          const serverTime = new Date(serverData.updated_at);
          
          if (clientTime > serverTime) {
            // Client is newer, proceed with update
            return null;
          } else {
            // Server is newer, no update needed
            return null;
          }
        }
        // If no timestamps, treat as conflict
        return conflict;

      case 'merge_notes':
        // Merge notes from both client and server
        const mergedNotes = this.mergeNotes(clientData.notes, serverData.notes);
        clientData.notes = mergedNotes;
        // Proceed with client status but merged notes
        return null;

      default:
        return conflict;
    }
  }

  /**
   * Merge notes from client and server
   */
  private mergeNotes(clientNotes?: string, serverNotes?: string): string {
    if (!clientNotes && !serverNotes) return '';
    if (!clientNotes) return serverNotes || '';
    if (!serverNotes) return clientNotes;
    
    // Combine notes, avoiding duplicates
    const clientLines = clientNotes.split('\n').filter(line => line.trim());
    const serverLines = serverNotes.split('\n').filter(line => line.trim());
    
    const allLines = [...new Set([...clientLines, ...serverLines])];
    return allLines.join('\n');
  }

  /**
   * Batch upsert multiple attendance records
   * Useful for offline sync scenarios
   */
  async batchUpsertAttendance(
    records: AttendanceSubmissionData[],
    conflictResolution: AttendanceConflictResolution['strategy'] = 'latest_wins'
  ): Promise<{ success: boolean; data?: Attendance[]; conflicts?: AttendanceConflictResolution[]; error?: string }> {
    const transaction = await sequelize.transaction();
    const results: Attendance[] = [];
    const conflicts: AttendanceConflictResolution[] = [];

    try {
      for (const record of records) {
        const result = await this.upsertAttendance(record, conflictResolution);
        
        if (result.success && result.data) {
          results.push(result.data);
        } else if (result.conflict) {
          conflicts.push(result.conflict);
        }
      }

      if (conflicts.length > 0) {
        await transaction.rollback();
        return {
          success: false,
          conflicts,
          error: `${conflicts.length} conflicts detected`
        };
      }

      await transaction.commit();
      return {
        success: true,
        data: results
      };

    } catch (error: any) {
      await transaction.rollback();
      console.error('Error in batchUpsertAttendance:', error);
      return {
        success: false,
        error: error.message || 'Failed to batch upsert attendance'
      };
    }
  }

  /**
   * Get attendance with conflict detection
   * Useful for checking if local changes conflict with server state
   */
  async getAttendanceWithConflictDetection(
    sessionId: number,
    athleteId: string,
    clientData?: AttendanceSubmissionData
  ): Promise<{ data?: Attendance; hasConflict?: boolean; conflict?: AttendanceConflictResolution }> {
    try {
      const serverData = await Attendance.findOne({
        where: {
          session_id: sessionId,
          athlete_id: athleteId
        }
      });

      if (!serverData) {
        return {};
      }

      if (clientData) {
        const hasConflict = (
          clientData.status !== serverData.status ||
          clientData.notes !== serverData.notes
        );

        if (hasConflict) {
          const conflict: AttendanceConflictResolution = {
            strategy: 'latest_wins',
            clientData,
            serverData
          };
          return { data: serverData, hasConflict: true, conflict };
        }
      }

      return { data: serverData };

    } catch (error: any) {
      console.error('Error in getAttendanceWithConflictDetection:', error);
      return {};
    }
  }

  /**
   * Validate attendance data before submission
   */
  validateAttendanceData(data: AttendanceSubmissionData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.session_id || data.session_id <= 0) {
      errors.push('Invalid session_id');
    }

    if (!data.athlete_id || typeof data.athlete_id !== 'string') {
      errors.push('Invalid athlete_id');
    }

    if (!data.team_id || data.team_id <= 0) {
      errors.push('Invalid team_id');
    }

    const validStatuses = ['Yes', 'No'];
    if (!validStatuses.includes(data.status)) {
      errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get upcoming attendance records for an athlete
   * Returns attendance records for upcoming practice sessions
   * Matches SQL: SELECT a.* FROM attendance a LEFT JOIN practice_sessions p ON a.session_id = p.session_id WHERE athlete_id = ? AND p.date >= CURRENT_DATE
   */
  async getUpcomingAttendanceForAthlete(athleteId: string, daysAhead: number = 30): Promise<Attendance[]> {
    try {
      // Calculate date range for upcoming sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);

      // Get all attendance records for this athlete with upcoming sessions
      // Don't filter by team membership - return all attendance for the athlete
      const attendanceRecords = await Attendance.findAll({
        where: {
          athlete_id: athleteId
        },
        include: [{
          model: PracticeSession,
          as: 'session',
          attributes: [
            'session_id',
            'team_id',
            'date',
            'start_time',
            'end_time',
            'session_type',
            'notes'
          ],
          required: true, // INNER JOIN to ensure session exists
          where: {
            date: {
              [Op.gte]: today,
              [Op.lte]: futureDate
            }
          }
        }],
        attributes: [
          'attendance_id',
          'session_id',
          'athlete_id',
          'status',
          'notes',
          'team_id',
          'created_at',
          'updated_at'
        ]
      });

      return attendanceRecords;
    } catch (error) {
      console.error('AttendanceService: Error fetching upcoming attendance for athlete:', error);
      throw error;
    }
  }

  /**
   * Get attendance records for a specific team's practice sessions
   */
  async getTeamAttendanceRecords(
    teamId: number, 
    options: {
      startDate?: Date;
      endDate?: Date;
      athleteId?: string;
      status?: string;
    } = {}
  ): Promise<Attendance[]> {
    try {
      const { startDate, endDate, athleteId, status } = options;

      const whereClause: any = {
        team_id: teamId
      };

      // Filter by athlete if specified
      if (athleteId) {
        whereClause.athlete_id = athleteId;
      }

      // Filter by status if specified
      if (status) {
        whereClause.status = status;
      }

      // Filter by date range through session
      if (startDate || endDate) {
        whereClause['$session.date$'] = {};
        if (startDate) whereClause['$session.date$'][Op.gte] = startDate;
        if (endDate) whereClause['$session.date$'][Op.lte] = endDate;
      }

      const attendanceRecords = await Attendance.findAll({
        where: whereClause,
        include: [{
          model: PracticeSession,
          as: 'session',
          attributes: [
            'session_id',
            'team_id',
            'date',
            'start_time',
            'end_time',
            'session_type',
            'notes'
          ]
        }],
        order: [['$session.date$', 'ASC'], ['$session.start_time$', 'ASC']],
        attributes: [
          'attendance_id',
          'session_id',
          'athlete_id',
          'status',
          'notes',
          'team_id',
          'created_at',
          'updated_at'
        ]
      });

      return attendanceRecords;
    } catch (error) {
      console.error('AttendanceService: Error fetching team attendance records:', error);
      throw error;
    }
  }

  /**
   * Get attendance statistics for an athlete
   */
  async getAthleteAttendanceStats(
    athleteId: string, 
    options: {
      startDate?: Date;
      endDate?: Date;
      teamId?: number;
    } = {}
  ): Promise<{
    totalSessions: number;
    statusCounts: Record<string, number>;
    attendanceRate: number;
    records: Attendance[];
  }> {
    try {
      const { startDate, endDate, teamId } = options;

      const whereClause: any = {
        athlete_id: athleteId
      };

      // Filter by team if specified
      if (teamId) {
        whereClause.team_id = teamId;
      }

      // Filter by date range through session
      if (startDate || endDate) {
        whereClause['$session.date$'] = {};
        if (startDate) whereClause['$session.date$'][Op.gte] = startDate;
        if (endDate) whereClause['$session.date$'][Op.lte] = endDate;
      }

      const attendanceRecords = await Attendance.findAll({
        where: whereClause,
        include: [{
          model: PracticeSession,
          as: 'session',
          attributes: ['date']
        }],
        attributes: ['status'],
        order: [['$session.date$', 'DESC']]
      });

      // Calculate statistics
      const totalSessions = attendanceRecords.length;
      const statusCounts = attendanceRecords.reduce((acc, record) => {
        const status = record.status || 'Not Marked';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const attendanceRate = totalSessions > 0 
        ? ((statusCounts['Yes'] || 0) / totalSessions * 100)
        : 0;

      return {
        totalSessions,
        statusCounts,
        attendanceRate: Math.round(attendanceRate * 10) / 10, // Round to 1 decimal
        records: attendanceRecords
      };
    } catch (error) {
      console.error('AttendanceService: Error fetching athlete attendance stats:', error);
      throw error;
    }
  }

  /**
   * Check if athlete can mark attendance for a session (is member of the team)
   */
  async canAthleteMarkAttendance(athleteId: string, sessionId: number): Promise<boolean> {
    try {
      const session = await PracticeSession.findByPk(sessionId, {
        attributes: ['team_id']
      });

      if (!session) {
        return false;
      }

      const membership = await TeamMembership.findOne({
        where: {
          athlete_id: athleteId,
          team_id: session.team_id,
          left_at: null as any // Type assertion to bypass strict typing
        }
      });

      return membership !== null;
    } catch (error) {
      console.error('AttendanceService: Error checking attendance permission:', error);
      return false;
    }
  }

  /**
   * Get attendance records for a specific practice session
   */
  async getSessionAttendance(sessionId: number): Promise<Attendance[]> {
    try {
      const attendanceRecords = await Attendance.findAll({
        where: {
          session_id: sessionId
        },
        include: [{
          model: PracticeSession,
          as: 'session',
          attributes: [
            'session_id',
            'team_id',
            'date',
            'start_time',
            'end_time',
            'session_type',
            'notes'
          ]
        }],
        order: [['created_at', 'ASC']],
        attributes: [
          'attendance_id',
          'session_id',
          'athlete_id',
          'status',
          'notes',
          'team_id',
          'created_at',
          'updated_at'
        ]
      });

      return attendanceRecords;
    } catch (error) {
      console.error('AttendanceService: Error fetching session attendance:', error);
      throw error;
    }
  }
}

export const attendanceService = new AttendanceService();
