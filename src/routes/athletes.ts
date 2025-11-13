import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/middleware';
import { athleteService, teamService, practiceSessionService } from '../services';

const router = Router();

/**
 * GET /api/athletes/coaches
 * Get list of coaches for login dropdown (public endpoint)
 * Returns unique coaches (deduplicated if they coach multiple teams)
 * This endpoint is public and does not require authentication
 */
router.get('/coaches', async (_req: Request, res: Response) => {
  try {
    const coaches = await teamService.getCoaches();

    return res.json({
      success: true,
      data: coaches,
      message: `Found ${coaches.length} coaches`
    });
  } catch (error: any) {
    console.error('Error fetching coaches:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coaches',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Apply authentication middleware to all routes below
router.use(authMiddleware.verifyToken);

/**
 * GET /api/athletes
 * Get all athletes with full data including contact information (protected endpoint)
 * Returns comprehensive athlete data for IndexedDB storage and profile display
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const athletes = await athleteService.getAthletes({
      active: true,
      competitive_status: 'active'
    });

    return res.json({
      success: true,
      data: athletes,
      message: 'Athlete data retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Athletes API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/athletes/all
 * Get all athletes with USRA category data (admin endpoint)
 * Returns complete athlete data with USRA categories for administrative purposes
 */
router.get('/all', async (req: Request, res: Response) => {
  try {
    const { active, competitive_status } = req.query;
    
    const filters: any = {};
    if (active !== undefined) {
      filters.active = active === 'true';
    }
    if (competitive_status) {
      filters.competitive_status = competitive_status as 'active' | 'inactive' | 'retired' | 'banned';
    }

    const athletes = await athleteService.getAthletes(filters);

    return res.json({
      success: true,
      data: athletes,
      message: 'All athletes with USRA categories retrieved successfully'
    });

  } catch (error) {
    console.error('❌ Athletes API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/athletes/:id
 * Update athlete profile data (protected endpoint)
 * Allows athletes to update their own profile information
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body as any;

    // Validate that id exists
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Athlete ID is required',
        error: 'MISSING_ID'
      });
    }

    // Validate that updateData exists and is an object
    if (!updateData || typeof updateData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid update data provided',
        error: 'INVALID_DATA'
      });
    }

    // Validate that the user is updating their own profile
    const userId = req.user?.athlete_id;
    if (userId !== id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile',
        error: 'FORBIDDEN'
      });
    }

    const updatedAthlete = await athleteService.updateAthleteProfile(id, updateData);

    if (!updatedAthlete) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found',
        error: 'ATHLETE_NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: updatedAthlete,
      message: 'Athlete profile updated successfully'
    });

  } catch (error) {
    console.error('❌ Athletes API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/athletes/:athleteId/teams
 * Get all teams that an athlete belongs to
 */
router.get('/:athleteId/teams', async (req: Request, res: Response) => {
  try {
    const { athleteId } = req.params;

    if (!athleteId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Athlete ID is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const athleteTeams = await teamService.getAthleteTeams(athleteId);

    return res.json({
      success: true,
      data: athleteTeams,
      message: `Found ${athleteTeams.length} teams for athlete`,
      error: null
    });

  } catch (error: any) {
    console.error('Error fetching athlete teams:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch athlete teams',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/athletes/:athleteId/upcoming-sessions
 * Get upcoming practice sessions for an athlete's teams
 */
router.get('/:athleteId/upcoming-sessions', async (req: Request, res: Response) => {
  try {
    const { athleteId } = req.params;
    const { daysAhead = '30' } = req.query;

    if (!athleteId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Athlete ID is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const daysAheadNum = parseInt(daysAhead as string);
    const upcomingSessions = await practiceSessionService.getUpcomingSessionsForAthlete(
      athleteId, 
      isNaN(daysAheadNum) ? 30 : daysAheadNum
    );

    return res.json({
      success: true,
      data: upcomingSessions,
      message: `Found ${upcomingSessions.length} upcoming sessions`,
      error: null
    });

  } catch (error: any) {
    console.error('Error fetching upcoming sessions for athlete:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch upcoming sessions',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/athletes/:athleteId/todays-sessions
 * Get today's practice sessions for an athlete's teams
 */
router.get('/:athleteId/todays-sessions', async (req: Request, res: Response) => {
  try {
    const { athleteId } = req.params;

    if (!athleteId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Athlete ID is required',
        error: 'VALIDATION_ERROR'
      });
    }

    const todaysSessions = await practiceSessionService.getTodaysSessionsForAthlete(athleteId);

    return res.json({
      success: true,
      data: todaysSessions,
      message: `Found ${todaysSessions.length} sessions today`,
      error: null
    });

  } catch (error: any) {
    console.error('Error fetching today\'s sessions for athlete:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch today\'s sessions',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

export default router;
