import { Lineup, SeatAssignment, PracticeSession, Athlete, Boat, Attendance } from '../models';
import { Op } from 'sequelize';
import sequelize from '../config/database';

export interface LineupData {
  lineup_id: string;
  session_id: number;
  boat_id: string;
  team_id: number;
  lineup_name?: string;
  lineup_type: 'Practice' | 'Race' | 'Test';
  total_weight_kg?: number;
  average_weight_kg?: number;
  average_age?: number;
  notes?: string;
  seat_assignments: SeatAssignmentData[];
  created_at: Date;
  updated_at: Date;
}

export interface SeatAssignmentData {
  seat_assignment_id: string;
  lineup_id: string;
  athlete_id: string;
  seat_number: number;
  side?: 'Port' | 'Starboard';
  athlete_name?: string;
  athlete_weight?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLineupRequest {
  lineup_id?: string; // Optional: client-generated UUID (local-first approach)
  session_id: number;
  boat_id: string;
  boat_type: '1x' | '2x' | '2-' | '4x' | '4+' | '8+'; // Required: boat type from client
  team_id: number;
  lineup_name?: string;
  lineup_type: 'Practice' | 'Race' | 'Test';
  notes?: string;
  seat_assignments: {
    seat_assignment_id?: string; // Optional: client-generated UUID (local-first approach)
    athlete_id: string;
    seat_number: number;
    side?: 'Port' | 'Starboard'; // Client sends title case, no normalization needed
  }[];
  created_at?: Date; // Optional: client-generated timestamp
  updated_at?: Date; // Optional: client-generated timestamp
}

export interface UpdateLineupRequest {
  lineup_name?: string;
  notes?: string;
  seat_assignments?: {
    athlete_id: string;
    seat_number: number;
    side?: 'Port' | 'Starboard';
  }[];
}

export class LineupService {
  /**
   * Get all lineups for a specific practice session
   */
  async getLineupsForSession(sessionId: number, teamId?: number): Promise<LineupData[]> {
    try {
      const whereClause: any = { session_id: sessionId };
      if (teamId) {
        whereClause.team_id = teamId;
      }

      const lineups = await Lineup.findAll({
        where: whereClause,
        include: [
          {
            model: SeatAssignment,
            as: 'seat_assignments',
            required: false, // LEFT JOIN - include lineups even without seat assignments
            include: [
              {
                model: Athlete,
                as: 'athlete',
                attributes: ['athlete_id', 'name', 'weight_kg'],
                required: false // LEFT JOIN - include seat assignments even without athlete
              }
            ]
          },
          {
            model: Boat,
            as: 'boat',
            attributes: ['boat_id', 'name', 'type', 'status'],
            required: false // LEFT JOIN - include lineups even without boat
          }
        ],
        order: [['created_at', 'ASC']]
      });

      // Convert Sequelize instances to plain objects before formatting
      const plainLineups = lineups.map(lineup => {
        const plainLineup = lineup.toJSON ? lineup.toJSON() : lineup.get({ plain: true });
        return plainLineup;
      });

      return plainLineups.map(lineup => this.formatLineupData(lineup));
    } catch (error) {
      console.error('Error fetching lineups for session:', error);
      throw new Error('Failed to fetch lineups for session');
    }
  }

  /**
   * Get lineups created by a specific athlete for sessions they're attending
   */
  async getLineupsByAthlete(athleteId: string, teamId?: number): Promise<LineupData[]> {
    try {
      const whereClause: any = {};
      if (teamId) {
        whereClause.team_id = teamId;
      }

      // Find lineups where the athlete has a seat assignment
      const lineups = await Lineup.findAll({
        where: whereClause,
        include: [
          {
            model: SeatAssignment,
            as: 'seat_assignments',
            where: { athlete_id: athleteId },
            include: [
              {
                model: Athlete,
                as: 'athlete',
                attributes: ['athlete_id', 'first_name', 'last_name', 'weight_kg']
              }
            ]
          },
          {
            model: Boat,
            as: 'boat',
            attributes: ['boat_id', 'name', 'type', 'status']
          },
          {
            model: PracticeSession,
            as: 'practiceSession',
            attributes: ['session_id', 'date', 'start_time', 'session_type', 'location']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return lineups.map(lineup => this.formatLineupData(lineup));
    } catch (error) {
      console.error('Error fetching lineups by athlete:', error);
      throw new Error('Failed to fetch lineups by athlete');
    }
  }

  /**
   * Get a specific lineup by ID
   */
  async getLineupById(lineupId: string): Promise<LineupData | null> {
    try {
      const lineup = await Lineup.findByPk(lineupId, {
        include: [
          {
            model: SeatAssignment,
            as: 'seat_assignments',
            include: [
              {
                model: Athlete,
                as: 'athlete',
                attributes: ['athlete_id', 'name', 'weight_kg']
              }
            ]
          },
          {
            model: Boat,
            as: 'boat',
            attributes: ['boat_id', 'name', 'type', 'status']
          }
        ]
      });

      return lineup ? this.formatLineupData(lineup) : null;
    } catch (error) {
      console.error('Error fetching lineup by ID:', error);
      throw new Error('Failed to fetch lineup');
    }
  }

  /**
   * Create a new lineup
   */
  async createLineup(lineupData: CreateLineupRequest): Promise<LineupData> {
    // Use Sequelize transaction to ensure atomicity
    const transaction = await sequelize.transaction();
    
    try {
      // Validate that the practice session exists and is for the correct team
      const session = await PracticeSession.findOne({
        where: {
          session_id: lineupData.session_id,
          team_id: lineupData.team_id
        },
        transaction
      });

      if (!session) {
        throw new Error('Practice session not found or access denied');
      }

      // Validate boat exists
      const boat = await Boat.findByPk(lineupData.boat_id, { transaction });
      if (!boat) {
        throw new Error('Boat not found');
      }

      // Use boat_type from client request (more reliable than fetching from database)
      // Validate boat_type is provided
      if (!lineupData.boat_type) {
        throw new Error('boat_type is required');
      }

      // Normalize boat type (trim whitespace, handle potential variations)
      const boatType = (lineupData.boat_type || '').trim();
      
      // Get seat count from boat type (corrected for 4+ and 8+)
      const getSeatCount = (type: string): number => {
        switch (type) {
          case '1x': return 1;
          case '2x': 
          case '2-': return 2;
          case '4x': return 4;
          case '4+': return 5;  // 4 rowers + 1 coxswain
          case '8+': return 9;  // 8 rowers + 1 coxswain
          default: return 0;
        }
      };

      const seatCount = getSeatCount(boatType);
      
      if (seatCount === 0) {
        throw new Error(`Invalid or unrecognized boat type: "${lineupData.boat_type}". Expected one of: 1x, 2x, 2-, 4x, 4+, 8+`);
      }
      
      if (lineupData.seat_assignments.length !== seatCount) {
        throw new Error(`Boat requires exactly ${seatCount} seat assignments, but ${lineupData.seat_assignments.length} provided`);
      }

      // Validate all athletes exist
      const athleteIds = lineupData.seat_assignments.map(sa => sa.athlete_id);
      const athletes = await Athlete.findAll({
        where: { athlete_id: { [Op.in]: athleteIds } },
        transaction
      });

      if (athletes.length !== athleteIds.length) {
        throw new Error('One or more athletes not found');
      }

      // Validate no duplicate athletes
      const uniqueAthleteIds = new Set(athleteIds);
      if (uniqueAthleteIds.size !== athleteIds.length) {
        throw new Error('Each athlete can only be assigned to one seat');
      }

      // Validate no duplicate seat numbers
      const seatNumbers = lineupData.seat_assignments.map(sa => sa.seat_number);
      const uniqueSeatNumbers = new Set(seatNumbers);
      if (uniqueSeatNumbers.size !== seatNumbers.length) {
        throw new Error('Each seat number can only be assigned once');
      }

      // Validate all athletes have attendance.status = 'Yes' for the session
      const attendanceRecords = await Attendance.findAll({
        where: {
          session_id: lineupData.session_id,
          athlete_id: { [Op.in]: athleteIds },
          status: 'Yes'
        },
        transaction
      });

      if (attendanceRecords.length !== athleteIds.length) {
        throw new Error(`One or more athletes do not have attendance status 'Yes' for this session`);
      }

      // Validate seat numbers are within valid range
      const invalidSeats = seatNumbers.filter(seatNum => seatNum < 1 || seatNum > seatCount);
      if (invalidSeats.length > 0) {
        throw new Error(`Invalid seat numbers: ${invalidSeats.join(', ')}. Valid range is 1-${seatCount}`);
      }

      // Create the lineup
      // Use client-generated UUID if provided (local-first approach), otherwise let database/Sequelize generate it
      const lineupDataToCreate: any = {
        session_id: lineupData.session_id,
        boat_id: lineupData.boat_id,
        team_id: lineupData.team_id,
        lineup_type: lineupData.lineup_type
      };

      // Use client-generated UUID if provided
      if (lineupData.lineup_id) {
        lineupDataToCreate.lineup_id = lineupData.lineup_id;
      }

      if (lineupData.lineup_name) {
        lineupDataToCreate.lineup_name = lineupData.lineup_name;
      }
      if (lineupData.notes) {
        lineupDataToCreate.notes = lineupData.notes;
      }

      // Use client-generated timestamps if provided, otherwise let Sequelize handle them
      if (lineupData.created_at) {
        lineupDataToCreate.created_at = lineupData.created_at;
      }
      if (lineupData.updated_at) {
        lineupDataToCreate.updated_at = lineupData.updated_at;
      }

      const lineup = await Lineup.create(lineupDataToCreate, { transaction });

      // Get the lineup_id - use the client-provided UUID (more reliable than accessing from model)
      // If client didn't provide it, use the one from the created lineup object
      const finalLineupId = lineupData.lineup_id || lineup.getDataValue('lineup_id');

      // Create all seat assignments within transaction
      // Use client-generated UUIDs if provided (local-first approach), otherwise let database/Sequelize generate them
      await Promise.all(
        lineupData.seat_assignments.map(assignment => {
          const seatData: any = {
            lineup_id: finalLineupId, // Use the same UUID as the lineup
            athlete_id: assignment.athlete_id,
            seat_number: assignment.seat_number
          };

          // Use client-generated UUID if provided
          if (assignment.seat_assignment_id) {
            seatData.seat_assignment_id = assignment.seat_assignment_id;
          }

          // Side values are already in correct format ('Port' | 'Starboard') from client - no normalization needed
          if (assignment.side && (assignment.side === 'Port' || assignment.side === 'Starboard')) {
            seatData.side = assignment.side;
          }

          // Use client-generated timestamps if provided, otherwise let Sequelize handle them
          if (lineupData.created_at) {
            seatData.created_at = lineupData.created_at;
          }
          if (lineupData.updated_at) {
            seatData.updated_at = lineupData.updated_at;
          }

          return SeatAssignment.create(seatData, { transaction });
        })
      );

      // Calculate aggregate statistics
      const totalWeight = athletes.reduce((sum, athlete) => sum + (athlete.weight_kg || 0), 0);
      const athletesWithWeight = athletes.filter(a => a.weight_kg != null);
      const averageWeight = athletesWithWeight.length > 0 
        ? totalWeight / athletesWithWeight.length 
        : 0;

      const athletesWithBirthYear = athletes.filter(a => a.birth_year != null);
      const averageAge = athletesWithBirthYear.length > 0
        ? athletesWithBirthYear.reduce((sum, athlete) => {
            const age = new Date().getFullYear() - (athlete.birth_year || 0);
            return sum + age;
          }, 0) / athletesWithBirthYear.length
        : undefined;

      // Update lineup with calculated values within transaction
      const updateData: any = {
        total_weight_kg: totalWeight > 0 ? totalWeight : undefined,
        average_weight_kg: averageWeight > 0 ? averageWeight : undefined
      };
      if (averageAge !== undefined && !isNaN(averageAge)) {
        updateData.average_age = Math.round(averageAge * 10) / 10; // Round to 1 decimal
      }
      await lineup.update(updateData, { transaction });

      // Commit transaction
      await transaction.commit();

      // Reload lineup with all associations after transaction commit
      const reloadedLineup = await Lineup.findByPk(finalLineupId, {
        include: [
          {
            model: SeatAssignment,
            as: 'seat_assignments',
            include: [
              {
                model: Athlete,
                as: 'athlete',
                attributes: ['athlete_id', 'name', 'weight_kg']
              }
            ]
          },
          {
            model: Boat,
            as: 'boat',
            attributes: ['boat_id', 'name', 'type', 'status']
          }
        ]
      });

      if (!reloadedLineup) {
        throw new Error('Failed to reload lineup after creation');
      }

      // Return the formatted lineup data
      return this.formatLineupData(reloadedLineup);
    } catch (error) {
      // Rollback transaction on any error
      // Use try-catch to handle case where transaction is already finished
      try {
        await transaction.rollback();
      } catch (rollbackError: any) {
        // Transaction may already be rolled back, which is fine
        // Only log if it's not the expected "already finished" error
        if (rollbackError?.message && !rollbackError.message.includes('finished')) {
          console.error('Error during transaction rollback:', rollbackError);
        }
      }
      console.error('Error creating lineup:', error);
      throw error;
    }
  }

  /**
   * Update an existing lineup
   */
  async updateLineup(lineupId: string, updateData: UpdateLineupRequest): Promise<LineupData> {
    try {
      const lineup = await Lineup.findByPk(lineupId);
      if (!lineup) {
        throw new Error('Lineup not found');
      }

      // Update basic lineup information
      if (updateData.lineup_name !== undefined || updateData.notes !== undefined) {
        const basicUpdate: any = {};
        if (updateData.lineup_name !== undefined) {
          basicUpdate.lineup_name = updateData.lineup_name;
        }
        if (updateData.notes !== undefined) {
          basicUpdate.notes = updateData.notes;
        }
        await lineup.update(basicUpdate);
      }

      // Update seat assignments if provided
      if (updateData.seat_assignments) {
        // Remove existing seat assignments
        await SeatAssignment.destroy({
          where: { lineup_id: lineupId }
        });

        // Create new seat assignments
        await Promise.all(
          updateData.seat_assignments.map(assignment => {
            const seatData: any = {
              lineup_id: lineupId,
              athlete_id: assignment.athlete_id,
              seat_number: assignment.seat_number
            };
            if (assignment.side) {
              seatData.side = assignment.side;
            }
            return SeatAssignment.create(seatData);
          })
        );

        // Recalculate weight and age statistics
        const athletes = await Athlete.findAll({
          where: { athlete_id: { [Op.in]: updateData.seat_assignments.map(sa => sa.athlete_id) } }
        });

        const totalWeight = athletes.reduce((sum, athlete) => sum + (athlete.weight_kg || 0), 0);
        const averageAge = athletes.reduce((sum, athlete) => {
          if (athlete.birth_year) {
            const age = new Date().getFullYear() - athlete.birth_year;
            return sum + age;
          }
          return sum;
        }, 0) / athletes.length;

        const weightUpdate: any = {
          total_weight_kg: totalWeight,
          average_weight_kg: totalWeight / athletes.length
        };
        if (!isNaN(averageAge)) {
          weightUpdate.average_age = averageAge;
        }
        await lineup.update(weightUpdate);
      }

      return await this.getLineupById(lineupId) as LineupData;
    } catch (error) {
      console.error('Error updating lineup:', error);
      throw error;
    }
  }

  /**
   * Delete a lineup
   */
  async deleteLineup(lineupId: string): Promise<boolean> {
    try {
      const lineup = await Lineup.findByPk(lineupId);
      if (!lineup) {
        throw new Error('Lineup not found');
      }

      // Delete seat assignments first (cascade should handle this, but being explicit)
      await SeatAssignment.destroy({
        where: { lineup_id: lineupId }
      });

      // Delete the lineup
      await lineup.destroy();

      return true;
    } catch (error) {
      console.error('Error deleting lineup:', error);
      throw error;
    }
  }

  /**
   * Get available athletes for a practice session (those with attendance status "Yes")
   * Joins PracticeSession -> Attendance -> Athlete to get athletes who have committed to the session
   */
  async getAvailableAthletesForSession(sessionId: number, teamId: number): Promise<Athlete[]> {
    try {
      // Verify the practice session exists and belongs to the team
      const session = await PracticeSession.findOne({
        where: {
          session_id: sessionId,
          team_id: teamId
        }
      });

      if (!session) {
        throw new Error('Practice session not found or access denied');
      }

      // Find all athletes with attendance status "Yes" for this session
      // Join Attendance -> Athlete, filter by session_id and status = 'Yes'
      const attendanceRecords = await Attendance.findAll({
        where: {
          session_id: sessionId,
          status: 'Yes',
          team_id: teamId
        },
        include: [
          {
            model: Athlete,
            as: 'athlete',
            where: {
              active: true // Only include active athletes
            },
            attributes: ['athlete_id', 'name', 'weight_kg', 'birth_year', 'gender', 'discipline', 'side', 'type'],
            required: true // Inner join - only athletes with attendance records
          }
        ]
      });

      // Extract athletes from the attendance records
      // Type assertion needed because Sequelize includes don't modify TypeScript types
      const athletes = attendanceRecords
        .map(record => (record as any).athlete as Athlete | null)
        .filter((athlete): athlete is Athlete => athlete !== null && athlete !== undefined)
        .sort((a, b) => {
          // Sort by name
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });

      return athletes;
    } catch (error) {
      console.error('Error fetching available athletes:', error);
      throw new Error('Failed to fetch available athletes');
    }
  }

  /**
   * Get available boats for a practice session
   */
  async getAvailableBoatsForSession(_sessionId: number, _teamId: number): Promise<Boat[]> {
    try {
      const boats = await Boat.findAll({
        where: {
          status: 'Available'
        },
        attributes: ['boat_id', 'name', 'type', 'status'],
        order: [['type', 'ASC'], ['name', 'ASC']]
      });

      return boats;
    } catch (error) {
      console.error('Error fetching available boats:', error);
      throw new Error('Failed to fetch available boats');
    }
  }

  /**
   * Format lineup data for API response
   */
  private formatLineupData(lineup: any): LineupData {
    return {
      lineup_id: lineup.lineup_id,
      session_id: lineup.session_id,
      boat_id: lineup.boat_id,
      team_id: lineup.team_id,
      lineup_name: lineup.lineup_name,
      lineup_type: lineup.lineup_type,
      total_weight_kg: lineup.total_weight_kg,
      average_weight_kg: lineup.average_weight_kg,
      average_age: lineup.average_age,
      notes: lineup.notes,
      seat_assignments: (lineup.seat_assignments || [])
        .filter((sa: any) => sa && sa.seat_assignment_id) // Filter out empty objects
        .map((sa: any) => ({
          seat_assignment_id: sa.seat_assignment_id,
          lineup_id: sa.lineup_id || lineup.lineup_id, // Fallback to parent lineup_id if missing
          athlete_id: sa.athlete_id,
          seat_number: sa.seat_number,
          side: sa.side || undefined,
          athlete_name: sa.athlete ? sa.athlete.name : undefined,
          athlete_weight: sa.athlete?.weight_kg,
          created_at: sa.created_at,
          updated_at: sa.updated_at
        })),
      created_at: lineup.created_at,
      updated_at: lineup.updated_at
    };
  }
}

export const lineupService = new LineupService();
