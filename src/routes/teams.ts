import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/middleware';
import { teamService } from '../services/teamService';

const router = Router();

/**
 * GET /api/teams
 * Get all teams (admin only)
 */
router.get('/', authMiddleware.verifyToken, async (_req: Request, res: Response) => {
  try {
    const teams = await teamService.getAllTeams();

    return res.json({
      success: true,
      data: teams,
      message: `Found ${teams.length} teams`,
      error: null
    });

  } catch (error: any) {
    console.error('Error fetching teams:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch teams',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/teams/:teamId
 * Get a specific team with members
 */
router.get('/:teamId', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    
    if (!teamId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing team ID',
        error: 'VALIDATION_ERROR'
      });
    }

    const teamIdNum = parseInt(teamId);

    if (isNaN(teamIdNum)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid team ID',
        error: 'VALIDATION_ERROR'
      });
    }

    const teamWithMembers = await teamService.getTeamMembers(teamIdNum);

    return res.json({
      success: true,
      data: teamWithMembers,
      message: 'Team retrieved successfully',
      error: null
    });

  } catch (error: any) {
    console.error('Error fetching team:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch team',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/teams
 * Create a new team (admin only)
 */
router.post('/', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      name,
      team_type,
      description,
      head_coach_id,
      assistant_coaches
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing required field: name',
        error: 'VALIDATION_ERROR'
      });
    }

    const team = await teamService.createTeam({
      name,
      team_type,
      description,
      head_coach_id,
      assistant_coaches
    });

    return res.status(201).json({
      success: true,
      data: team,
      message: 'Team created successfully',
      error: null
    });

  } catch (error: any) {
    console.error('Error creating team:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to create team',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/teams/:teamId/members
 * Add athlete to team
 */
router.post('/:teamId/members', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { athlete_id, role = 'Member' } = req.body;

    if (!teamId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing team ID',
        error: 'VALIDATION_ERROR'
      });
    }

    const teamIdNum = parseInt(teamId);

    if (isNaN(teamIdNum)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid team ID',
        error: 'VALIDATION_ERROR'
      });
    }

    if (!athlete_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing required field: athlete_id',
        error: 'VALIDATION_ERROR'
      });
    }

    const membership = await teamService.addAthleteToTeam(athlete_id, teamIdNum, role);

    return res.status(201).json({
      success: true,
      data: membership,
      message: 'Athlete added to team successfully',
      error: null
    });

  } catch (error: any) {
    console.error('Error adding athlete to team:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to add athlete to team',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/teams/:teamId/members/:athleteId
 * Remove athlete from team
 */
router.delete('/:teamId/members/:athleteId', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { teamId, athleteId } = req.params;

    if (!teamId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing team ID',
        error: 'VALIDATION_ERROR'
      });
    }

    if (!athleteId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing athlete ID',
        error: 'VALIDATION_ERROR'
      });
    }

    const teamIdNum = parseInt(teamId);

    if (isNaN(teamIdNum)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid team ID',
        error: 'VALIDATION_ERROR'
      });
    }

    const success = await teamService.removeAthleteFromTeam(athleteId, teamIdNum);

    if (!success) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Athlete not found in team',
        error: 'NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: null,
      message: 'Athlete removed from team successfully',
      error: null
    });

  } catch (error: any) {
    console.error('Error removing athlete from team:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to remove athlete from team',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

export default router;
