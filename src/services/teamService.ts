import { Team, TeamMembership, Athlete } from '../models';

export interface AthleteTeamInfo {
  team: Team;
  membership: TeamMembership;
}

export interface TeamWithMembers {
  team: Team;
  members: Array<{
    athlete: Athlete;
    membership: TeamMembership;
  }>;
}

export class TeamService {
  /**
   * Get all teams that an athlete belongs to
   */
  async getAthleteTeams(athleteId: string): Promise<AthleteTeamInfo[]> {
    try {
      const memberships = await TeamMembership.findAll({
        where: {
          athlete_id: athleteId,
          left_at: null as any // Type assertion to bypass strict typing
        },
        include: [{
          model: Team,
          as: 'team',
          attributes: [
            'team_id',
            'name',
            'team_type',
            'description',
            'head_coach_id',
            'assistant_coaches',
            'created_at',
            'updated_at'
          ]
        }],
        attributes: [
          'membership_id',
          'athlete_id',
          'team_id',
          'role',
          'joined_at',
          'left_at',
          'created_at',
          'updated_at'
        ]
      });

      return memberships.map(membership => ({
        team: (membership as any).team,
        membership: membership
      }));
    } catch (error) {
      console.error('TeamService: Error fetching athlete teams:', error);
      throw error;
    }
  }

  /**
   * Get all members of a specific team
   */
  async getTeamMembers(teamId: number): Promise<TeamWithMembers> {
    try {
      const team = await Team.findByPk(teamId);
      if (!team) {
        throw new Error(`Team with ID ${teamId} not found`);
      }

      const memberships = await TeamMembership.findAll({
        where: {
          team_id: teamId,
          left_at: null as any // Type assertion to bypass strict typing
        },
        include: [{
          model: Athlete,
          as: 'athlete',
          attributes: [
            'athlete_id',
            'name',
            'email',
            'phone',
            'type',
            'gender',
            'birth_year',
            'active',
            'competitive_status'
          ]
        }],
        attributes: [
          'membership_id',
          'athlete_id',
          'team_id',
          'role',
          'joined_at',
          'left_at',
          'created_at',
          'updated_at'
        ]
      });

      return {
        team,
        members: memberships.map(membership => ({
          athlete: (membership as any).athlete,
          membership: membership
        }))
      };
    } catch (error) {
      console.error('TeamService: Error fetching team members:', error);
      throw error;
    }
  }

  /**
   * Get team membership details for an athlete
   */
  async getAthleteTeamMembership(athleteId: string, teamId: number): Promise<TeamMembership | null> {
    try {
      const membership = await TeamMembership.findOne({
        where: {
          athlete_id: athleteId,
          team_id: teamId,
          left_at: null as any // Type assertion to bypass strict typing
        }
      });

      return membership;
    } catch (error) {
      console.error('TeamService: Error fetching team membership:', error);
      throw error;
    }
  }

  /**
   * Check if athlete is member of team
   */
  async isAthleteMemberOfTeam(athleteId: string, teamId: number): Promise<boolean> {
    try {
      const membership = await this.getAthleteTeamMembership(athleteId, teamId);
      return membership !== null;
    } catch (error) {
      console.error('TeamService: Error checking team membership:', error);
      return false;
    }
  }

  /**
   * Get all teams (for admin purposes)
   */
  async getAllTeams(): Promise<Team[]> {
    try {
      const teams = await Team.findAll({
        order: [['name', 'ASC']],
        attributes: [
          'team_id',
          'name',
          'team_type',
          'description',
          'head_coach_id',
          'assistant_coaches',
          'created_at',
          'updated_at'
        ]
      });

      return teams;
    } catch (error) {
      console.error('TeamService: Error fetching all teams:', error);
      throw error;
    }
  }

  /**
   * Create a new team
   */
  async createTeam(teamData: {
    name: string;
    team_type?: string;
    description?: string;
    head_coach_id?: string;
    assistant_coaches?: string[];
  }): Promise<Team> {
    try {
      const team = await Team.create(teamData);
      return team;
    } catch (error) {
      console.error('TeamService: Error creating team:', error);
      throw error;
    }
  }

  /**
   * Add athlete to team
   */
  async addAthleteToTeam(athleteId: string, teamId: number, role: 'Member' | 'Captain' | 'Coach' | 'Admin' = 'Member'): Promise<TeamMembership> {
    try {
      // Check if membership already exists
      const existingMembership = await TeamMembership.findOne({
        where: {
          athlete_id: athleteId,
          team_id: teamId
        }
      });

      if (existingMembership) {
        if (existingMembership.left_at) {
          // Reactivate membership
          await existingMembership.update({
            left_at: null as any, // Type assertion to bypass strict typing
            role: role as 'Member' | 'Captain' | 'Coach' | 'Admin',
            updated_at: new Date()
          });
          return existingMembership;
        } else {
          throw new Error('Athlete is already a member of this team');
        }
      }

      // Create new membership
      const membership = await TeamMembership.create({
        athlete_id: athleteId,
        team_id: teamId,
        role: role as 'Member' | 'Captain' | 'Coach' | 'Admin',
        joined_at: new Date()
      });

      return membership;
    } catch (error) {
      console.error('TeamService: Error adding athlete to team:', error);
      throw error;
    }
  }

  /**
   * Remove athlete from team
   */
  async removeAthleteFromTeam(athleteId: string, teamId: number): Promise<boolean> {
    try {
      const membership = await TeamMembership.findOne({
        where: {
          athlete_id: athleteId,
          team_id: teamId,
          left_at: null as any // Type assertion to bypass strict typing
        }
      });

      if (!membership) {
        return false;
      }

      await membership.update({
        left_at: new Date(),
        updated_at: new Date()
      });

      return true;
    } catch (error) {
      console.error('TeamService: Error removing athlete from team:', error);
      throw error;
    }
  }
}

export const teamService = new TeamService();
