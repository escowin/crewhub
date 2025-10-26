import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/middleware';
import { athleteService } from '../services';

const router = Router();

// Apply authentication middleware to all routes
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

export default router;
