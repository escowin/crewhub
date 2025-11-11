import { 
  Challenge, 
  SavedLineup, 
  SavedLineupSeatAssignment,
  ChallengeLineups,
  ChallengeEntry,
  Boat,
  Athlete
} from '../models';
import sequelize from '../config/database';
import { QueryTypes, Op } from 'sequelize';
import { formatDateString } from '../utils/dateUtils';

export interface LeaderboardEntry {
  challenge_lineup_id: string;
  lineup_name?: string;
  boat_type: string;
  boat_name?: string;
  time_seconds: number;
  split_seconds?: number;
  stroke_rate?: number;
  entry_date: Date;
  entry_time: Date;
  athlete_names: string[];
}

export interface SavedLineupData {
  saved_lineup_id: string;
  lineup_name?: string;
  boat_type: string;
  boat_name?: string;
  created_at: Date;
  updated_at: Date;
  challenge_count?: number;
  athlete_names: string[];
  existing_challenges?: number[];
}

export interface ChallengeEntryData {
  challenge_entry_id: string;
  lineup_id: string;
  time_seconds: number;
  stroke_rate?: number;
  split_seconds?: number;
  entry_date: Date;
  entry_time: Date;
  notes?: string;
  conditions?: string;
}

export interface CreateSavedLineupRequest {
  saved_lineup_id: string;
  boat_id: string;
  lineup_name?: string;
  team_id?: number;
  created_by: string;
  is_active?: boolean;
  seat_assignments: {
    saved_lineup_seat_id: string;
    athlete_id: string;
    seat_number: number;
    side?: 'Port' | 'Starboard' | 'Scull' | '';
  }[];
}

export interface CreateChallengeEntryRequest {
  challenge_entry_id: string;
  lineup_id: string;
  time_seconds: number;
  stroke_rate?: number;
  split_seconds?: number;
  entry_date?: Date;
  entry_time?: Date;
  notes?: string;
  conditions?: string;
}

export interface LinkLineupToChallengeRequest {
  challenge_lineup_id: string;
  challenge_id: number;
  saved_lineup_id: string;
  is_active?: boolean;
}

export class ChallengeService {
  /**
   * Get all challenges
   */
  static async getAllChallenges(): Promise<Challenge[]> {
    return await Challenge.findAll({
      order: [['distance_meters', 'ASC']]
    });
  }

  /**
   * Get a specific challenge by ID
   */
  static async getChallengeById(challengeId: number): Promise<Challenge | null> {
    return await Challenge.findByPk(challengeId);
  }

  /**
   * Get leaderboard entries (all-time or seasonal)
   */
  static async getLeaderboard(params: {
    distanceMeters: number;
    boatType: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<LeaderboardEntry[]> {
    const { distanceMeters, boatType, startDate, endDate, limit = 100 } = params;
    
    let query: string;
    let replacements: any[];

    if (startDate && endDate) {
      // Seasonal leaderboard (with date range)
      query = `
        SELECT 
            cl.challenge_lineup_id,
            sl.lineup_name,
            b.type AS boat_type,
            b.name AS boat_name,
            ce.time_seconds,
            ce.split_seconds,
            ce.stroke_rate,
            ce.entry_date,
            ce.entry_time,
            ARRAY_AGG(
                a.name ORDER BY slsa.seat_number
            ) FILTER (WHERE a.name IS NOT NULL) AS athlete_names
        FROM challenge_lineups cl
        INNER JOIN saved_lineups sl ON cl.saved_lineup_id = sl.saved_lineup_id
        INNER JOIN boats b ON sl.boat_id = b.boat_id
        INNER JOIN challenges c ON cl.challenge_id = c.challenge_id
        INNER JOIN LATERAL (
            SELECT ce.*
            FROM challenge_entries ce
            WHERE ce.lineup_id = cl.challenge_lineup_id
              AND ce.entry_date >= $3
              AND ce.entry_date <= $4
            ORDER BY ce.entry_time DESC
            LIMIT 1
        ) ce ON true
        LEFT JOIN saved_lineup_seat_assignments slsa ON sl.saved_lineup_id = slsa.saved_lineup_id
        LEFT JOIN athletes a ON slsa.athlete_id = a.athlete_id
        WHERE c.distance_meters = $1
          AND b.type = $2
          AND cl.is_active = true
          AND sl.is_active = true
        GROUP BY 
            cl.challenge_lineup_id,
            sl.lineup_name,
            b.type,
            b.name,
            ce.time_seconds,
            ce.split_seconds,
            ce.stroke_rate,
            ce.entry_date,
            ce.entry_time
        ORDER BY ce.time_seconds ASC
        LIMIT $5;
      `;
      replacements = [distanceMeters, boatType, startDate, endDate, limit];
    } else {
      // All-time leaderboard
      query = `
        SELECT 
            cl.challenge_lineup_id,
            sl.lineup_name,
            b.type AS boat_type,
            b.name AS boat_name,
            ce.time_seconds,
            ce.split_seconds,
            ce.stroke_rate,
            ce.entry_date,
            ce.entry_time,
            ARRAY_AGG(
                a.name ORDER BY slsa.seat_number
            ) FILTER (WHERE a.name IS NOT NULL) AS athlete_names
        FROM challenge_lineups cl
        INNER JOIN saved_lineups sl ON cl.saved_lineup_id = sl.saved_lineup_id
        INNER JOIN boats b ON sl.boat_id = b.boat_id
        INNER JOIN challenges c ON cl.challenge_id = c.challenge_id
        INNER JOIN LATERAL (
            SELECT ce.*
            FROM challenge_entries ce
            WHERE ce.lineup_id = cl.challenge_lineup_id
            ORDER BY ce.entry_time DESC
            LIMIT 1
        ) ce ON true
        LEFT JOIN saved_lineup_seat_assignments slsa ON sl.saved_lineup_id = slsa.saved_lineup_id
        LEFT JOIN athletes a ON slsa.athlete_id = a.athlete_id
        WHERE c.distance_meters = $1
          AND b.type = $2
          AND cl.is_active = true
          AND sl.is_active = true
        GROUP BY 
            cl.challenge_lineup_id,
            sl.lineup_name,
            b.type,
            b.name,
            ce.time_seconds,
            ce.split_seconds,
            ce.stroke_rate,
            ce.entry_date,
            ce.entry_time
        ORDER BY ce.time_seconds ASC
        LIMIT $3;
      `;
      replacements = [distanceMeters, boatType, limit];
    }

    const results = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });

    return results as LeaderboardEntry[];
  }

  /**
   * Get user's saved lineups
   */
  static async getUserSavedLineups(athleteId: string): Promise<SavedLineupData[]> {
    const query = `
      SELECT DISTINCT
          sl.saved_lineup_id,
          sl.lineup_name,
          b.type AS boat_type,
          b.name AS boat_name,
          sl.created_at,
          sl.updated_at,
          COUNT(DISTINCT cl.challenge_id) AS challenge_count,
          ARRAY_AGG(
              a.name ORDER BY slsa.seat_number
          ) FILTER (WHERE a.name IS NOT NULL) AS athlete_names
      FROM saved_lineups sl
      INNER JOIN saved_lineup_seat_assignments slsa ON sl.saved_lineup_id = slsa.saved_lineup_id
      INNER JOIN boats b ON sl.boat_id = b.boat_id
      LEFT JOIN challenge_lineups cl ON sl.saved_lineup_id = cl.saved_lineup_id AND cl.is_active = true
      LEFT JOIN athletes a ON slsa.athlete_id = a.athlete_id
      WHERE slsa.athlete_id = $1
        AND sl.is_active = true
      GROUP BY 
          sl.saved_lineup_id,
          sl.lineup_name,
          b.type,
          b.name,
          sl.created_at,
          sl.updated_at
      ORDER BY sl.updated_at DESC;
    `;

    const results = await sequelize.query(query, {
      replacements: [athleteId],
      type: QueryTypes.SELECT
    });

    return results as SavedLineupData[];
  }

  /**
   * Get saved lineups from other challenges (for reusing)
   */
  static async getSavedLineupsFromOtherChallenges(
    athleteId: string,
    currentChallengeId: number,
    boatType: string
  ): Promise<SavedLineupData[]> {
    const query = `
      SELECT DISTINCT
          sl.saved_lineup_id,
          sl.lineup_name,
          b.type AS boat_type,
          b.name AS boat_name,
          ARRAY_AGG(DISTINCT c.distance_meters ORDER BY c.distance_meters) AS existing_challenges,
          sl.created_at,
          sl.updated_at,
          ARRAY_AGG(
              a.name ORDER BY slsa.seat_number
          ) FILTER (WHERE a.name IS NOT NULL) AS athlete_names
      FROM saved_lineups sl
      INNER JOIN saved_lineup_seat_assignments slsa ON sl.saved_lineup_id = slsa.saved_lineup_id
      INNER JOIN boats b ON sl.boat_id = b.boat_id
      LEFT JOIN challenge_lineups cl ON sl.saved_lineup_id = cl.saved_lineup_id AND cl.is_active = true
      LEFT JOIN challenges c ON cl.challenge_id = c.challenge_id AND c.challenge_id != $2
      LEFT JOIN athletes a ON slsa.athlete_id = a.athlete_id
      WHERE slsa.athlete_id = $1
        AND sl.is_active = true
        AND b.type = $3
        AND EXISTS (
          SELECT 1 
          FROM challenge_lineups cl2 
          WHERE cl2.saved_lineup_id = sl.saved_lineup_id 
            AND cl2.challenge_id != $2 
            AND cl2.is_active = true
        )
      GROUP BY 
          sl.saved_lineup_id,
          sl.lineup_name,
          b.type,
          b.name,
          sl.created_at,
          sl.updated_at
      ORDER BY sl.updated_at DESC;
    `;

    const results = await sequelize.query(query, {
      replacements: [athleteId, currentChallengeId, boatType],
      type: QueryTypes.SELECT
    });

    return results as SavedLineupData[];
  }

  /**
   * Get all entries for a lineup (history view)
   */
  static async getLineupEntries(lineupId: string): Promise<ChallengeEntryData[]> {
    const entries = await ChallengeEntry.findAll({
      where: { lineup_id: lineupId },
      order: [['entry_time', 'DESC']]
    });

    return entries.map(entry => {
      const result: ChallengeEntryData = {
        challenge_entry_id: entry.challenge_entry_id,
        lineup_id: entry.lineup_id,
        time_seconds: parseFloat(entry.time_seconds.toString()),
        entry_date: entry.entry_date,
        entry_time: entry.entry_time
      };
      
      if (entry.stroke_rate !== null && entry.stroke_rate !== undefined) {
        result.stroke_rate = parseFloat(entry.stroke_rate.toString());
      }
      
      if (entry.split_seconds !== null && entry.split_seconds !== undefined) {
        result.split_seconds = parseFloat(entry.split_seconds.toString());
      }
      
      if (entry.notes) {
        result.notes = entry.notes;
      }
      
      if (entry.conditions) {
        result.conditions = entry.conditions;
      }
      
      return result;
    });
  }

  /**
   * Check for duplicate saved lineup
   */
  static async checkDuplicateSavedLineup(
    boatId: string,
    athleteIds: string[],
    seatNumbers: number[]
  ): Promise<string | null> {
    // Format arrays as PostgreSQL array literals
    const athleteIdsArray = `ARRAY[${athleteIds.map(id => `'${id}'::UUID`).join(', ')}]`;
    const seatNumbersArray = `ARRAY[${seatNumbers.join(', ')}]`;
    
    const query = `
      SELECT sl.saved_lineup_id
      FROM saved_lineups sl
      INNER JOIN saved_lineup_seat_assignments slsa ON sl.saved_lineup_id = slsa.saved_lineup_id
      WHERE sl.boat_id = :boatId
        AND sl.is_active = true
      GROUP BY sl.saved_lineup_id
      HAVING 
          COUNT(DISTINCT (slsa.athlete_id, slsa.seat_number)) = :seatCount
          AND ARRAY_AGG(slsa.athlete_id ORDER BY slsa.seat_number) = ${athleteIdsArray}
          AND ARRAY_AGG(slsa.seat_number ORDER BY slsa.seat_number) = ${seatNumbersArray};
    `;

    const results = await sequelize.query(query, {
      replacements: {
        boatId: boatId,
        seatCount: athleteIds.length
      },
      type: QueryTypes.SELECT
    });

    if (results.length > 0) {
      return (results[0] as any).saved_lineup_id;
    }

    return null;
  }

  /**
   * Create a saved lineup
   */
  static async createSavedLineup(data: CreateSavedLineupRequest): Promise<SavedLineup> {
    const transaction = await sequelize.transaction();

    try {
      // Check for duplicate
      const athleteIds = data.seat_assignments.map(sa => sa.athlete_id);
      const seatNumbers = data.seat_assignments.map(sa => sa.seat_number);
      const duplicateId = await this.checkDuplicateSavedLineup(
        data.boat_id,
        athleteIds,
        seatNumbers
      );

      if (duplicateId) {
        // Return existing lineup instead of creating duplicate
        const existing = await SavedLineup.findByPk(duplicateId, {
          include: [
            {
              model: SavedLineupSeatAssignment,
              as: 'seat_assignments',
              include: [
                {
                  model: Athlete,
                  as: 'athlete',
                  attributes: ['athlete_id', 'name']
                }
              ]
            },
            {
              model: Boat,
              as: 'boat',
              attributes: ['boat_id', 'name', 'type']
            }
          ],
          transaction
        });
        await transaction.commit();
        if (!existing) throw new Error('Duplicate lineup found but could not be retrieved');
        return existing;
      }

      // Create new saved lineup
      const createData: any = {
        saved_lineup_id: data.saved_lineup_id,
        boat_id: data.boat_id,
        created_by: data.created_by,
        is_active: data.is_active !== undefined ? data.is_active : true
      };
      
      if (data.lineup_name) {
        createData.lineup_name = data.lineup_name;
      }
      
      if (data.team_id) {
        createData.team_id = data.team_id;
      }
      
      const savedLineup = await SavedLineup.create(createData, { transaction });

      // Create seat assignments
      await Promise.all(
        data.seat_assignments.map(sa =>
          SavedLineupSeatAssignment.create({
            saved_lineup_seat_id: sa.saved_lineup_seat_id,
            saved_lineup_id: savedLineup.saved_lineup_id,
            athlete_id: sa.athlete_id,
            seat_number: sa.seat_number,
            side: sa.side || ''
          }, { transaction })
        )
      );

      await transaction.commit();

      // Return with associations
      return await SavedLineup.findByPk(savedLineup.saved_lineup_id, {
        include: [
          {
            model: SavedLineupSeatAssignment,
            as: 'seat_assignments',
            include: [
              {
                model: Athlete,
                as: 'athlete',
                attributes: ['athlete_id', 'name']
              }
            ]
          },
          {
            model: Boat,
            as: 'boat',
            attributes: ['boat_id', 'name', 'type']
          }
        ]
      }) as SavedLineup;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Link a saved lineup to a challenge
   */
  static async linkLineupToChallenge(data: LinkLineupToChallengeRequest): Promise<ChallengeLineups> {
    // Check if link already exists
    const existing = await ChallengeLineups.findOne({
      where: {
        challenge_id: data.challenge_id,
        saved_lineup_id: data.saved_lineup_id
      }
    });

    if (existing) {
      // Update if exists
      existing.is_active = data.is_active !== undefined ? data.is_active : true;
      await existing.save();
      return existing;
    }

    // Create new link
    return await ChallengeLineups.create({
      challenge_lineup_id: data.challenge_lineup_id,
      challenge_id: data.challenge_id,
      saved_lineup_id: data.saved_lineup_id,
      is_active: data.is_active !== undefined ? data.is_active : true
    });
  }

  /**
   * Create a challenge entry
   */
  static async createChallengeEntry(data: CreateChallengeEntryRequest): Promise<ChallengeEntry> {
    const createData: any = {
      challenge_entry_id: data.challenge_entry_id,
      lineup_id: data.lineup_id,
      time_seconds: data.time_seconds,
      entry_date: formatDateString(data.entry_date || new Date()), // Keep as string for DATEONLY field
      entry_time: data.entry_time || new Date()
    };
    
    if (data.stroke_rate !== undefined) {
      createData.stroke_rate = data.stroke_rate;
    }
    
    if (data.split_seconds !== undefined) {
      createData.split_seconds = data.split_seconds;
    }
    
    if (data.notes) {
      createData.notes = data.notes;
    }
    
    if (data.conditions) {
      createData.conditions = data.conditions;
    }
    
    return await ChallengeEntry.create(createData);
  }

  /**
   * Create challenge entry atomically with all related data (NEW saved lineup)
   * This creates: saved_lineup, saved_lineup_seat_assignment, challenge_lineup, challenge_entry
   * All in a single transaction
   */
  static async createChallengeEntryAtomic(data: {
    saved_lineup_id: string;
    boat_id: string;
    lineup_name?: string;
    created_by: string;
    seat_assignments: Array<{
      saved_lineup_seat_id: string;
      athlete_id: string;
      seat_number: number;
      side?: string;
    }>;
    challenge_lineup_id: string;
    challenge_id: number;
    challenge_entry_id: string;
    time_seconds: number;
    split_seconds?: number;
    stroke_rate?: number;
    entry_date: Date;
    entry_time: Date;
    notes?: string;
    conditions?: string;
  }): Promise<{
    saved_lineup: SavedLineup;
    challenge_lineup: ChallengeLineups;
    challenge_entry: ChallengeEntry;
  }> {
    const transaction = await sequelize.transaction();

    try {
      // 1. Create saved_lineup
      const savedLineupData: any = {
        saved_lineup_id: data.saved_lineup_id,
        boat_id: data.boat_id,
        created_by: data.created_by,
        is_active: true
      };
      if (data.lineup_name) {
        savedLineupData.lineup_name = data.lineup_name;
      }
      const savedLineup = await SavedLineup.create(savedLineupData, { transaction });

      // 2. Create saved_lineup_seat_assignments
      await Promise.all(
        data.seat_assignments.map(sa => {
          const seatAssignmentData: any = {
            saved_lineup_seat_id: sa.saved_lineup_seat_id,
            saved_lineup_id: data.saved_lineup_id,
            athlete_id: sa.athlete_id,
            seat_number: sa.seat_number
          };
          if (sa.side) {
            seatAssignmentData.side = sa.side as 'Port' | 'Starboard' | 'Scull' | '';
          } else {
            seatAssignmentData.side = '';
          }
          return SavedLineupSeatAssignment.create(seatAssignmentData, { transaction });
        })
      );

      // 3. Create challenge_lineup
      const challengeLineup = await ChallengeLineups.create({
        challenge_lineup_id: data.challenge_lineup_id,
        challenge_id: data.challenge_id,
        saved_lineup_id: data.saved_lineup_id,
        is_active: true
      }, { transaction });

      // 4. Create challenge_entry
      const challengeEntryData: any = {
        challenge_entry_id: data.challenge_entry_id,
        lineup_id: data.challenge_lineup_id,
        time_seconds: data.time_seconds,
        entry_date: formatDateString(data.entry_date), // Keep as string for DATEONLY field
        entry_time: data.entry_time
      };
      if (data.split_seconds !== undefined) {
        challengeEntryData.split_seconds = data.split_seconds;
      }
      if (data.stroke_rate !== undefined) {
        challengeEntryData.stroke_rate = data.stroke_rate;
      }
      if (data.notes) {
        challengeEntryData.notes = data.notes;
      }
      if (data.conditions) {
        challengeEntryData.conditions = data.conditions;
      }
      const challengeEntry = await ChallengeEntry.create(challengeEntryData, { transaction });

      await transaction.commit();

      return {
        saved_lineup: savedLineup,
        challenge_lineup: challengeLineup,
        challenge_entry: challengeEntry
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Create challenge entry atomically with existing saved lineup
   * This creates: challenge_lineup, challenge_entry
   * All in a single transaction
   */
  static async createChallengeEntryAtomicExisting(data: {
    saved_lineup_id: string;
    challenge_lineup_id: string;
    challenge_id: number;
    challenge_entry_id: string;
    time_seconds: number;
    split_seconds?: number;
    stroke_rate?: number;
    entry_date: Date;
    entry_time: Date;
    notes?: string;
    conditions?: string;
  }): Promise<{
    challenge_lineup: ChallengeLineups;
    challenge_entry: ChallengeEntry;
  }> {
    const transaction = await sequelize.transaction();

    try {
      // 1. Create challenge_lineup (check if exists first)
      let challengeLineup = await ChallengeLineups.findOne({
        where: {
          challenge_id: data.challenge_id,
          saved_lineup_id: data.saved_lineup_id
        },
        transaction
      });

      let lineupIdToUse: string;
      
      if (!challengeLineup) {
        challengeLineup = await ChallengeLineups.create({
          challenge_lineup_id: data.challenge_lineup_id,
          challenge_id: data.challenge_id,
          saved_lineup_id: data.saved_lineup_id,
          is_active: true
        }, { transaction });
        // Use getDataValue() to access actual database value (class fields shadow getters)
        lineupIdToUse = challengeLineup.getDataValue('challenge_lineup_id') || data.challenge_lineup_id;
      } else {
        // Capture the ID using getDataValue() to access actual database value (class fields shadow getters)
        lineupIdToUse = challengeLineup.getDataValue('challenge_lineup_id');
        // Update if exists - use the existing challenge_lineup_id
        challengeLineup.is_active = true;
        await challengeLineup.save({ transaction });
      }

      // Ensure we have a valid lineup_id
      if (!lineupIdToUse) {
        const foundId = challengeLineup ? challengeLineup.getDataValue('challenge_lineup_id') : 'null';
        throw new Error(`Failed to determine challenge_lineup_id for challenge entry. Challenge lineup found: ${!!challengeLineup}, ID: ${foundId}`);
      }

      // 2. Create challenge_entry
      const challengeEntryData: any = {
        challenge_entry_id: data.challenge_entry_id,
        lineup_id: lineupIdToUse,
        time_seconds: data.time_seconds,
        entry_date: formatDateString(data.entry_date), // Keep as string for DATEONLY field
        entry_time: data.entry_time
      };
      if (data.split_seconds !== undefined) {
        challengeEntryData.split_seconds = data.split_seconds;
      }
      if (data.stroke_rate !== undefined) {
        challengeEntryData.stroke_rate = data.stroke_rate;
      }
      if (data.notes) {
        challengeEntryData.notes = data.notes;
      }
      if (data.conditions) {
        challengeEntryData.conditions = data.conditions;
      }
      const challengeEntry = await ChallengeEntry.create(challengeEntryData, { transaction });

      await transaction.commit();

      return {
        challenge_lineup: challengeLineup,
        challenge_entry: challengeEntry
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get all challenge lineups (for bulk sync)
   */
  static async getAllChallengeLineups(): Promise<ChallengeLineups[]> {
    return await ChallengeLineups.findAll({
      where: { is_active: true },
      include: [
        {
          model: Challenge,
          as: 'challenge',
          attributes: ['challenge_id', 'distance_meters', 'description']
        },
        {
          model: SavedLineup,
          as: 'saved_lineup',
          attributes: ['saved_lineup_id', 'lineup_name', 'boat_id', 'is_active'],
          include: [
            {
              model: Boat,
              as: 'boat',
              attributes: ['boat_id', 'name', 'type']
            }
          ]
        }
      ]
    });
  }

  /**
   * Get all challenge entries (for bulk sync)
   */
  static async getAllChallengeEntries(): Promise<ChallengeEntry[]> {
    return await ChallengeEntry.findAll({
      order: [['entry_time', 'DESC']]
    });
  }

  /**
   * Get all saved lineups (for bulk sync)
   */
  static async getAllSavedLineups(): Promise<SavedLineup[]> {
    return await SavedLineup.findAll({
      where: { is_active: true },
      include: [
        {
          model: Boat,
          as: 'boat',
          attributes: ['boat_id', 'name', 'type']
        }
      ]
    });
  }

  /**
   * Get all saved lineup seat assignments (for bulk sync)
   */
  static async getAllSavedLineupSeatAssignments(): Promise<SavedLineupSeatAssignment[]> {
    return await SavedLineupSeatAssignment.findAll({
      order: [['saved_lineup_id', 'ASC'], ['seat_number', 'ASC']]
    });
  }

  /**
   * Get all challenge leaderboard data atomically (for bulk sync)
   * Filters saved_lineups and seat_assignments to only include those belonging to the user
   */
  static async getAllLeaderboardDataSync(athleteId: string): Promise<{
    lineups: ChallengeLineups[];
    entries: ChallengeEntry[];
    savedLineups: SavedLineup[];
    seatAssignments: SavedLineupSeatAssignment[];
  }> {
    // Get all challenge lineups and entries (no filtering needed)
    const [lineups, entries] = await Promise.all([
      this.getAllChallengeLineups(),
      this.getAllChallengeEntries()
    ]);

    // Get seat assignments where the user's athlete_id appears
    console.log(`[getAllLeaderboardDataSync] Searching for seat assignments with athlete_id: ${athleteId} (type: ${typeof athleteId})`);
    
    // First, let's check if ANY seat assignments exist
    const allSeatAssignments = await SavedLineupSeatAssignment.findAll({ limit: 5 });
    console.log(`[getAllLeaderboardDataSync] Sample seat assignments in DB:`, allSeatAssignments.map(sa => ({
      saved_lineup_seat_id: sa.getDataValue('saved_lineup_seat_id'),
      saved_lineup_id: sa.getDataValue('saved_lineup_id'),
      athlete_id: sa.getDataValue('athlete_id'),
      athlete_id_type: typeof sa.getDataValue('athlete_id')
    })));
    
    const userSeatAssignments = await SavedLineupSeatAssignment.findAll({
      where: { athlete_id: athleteId },
      order: [['saved_lineup_id', 'ASC'], ['seat_number', 'ASC']]
    });

    console.log(`[getAllLeaderboardDataSync] Found ${userSeatAssignments.length} seat assignments for athlete ${athleteId}`);
    if (userSeatAssignments.length > 0 && userSeatAssignments[0]) {
      const firstAssignment = userSeatAssignments[0];
      console.log(`[getAllLeaderboardDataSync] Sample seat assignment:`, {
        saved_lineup_seat_id: firstAssignment.getDataValue('saved_lineup_seat_id'),
        saved_lineup_id: firstAssignment.getDataValue('saved_lineup_id'),
        athlete_id: firstAssignment.getDataValue('athlete_id')
      });
    }

    // Extract unique saved_lineup_ids from user's seat assignments
    // Use getDataValue() to access actual database values (class fields shadow getters)
    const userSavedLineupIdsFromSeats = [...new Set(userSeatAssignments.map(sa => sa.getDataValue('saved_lineup_id')))];

    // Also get saved lineups where the user is the creator (in case seat assignments are missing)
    console.log(`[getAllLeaderboardDataSync] Searching for saved lineups with created_by: ${athleteId} (type: ${typeof athleteId})`);
    
    // First, let's check if ANY saved lineups exist
    const allSavedLineups = await SavedLineup.findAll({ 
      where: { is_active: true },
      limit: 5,
      attributes: ['saved_lineup_id', 'created_by']
    });
    console.log(`[getAllLeaderboardDataSync] Sample saved lineups in DB:`, allSavedLineups.map(sl => ({
      saved_lineup_id: sl.getDataValue('saved_lineup_id'),
      created_by: sl.getDataValue('created_by'),
      created_by_type: typeof sl.getDataValue('created_by')
    })));
    
    const userCreatedLineups = await SavedLineup.findAll({
      where: {
        created_by: athleteId,
        is_active: true
      },
      attributes: ['saved_lineup_id']
    });
    console.log(`[getAllLeaderboardDataSync] Found ${userCreatedLineups.length} saved lineups created by athlete ${athleteId}`);
    if (userCreatedLineups.length > 0 && userCreatedLineups[0]) {
      const firstLineup = userCreatedLineups[0];
      console.log(`[getAllLeaderboardDataSync] Sample created lineup:`, {
        saved_lineup_id: firstLineup.getDataValue('saved_lineup_id')
      });
    }
    
    // Use getDataValue() to access actual database values (class fields shadow getters)
    const userSavedLineupIdsFromCreated = userCreatedLineups.map(sl => sl.getDataValue('saved_lineup_id'));

    // Combine both sets of saved_lineup_ids
    const userSavedLineupIds = [...new Set([...userSavedLineupIdsFromSeats, ...userSavedLineupIdsFromCreated])];
    console.log(`[getAllLeaderboardDataSync] Total unique saved_lineup_ids: ${userSavedLineupIds.length} (${userSavedLineupIdsFromSeats.length} from seats, ${userSavedLineupIdsFromCreated.length} from created)`);

    // Get saved lineups that belong to the user (via seat assignments OR created_by)
    const userSavedLineups = userSavedLineupIds.length > 0
      ? await SavedLineup.findAll({
          where: {
            saved_lineup_id: {
              [Op.in]: userSavedLineupIds
            },
            is_active: true
          },
          include: [
            {
              model: Boat,
              as: 'boat',
              attributes: ['boat_id', 'name', 'type']
            }
          ]
        })
      : [];

    console.log(`[getAllLeaderboardDataSync] Found ${userSavedLineups.length} saved lineups after query`);

    // Get ALL seat assignments for the user's saved lineups (includes sibling records)
    // Example: If user is in a 4-person boat lineup, this returns all 4 seat assignments
    // (user's seat + all teammates' seats) since they all share the same saved_lineup_id
    const allSeatAssignmentsForUserLineups = userSavedLineupIds.length > 0
      ? await SavedLineupSeatAssignment.findAll({
          where: {
            saved_lineup_id: {
              [Op.in]: userSavedLineupIds
            }
          },
          order: [['saved_lineup_id', 'ASC'], ['seat_number', 'ASC']]
        })
      : [];

    console.log(`[getAllLeaderboardDataSync] Found ${allSeatAssignmentsForUserLineups.length} seat assignments for user's lineups (includes all teammates)`);
    
    // Log breakdown by saved_lineup_id to verify sibling records are included
    if (allSeatAssignmentsForUserLineups.length > 0) {
      const assignmentsByLineup = new Map<string, number>();
      allSeatAssignmentsForUserLineups.forEach(sa => {
        const lineupId = sa.getDataValue('saved_lineup_id');
        assignmentsByLineup.set(lineupId, (assignmentsByLineup.get(lineupId) || 0) + 1);
      });
      console.log(`[getAllLeaderboardDataSync] Seat assignments breakdown:`, 
        Array.from(assignmentsByLineup.entries()).map(([lineupId, count]) => 
          `${lineupId}: ${count} seats`
        ).join(', ')
      );
    }

    return {
      lineups,
      entries,
      savedLineups: userSavedLineups,
      seatAssignments: allSeatAssignmentsForUserLineups
    };
  }

  /**
   * Get all challenge performances for a saved lineup (analytics)
   */
  static async getLineupPerformanceAcrossChallenges(savedLineupId: string): Promise<any[]> {
    const query = `
      SELECT 
          c.distance_meters,
          c.description,
          cl.challenge_lineup_id,
          ce.time_seconds,
          ce.entry_date,
          ce.entry_time
      FROM saved_lineups sl
      INNER JOIN challenge_lineups cl ON sl.saved_lineup_id = cl.saved_lineup_id
      INNER JOIN challenges c ON cl.challenge_id = c.challenge_id
      INNER JOIN LATERAL (
          SELECT ce.*
          FROM challenge_entries ce
          WHERE ce.lineup_id = cl.challenge_lineup_id
          ORDER BY ce.entry_time DESC
          LIMIT 1
      ) ce ON true
      WHERE sl.saved_lineup_id = $1
        AND cl.is_active = true
      ORDER BY c.distance_meters ASC;
    `;

    const results = await sequelize.query(query, {
      replacements: [savedLineupId],
      type: QueryTypes.SELECT
    });

    return results.map((r: any) => ({
      distance_meters: r.distance_meters,
      description: r.description,
      challenge_lineup_id: r.challenge_lineup_id,
      time_seconds: parseFloat(r.time_seconds.toString()),
      entry_date: r.entry_date,
      entry_time: r.entry_time
    }));
  }

  /**
   * Update a challenge
   */
  static async updateChallenge(challengeId: number, updateData: {
    distance_meters?: number;
    description?: string;
  }): Promise<Challenge> {
    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge) {
      throw new Error('Challenge not found');
    }

    await challenge.update(updateData);
    return challenge;
  }

  /**
   * Delete a challenge
   */
  static async deleteChallenge(challengeId: number): Promise<void> {
    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge) {
      throw new Error('Challenge not found');
    }

    await challenge.destroy();
  }

  /**
   * Update a saved lineup
   */
  static async updateSavedLineup(savedLineupId: string, updateData: {
    lineup_name?: string;
    boat_id?: string;
    team_id?: number;
    is_active?: boolean;
  }): Promise<SavedLineup> {
    const savedLineup = await SavedLineup.findByPk(savedLineupId);
    if (!savedLineup) {
      throw new Error('Saved lineup not found');
    }

    await savedLineup.update(updateData);
    return savedLineup;
  }

  /**
   * Delete a saved lineup (soft delete by setting is_active = false)
   */
  static async deleteSavedLineup(savedLineupId: string): Promise<void> {
    const savedLineup = await SavedLineup.findByPk(savedLineupId);
    if (!savedLineup) {
      throw new Error('Saved lineup not found');
    }

    // Soft delete by setting is_active = false
    await savedLineup.update({ is_active: false });
  }

  /**
   * Update a challenge lineup
   */
  static async updateChallengeLineup(challengeLineupId: string, updateData: {
    is_active?: boolean;
  }): Promise<ChallengeLineups> {
    const challengeLineup = await ChallengeLineups.findByPk(challengeLineupId);
    if (!challengeLineup) {
      throw new Error('Challenge lineup not found');
    }

    await challengeLineup.update(updateData);
    return challengeLineup;
  }

  /**
   * Delete a challenge lineup (soft delete by setting is_active = false)
   */
  static async deleteChallengeLineup(challengeLineupId: string): Promise<void> {
    const challengeLineup = await ChallengeLineups.findByPk(challengeLineupId);
    if (!challengeLineup) {
      throw new Error('Challenge lineup not found');
    }

    // Soft delete by setting is_active = false
    await challengeLineup.update({ is_active: false });
  }

  /**
   * Update a challenge entry
   */
  static async updateChallengeEntry(challengeEntryId: string, updateData: {
    time_seconds?: number;
    stroke_rate?: number;
    split_seconds?: number;
    entry_date?: Date;
    entry_time?: Date;
    notes?: string;
    conditions?: string;
  }): Promise<ChallengeEntry> {
    const entry = await ChallengeEntry.findByPk(challengeEntryId);
    if (!entry) {
      throw new Error('Challenge entry not found');
    }

    // Convert entry_date to string for DATEONLY field
    const updateDataFormatted: any = { ...updateData };
    if (updateData.entry_date !== undefined) {
      updateDataFormatted.entry_date = formatDateString(updateData.entry_date);
    }

    await entry.update(updateDataFormatted);
    return entry;
  }

  /**
   * Delete a challenge entry
   */
  static async deleteChallengeEntry(challengeEntryId: string): Promise<void> {
    const entry = await ChallengeEntry.findByPk(challengeEntryId);
    if (!entry) {
      throw new Error('Challenge entry not found');
    }

    await entry.destroy();
  }
}

export const challengeService = ChallengeService;

