import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { GauntletPosition, GauntletLineup, Gauntlet } from '../models';
import { authMiddleware } from '../auth/middleware';

const router = Router();

/**
 * POST /api/gauntlet-positions
 * Create a new ladder position
 */
router.post('/', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      position_id,
      gauntlet_id,
      gauntlet_lineup_id,
      position,
      previous_position,
      wins = 0,
      losses = 0,
      draws = 0,
      win_rate = 0,
      total_matches = 0,
      points = 0,
      streak_type = 'none',
      streak_count = 0,
      last_match_date,
      joined_date
    } = req.body;

    // Validate required fields
    if (!gauntlet_id || !gauntlet_lineup_id || position === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing required fields: gauntlet_id, gauntlet_lineup_id, position',
        error: 'VALIDATION_ERROR'
      });
    }

    // Check if gauntlet exists
    const gauntlet = await Gauntlet.findByPk(gauntlet_id);
    if (!gauntlet) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Gauntlet not found',
        error: 'NOT_FOUND'
      });
    }

    // Check if gauntlet lineup exists
    const lineup = await GauntletLineup.findByPk(gauntlet_lineup_id);
    if (!lineup) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Gauntlet lineup not found',
        error: 'NOT_FOUND'
      });
    }

    // Validate position
    if (position < 1) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Position must be at least 1',
        error: 'VALIDATION_ERROR'
      });
    }

    // Validate streak type
    const validStreakTypes = ['win', 'loss', 'draw', 'none'];
    if (!validStreakTypes.includes(streak_type)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Invalid streak_type. Must be one of: ${validStreakTypes.join(', ')}`,
        error: 'VALIDATION_ERROR'
      });
    }

    // Check if gauntlet lineup already has a position in this gauntlet
    const existingPosition = await GauntletPosition.findOne({
      where: {
        gauntlet_id,
        gauntlet_lineup_id
      }
    });

    if (existingPosition) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Gauntlet lineup already has a position in this gauntlet',
        error: 'DUPLICATE_ERROR'
      });
    }

    // Create ladder position
    const ladderPosition = await GauntletPosition.create({
      position_id: position_id || randomUUID(), // Accept client UUID or generate
      gauntlet_id,
      gauntlet_lineup_id,
      position,
      previous_position,
      wins,
      losses,
      draws,
      win_rate,
      total_matches,
      points,
      streak_type,
      streak_count,
      last_match_date,
      joined_date: joined_date || new Date().toISOString().split('T')[0]
    });

    // Fetch the created position with associations
    const createdPosition = await GauntletPosition.findByPk(ladderPosition.position_id, {
      include: [
        {
          model: GauntletLineup,
          as: 'lineup',
          attributes: ['athlete_id', 'name', 'email']
        },
        {
          model: Gauntlet,
          as: 'gauntlet'
        }
      ]
    });

    return res.status(201).json({
      success: true,
      data: createdPosition,
      message: 'Ladder position created successfully',
      error: null
    });

  } catch (error: any) {
    console.error('Error creating ladder position:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to create ladder position',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/gauntlet-positions/:id
 * Update a ladder position
 */
router.put('/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const position = await GauntletPosition.findByPk(id);
    if (!position) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Ladder position not found',
        error: 'NOT_FOUND'
      });
    }

    // Validate position if provided
    if (updates.position !== undefined && updates.position < 1) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Position must be at least 1',
        error: 'VALIDATION_ERROR'
      });
    }

    // Validate streak type if provided
    if (updates.streak_type) {
      const validStreakTypes = ['win', 'loss', 'draw', 'none'];
      if (!validStreakTypes.includes(updates.streak_type)) {
        return res.status(400).json({
          success: false,
          data: null,
          message: `Invalid streak_type. Must be one of: ${validStreakTypes.join(', ')}`,
          error: 'VALIDATION_ERROR'
        });
      }
    }

    await position.update(updates);

    // Fetch updated position with associations
    const updatedPosition = await GauntletPosition.findByPk(id, {
      include: [
        {
          model: GauntletLineup,
          as: 'lineup',
          attributes: ['gauntlet_lineup_id', 'is_user_lineup']
        },
        {
          model: Gauntlet,
          as: 'gauntlet'
        }
      ]
    });

    return res.json({
      success: true,
      data: updatedPosition,
      message: 'Ladder position updated successfully',
      error: null
    });

  } catch (error: any) {
    console.error('Error updating ladder position:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to update ladder position',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

export default router;
