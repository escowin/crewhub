import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { GauntletMatch, Gauntlet } from '../models';
import sequelize from '../config/database';
import { authMiddleware } from '../auth/middleware';
import { GauntletService } from '../services/gauntletService';

const router = Router();

/**
 * POST /api/gauntlet-matches
 * Create a new gauntlet match
 */
router.post('/', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  console.log('🚀 GauntletMatches API: POST / received');
  console.log('📋 GauntletMatches API: Request body:', req.body);
  console.log('👤 GauntletMatches API: User:', req.user);
  
  try {
    const {
      match_id,
      gauntlet_id,
      user_lineup_id,
      challenger_lineup_id,
      workout,
      sets,
      user_wins = 0,
      user_losses = 0,
      match_date,
      notes,
      process_ladder = true, // Flag to trigger ladder updates (default true)
      created_at,
      updated_at
    } = req.body;

    console.log('📊 GauntletMatches API: Extracted data:', {
      match_id,
      gauntlet_id,
      user_lineup_id,
      challenger_lineup_id,
      workout,
      sets,
      user_wins,
      user_losses,
      match_date,
      notes,
      process_ladder
    });

    // Validate lineup IDs
    console.log('👤 GauntletMatches API: User lineup ID:', user_lineup_id);
    console.log('👤 GauntletMatches API: Challenger lineup ID:', challenger_lineup_id);
    
    if (!user_lineup_id || !challenger_lineup_id) {
      console.log('❌ GauntletMatches API: Missing lineup IDs');
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Both user_lineup_id and challenger_lineup_id are required',
        error: 'VALIDATION_ERROR'
      });
    }
    
    // Ensure user and challenger lineups are different
    if (user_lineup_id === challenger_lineup_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'User lineup and challenger lineup must be different',
        error: 'VALIDATION_ERROR'
      });
    }

    // Validate required fields
    console.log('✅ GauntletMatches API: Validating required fields...');
    if (!match_id || !gauntlet_id || !user_lineup_id || !challenger_lineup_id || !workout || !sets || !match_date) {
      console.log('❌ GauntletMatches API: Missing required fields:', {
        match_id: !!match_id,
        gauntlet_id: !!gauntlet_id,
        user_lineup_id: !!user_lineup_id,
        challenger_lineup_id: !!challenger_lineup_id,
        workout: !!workout,
        sets: !!sets,
        match_date: !!match_date
      });
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing required fields: gauntlet_id, user_lineup_id, challenger_lineup_id, workout, sets, match_date',
        error: 'VALIDATION_ERROR'
      });
    }
    console.log('✅ GauntletMatches API: Required fields validation passed');

    // Check if gauntlet exists
    console.log('🔍 GauntletMatches API: Checking if gauntlet exists:', gauntlet_id);
    const gauntlet = await Gauntlet.findByPk(gauntlet_id);
    if (!gauntlet) {
      console.log('❌ GauntletMatches API: Gauntlet not found:', gauntlet_id);
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Gauntlet not found',
        error: 'NOT_FOUND'
      });
    }
    console.log('✅ GauntletMatches API: Gauntlet found:', gauntlet?.gauntlet_id || 'undefined');

    // Validate sets
    if (sets < 1) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Sets must be at least 1',
        error: 'VALIDATION_ERROR'
      });
    }

    // Validate wins/losses
    if (user_wins < 0 || user_losses < 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Wins and losses must be non-negative',
        error: 'VALIDATION_ERROR'
      });
    }

    if (user_wins + user_losses > sets) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Total wins and losses cannot exceed total sets',
        error: 'VALIDATION_ERROR'
      });
    }

    // Create match and process ladder updates in a single transaction for atomicity
    console.log('🏁 GauntletMatches API: Creating match...');
    const tx = await sequelize.transaction();
    let match: GauntletMatch;
    let ladderUpdate = null as any;

    try {
      match = await GauntletMatch.create({
        match_id: match_id || randomUUID(),
        gauntlet_id,
        user_lineup_id,
        challenger_lineup_id,
        workout,
        sets,
        user_wins,
        user_losses,
        match_date,
        notes,
        created_at,
        updated_at
      }, { transaction: tx });

      console.log('✅ GauntletMatches API: Match created successfully:', match.get('match_id'));

      if (process_ladder) {
        console.log('📈 GauntletMatches API: Processing ladder updates...');
        console.log('📊 GauntletMatches API: Match data for ladder processing', {
          match_id: match.get('match_id'),
          user_wins,
          user_losses,
          sets,
          user_lineup_id,
          challenger_lineup_id
        });
        const ladderResult = await GauntletService.processMatchResult({
          match_id: match.get('match_id') as string,
          gauntlet_id: gauntlet_id,
          user_lineup_id: user_lineup_id,
          challenger_lineup_id: challenger_lineup_id,
          user_wins: user_wins,
          user_losses: user_losses,
          sets: sets,
          match_date: new Date(match_date)
        }, { transaction: tx, match: match });

        ladderUpdate = ladderResult.ladderUpdate;
        console.log('✅ GauntletMatches API: Ladder update completed', {
          userPosition: {
            position: ladderUpdate?.userLineup?.updatedPosition?.position,
            previous_position: ladderUpdate?.userLineup?.updatedPosition?.previous_position,
            wins: ladderUpdate?.userLineup?.updatedPosition?.wins,
            losses: ladderUpdate?.userLineup?.updatedPosition?.losses,
            total_matches: ladderUpdate?.userLineup?.updatedPosition?.total_matches
          },
          challengerPosition: {
            position: ladderUpdate?.challengerLineup?.updatedPosition?.position,
            previous_position: ladderUpdate?.challengerLineup?.updatedPosition?.previous_position,
            wins: ladderUpdate?.challengerLineup?.updatedPosition?.wins,
            losses: ladderUpdate?.challengerLineup?.updatedPosition?.losses,
            total_matches: ladderUpdate?.challengerLineup?.updatedPosition?.total_matches
          }
        });
      }

      await tx.commit();
    } catch (txError) {
      await tx.rollback();
      throw txError;
    }

    const responseData = {
      success: true,
      data: {
        match: match.toJSON(),
        ladderUpdate
      },
      message: ladderUpdate 
        ? 'Gauntlet match created and ladder updated successfully'
        : 'Gauntlet match created successfully',
      error: null
    };

    console.log('🎉 GauntletMatches API: Sending success response:', responseData);
    return res.status(201).json(responseData);

  } catch (error: any) {
    console.error('❌ GauntletMatches API: Error creating gauntlet match:', error);
    console.error('❌ GauntletMatches API: Error details:', {
      message: error.message,
      stack: error.stack,
      error
    });
    
    const errorResponse = {
      success: false,
      data: null,
      message: 'Failed to create gauntlet match',
      error: error.message || 'INTERNAL_ERROR'
    };
    
    console.log('❌ GauntletMatches API: Sending error response:', errorResponse);
    return res.status(500).json(errorResponse);
  }
});

/**
 * PUT /api/gauntlet-matches/:id
 * Update a gauntlet match
 */
router.put('/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const match = await GauntletMatch.findByPk(id);
    if (!match) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Gauntlet match not found',
        error: 'NOT_FOUND'
      });
    }

    // Validate sets if provided
    if (updates.sets !== undefined && updates.sets < 1) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Sets must be at least 1',
        error: 'VALIDATION_ERROR'
      });
    }

    // Validate wins/losses if provided
    const wins = updates.user_wins !== undefined ? updates.user_wins : (match.user_wins as number);
    const losses = updates.user_losses !== undefined ? updates.user_losses : (match.user_losses as number);
    const totalSets = updates.sets !== undefined ? updates.sets : (match.sets as number);

    if (wins < 0 || losses < 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Wins and losses must be non-negative',
        error: 'VALIDATION_ERROR'
      });
    }

    if (wins + losses > totalSets) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Total wins and losses cannot exceed total sets',
        error: 'VALIDATION_ERROR'
      });
    }

    await match.update(updates);

    return res.json({
      success: true,
      data: match,
      message: 'Gauntlet match updated successfully',
      error: null
    });

  } catch (error: any) {
    console.error('Error updating gauntlet match:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to update gauntlet match',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/gauntlet-matches/:id
 * Delete a gauntlet match
 */
router.delete('/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const match = await GauntletMatch.findByPk(id);
    if (!match) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Gauntlet match not found',
        error: 'NOT_FOUND'
      });
    }

    await match.destroy();

    return res.json({
      success: true,
      data: { success: true },
      message: 'Gauntlet match deleted successfully',
      error: null
    });

  } catch (error: any) {
    console.error('Error deleting gauntlet match:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to delete gauntlet match',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

export default router;
