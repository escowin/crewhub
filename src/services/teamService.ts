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
            role: role as 'Athlete' | 'Captain' | 'Coach' | 'Assistant Coach' | 'Secretary',
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
        role: role as 'Athlete' | 'Captain' | 'Coach' | 'Assistant Coach' | 'Secretary',
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

  /**
   * Get all coaches (deduplicated)
   * Returns unique list of athletes who have Coach or Assistant Coach role in any team
   * Used for coach login dropdown in crewssignment
   */
  async getCoaches(): Promise<Array<{
    athlete_id: string;
    name: string;
    role: 'Coach' | 'Assistant Coach';
    teams: Array<{
      team_id: number;
      team_name: string;
    }>;
  }>> {
    try {
      const memberships = await TeamMembership.findAll({
        where: {
          role: ['Coach', 'Assistant Coach'] as any,
          left_at: null as any // Only active memberships
        },
        include: [
          {
            model: Athlete,
            as: 'athlete',
            attributes: [
              'athlete_id',
              'name'
            ]
          },
          {
            model: Team,
            as: 'team',
            attributes: [
              'team_id',
              'name'
            ]
          }
        ],
        attributes: [
          'athlete_id',
          'team_id',
          'role'
        ],
        order: [['athlete_id', 'ASC'], ['role', 'ASC']]
      });

      // Group by athlete_id to deduplicate and collect teams
      const coachesMap = new Map<string, {
        athlete_id: string;
        name: string;
        role: 'Coach' | 'Assistant Coach';
        teams: Array<{
          team_id: number;
          team_name: string;
        }>;
      }>();

      for (const membership of memberships) {
        const membershipData = membership.toJSON() as any;
        const athlete = membershipData.athlete;
        const team = membershipData.team;

        if (!athlete || !team) continue;

        const athleteId = athlete.athlete_id;
        const role = membershipData.role as 'Coach' | 'Assistant Coach';

        if (coachesMap.has(athleteId)) {
          // Add team to existing coach entry
          const coach = coachesMap.get(athleteId)!;
          coach.teams.push({
            team_id: team.team_id,
            team_name: team.name
          });
          // Prefer 'Coach' role over 'Assistant Coach' if they have both
          if (role === 'Coach' && coach.role === 'Assistant Coach') {
            coach.role = 'Coach';
          }
        } else {
          // Create new coach entry
          coachesMap.set(athleteId, {
            athlete_id: athleteId,
            name: athlete.name,
            role: role,
            teams: [{
              team_id: team.team_id,
              team_name: team.name
            }]
          });
        }
      }

      // Convert map to array and sort by name
      const coaches = Array.from(coachesMap.values());
      coaches.sort((a, b) => a.name.localeCompare(b.name));

      return coaches;
    } catch (error) {
      console.error('TeamService: Error fetching coaches:', error);
      throw error;
    }
  }
}

export const teamService = new TeamService();
