import { PracticeSession, Team, TeamMembership } from '../models';
import { Op } from 'sequelize';

export interface PracticeSessionWithTeam extends PracticeSession {
  team: Team;
}

export interface UpcomingSessionForAthlete extends PracticeSession {
  team: Team;
  attendance?: {
    status: string | null;
    notes?: string;
  };
}

export class PracticeSessionService {
  /**
   * Get upcoming practice sessions for an athlete's teams
   */
  async getUpcomingSessionsForAthlete(athleteId: string, daysAhead: number = 30): Promise<UpcomingSessionForAthlete[]> {
    try {
      // Get athlete's team IDs
      const memberships = await TeamMembership.findAll({
        where: {
          athlete_id: athleteId,
          left_at: null as any // Type assertion to bypass strict typing // Only active memberships
        },
        attributes: ['team_id']
      });

      const teamIds = memberships.map(m => m.team_id);
      
      if (teamIds.length === 0) {
        return []; // Athlete is not a member of any teams
      }

      // Calculate date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);

      // Get upcoming sessions for athlete's teams
      const sessions = await PracticeSession.findAll({
        where: {
          team_id: {
            [Op.in]: teamIds
          },
          date: {
            [Op.gte]: today,
            [Op.lte]: futureDate
          }
        },
        include: [{
          model: Team,
          as: 'team',
          attributes: [
            'team_id',
            'name',
            'team_type',
            'description'
          ]
        }],
        order: [['date', 'ASC'], ['start_time', 'ASC']],
        attributes: [
          'session_id',
          'team_id',
          'date',
          'start_time',
          'end_time',
          'session_type',
          'location',
          'notes',
          'created_at',
          'updated_at'
        ]
      });

      return sessions.map(session => ({
        ...session.toJSON(),
        team: (session as any).team
      })) as UpcomingSessionForAthlete[];
    } catch (error) {
      console.error('PracticeSessionService: Error fetching upcoming sessions for athlete:', error);
      throw error;
    }
  }

  /**
   * Get practice sessions for a specific team
   */
  async getTeamPracticeSessions(
    teamId: number, 
    options: {
      startDate?: Date;
      endDate?: Date;
      sessionType?: string;
      viewType?: 'upcoming' | 'previous' | 'all';
    } = {}
  ): Promise<PracticeSessionWithTeam[]> {
    try {
      const { startDate, endDate, sessionType, viewType = 'upcoming' } = options;

      const whereClause: any = {
        team_id: teamId
      };

      // Filter by session type
      if (sessionType) {
        whereClause.session_type = sessionType;
      }

      // Filter by date range
      if (startDate || endDate) {
        whereClause.date = {};
        if (startDate) whereClause.date[Op.gte] = startDate;
        if (endDate) whereClause.date[Op.lte] = endDate;
      }

      // Filter by upcoming vs previous
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (viewType === 'upcoming') {
        whereClause.date = { ...whereClause.date, [Op.gte]: today };
      } else if (viewType === 'previous') {
        whereClause.date = { ...whereClause.date, [Op.lt]: today };
      }

      const sessions = await PracticeSession.findAll({
        where: whereClause,
        include: [{
          model: Team,
          as: 'team',
          attributes: [
            'team_id',
            'name',
            'team_type',
            'description'
          ]
        }],
        order: [['date', 'ASC'], ['start_time', 'ASC']],
        attributes: [
          'session_id',
          'team_id',
          'date',
          'start_time',
          'end_time',
          'session_type',
          'location',
          'notes',
          'created_at',
          'updated_at'
        ]
      });

      return sessions.map(session => ({
        ...session.toJSON(),
        team: (session as any).team
      })) as PracticeSessionWithTeam[];
    } catch (error) {
      console.error('PracticeSessionService: Error fetching team practice sessions:', error);
      throw error;
    }
  }

  /**
   * Get today's practice sessions for an athlete's teams
   */
  async getTodaysSessionsForAthlete(athleteId: string): Promise<UpcomingSessionForAthlete[]> {
    try {
      // Get athlete's team IDs
      const memberships = await TeamMembership.findAll({
        where: {
          athlete_id: athleteId,
          left_at: null as any // Type assertion to bypass strict typing
        },
        attributes: ['team_id']
      });

      const teamIds = memberships.map(m => m.team_id);
      
      if (teamIds.length === 0) {
        return [];
      }

      // Get today's sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const sessions = await PracticeSession.findAll({
        where: {
          team_id: {
            [Op.in]: teamIds
          },
          date: {
            [Op.gte]: today,
            [Op.lt]: tomorrow
          }
        },
        include: [{
          model: Team,
          as: 'team',
          attributes: [
            'team_id',
            'name',
            'team_type',
            'description'
          ]
        }],
        order: [['start_time', 'ASC']],
        attributes: [
          'session_id',
          'team_id',
          'date',
          'start_time',
          'end_time',
          'session_type',
          'location',
          'notes',
          'created_at',
          'updated_at'
        ]
      });

      return sessions.map(session => ({
        ...session.toJSON(),
        team: (session as any).team
      })) as UpcomingSessionForAthlete[];
    } catch (error) {
      console.error('PracticeSessionService: Error fetching today\'s sessions for athlete:', error);
      throw error;
    }
  }

  /**
   * Get a specific practice session with team info
   */
  async getPracticeSessionById(sessionId: number): Promise<PracticeSessionWithTeam | null> {
    try {
      const session = await PracticeSession.findByPk(sessionId, {
        include: [{
          model: Team,
          as: 'team',
          attributes: [
            'team_id',
            'name',
            'team_type',
            'description'
          ]
        }],
        attributes: [
          'session_id',
          'team_id',
          'date',
          'start_time',
          'end_time',
          'session_type',
          'location',
          'notes',
          'created_at',
          'updated_at'
        ]
      });

      if (!session) {
        return null;
      }

      return {
        ...session.toJSON(),
        team: (session as any).team
      } as PracticeSessionWithTeam;
    } catch (error) {
      console.error('PracticeSessionService: Error fetching practice session by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new practice session
   */
  async createPracticeSession(sessionData: {
    team_id: number;
    date: Date;
    start_time: string;
    end_time?: string;
    session_type: 'Practice' | 'Race' | 'Erg Test' | 'Meeting' | 'Other';
    location?: string;
    notes?: string;
  }): Promise<PracticeSessionWithTeam> {
    try {
      const session = await PracticeSession.create(sessionData);
      
      // Fetch with team info
      const sessionWithTeam = await this.getPracticeSessionById(session.session_id);
      if (!sessionWithTeam) {
        throw new Error('Failed to fetch created session');
      }

      return sessionWithTeam;
    } catch (error) {
      console.error('PracticeSessionService: Error creating practice session:', error);
      throw error;
    }
  }

  /**
   * Update a practice session
   */
  async updatePracticeSession(sessionId: number, updateData: Partial<PracticeSession>): Promise<PracticeSessionWithTeam | null> {
    try {
      const session = await PracticeSession.findByPk(sessionId);
      if (!session) {
        return null;
      }

      await session.update(updateData);
      
      // Fetch with team info
      const updatedSession = await this.getPracticeSessionById(sessionId);
      return updatedSession;
    } catch (error) {
      console.error('PracticeSessionService: Error updating practice session:', error);
      throw error;
    }
  }

  /**
   * Delete a practice session
   */
  async deletePracticeSession(sessionId: number): Promise<boolean> {
    try {
      const session = await PracticeSession.findByPk(sessionId);
      if (!session) {
        return false;
      }

      await session.destroy();
      return true;
    } catch (error) {
      console.error('PracticeSessionService: Error deleting practice session:', error);
      throw error;
    }
  }

  /**
   * Check if athlete can access a practice session (is member of the team)
   */
  async canAthleteAccessSession(athleteId: string, sessionId: number): Promise<boolean> {
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
      console.error('PracticeSessionService: Error checking session access:', error);
      return false;
    }
  }
}

export const practiceSessionService = new PracticeSessionService();
