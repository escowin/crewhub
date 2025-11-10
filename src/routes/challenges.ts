import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/middleware';
import { challengeService } from '../services/challengeService';

const router = Router();

/**
 * GET /api/challenges
 * Get all challenges
 */
router.get('/', authMiddleware.verifyToken, async (_req: Request, res: Response) => {
  try {
    const challenges = await challengeService.getAllChallenges();

    return res.json({
      success: true,
      data: challenges,
      message: `Found ${challenges.length} challenges`,
      error: null
    });
  } catch (error: any) {
    console.error('Error fetching challenges:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch challenges',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/challenges/:id
 * Get a specific challenge by ID
 */
router.get('/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Challenge ID is required',
        error: 'MISSING_PARAMS'
      });
    }
    
    const challengeId = parseInt(id);

    if (isNaN(challengeId)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid challenge ID',
        error: 'INVALID_ID'
      });
    }

    const challenge = await challengeService.getChallengeById(challengeId);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Challenge not found',
        error: 'NOT_FOUND'
      });
    }

    return res.json({
      success: true,
      data: challenge,
      message: 'Challenge found',
      error: null
    });
  } catch (error: any) {
    console.error('Error fetching challenge:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch challenge',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/challenges/leaderboards
 * Get leaderboard entries
 * Query params: distanceMeters, boatType, startDate (optional), endDate (optional), limit (optional)
 */
router.get('/leaderboards', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { distanceMeters, boatType, startDate, endDate, limit } = req.query;

    if (!distanceMeters || !boatType) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'distanceMeters and boatType are required',
        error: 'MISSING_PARAMS'
      });
    }

    const distanceMetersNum = parseInt(distanceMeters as string);
    if (isNaN(distanceMetersNum)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid distanceMeters',
        error: 'INVALID_PARAMS'
      });
    }

    const startDateObj = startDate ? new Date(startDate as string) : undefined;
    const endDateObj = endDate ? new Date(endDate as string) : undefined;
    const limitNum = limit ? parseInt(limit as string) : undefined;

    // Validate date range if provided
    if (startDateObj && endDateObj && startDateObj > endDateObj) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'startDate must be before endDate',
        error: 'INVALID_DATE_RANGE'
      });
    }

    const leaderboardParams: {
      distanceMeters: number;
      boatType: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {
      distanceMeters: distanceMetersNum,
      boatType: boatType as string
    };

    if (startDateObj) {
      leaderboardParams.startDate = startDateObj;
    }

    if (endDateObj) {
      leaderboardParams.endDate = endDateObj;
    }

    if (limitNum) {
      leaderboardParams.limit = limitNum;
    }

    const leaderboard = await challengeService.getLeaderboard(leaderboardParams);

    return res.json({
      success: true,
      data: leaderboard,
      message: `Found ${leaderboard.length} leaderboard entries`,
      error: null
    });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch leaderboard',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/challenges/saved-lineups
 * Get user's saved lineups
 * Query params: challengeId (optional), boatType (optional) - for filtering
 */
router.get('/saved-lineups', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const athleteId = req.user?.athlete_id;
    if (!athleteId) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Athlete ID required',
        error: 'UNAUTHORIZED'
      });
    }

    const { challengeId, boatType } = req.query;

    let savedLineups;

    if (challengeId && boatType) {
      // Get lineups from other challenges (for reusing)
      const challengeIdNum = parseInt(challengeId as string);
      if (isNaN(challengeIdNum)) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'Invalid challengeId',
          error: 'INVALID_PARAMS'
        });
      }

      savedLineups = await challengeService.getSavedLineupsFromOtherChallenges(
        athleteId,
        challengeIdNum,
        boatType as string
      );
    } else {
      // Get all user's saved lineups
      savedLineups = await challengeService.getUserSavedLineups(athleteId);
    }

    return res.json({
      success: true,
      data: savedLineups,
      message: `Found ${savedLineups.length} saved lineups`,
      error: null
    });
  } catch (error: any) {
    console.error('Error fetching saved lineups:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch saved lineups',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/challenges/saved-lineups
 * Create a new saved lineup
 */
router.post('/saved-lineups', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const athleteId = req.user?.athlete_id;
    if (!athleteId) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Athlete ID required',
        error: 'UNAUTHORIZED'
      });
    }

    const {
      saved_lineup_id,
      boat_id,
      lineup_name,
      team_id,
      seat_assignments
    } = req.body;

    if (!saved_lineup_id || !boat_id || !seat_assignments || !Array.isArray(seat_assignments)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'saved_lineup_id, boat_id, and seat_assignments are required',
        error: 'MISSING_PARAMS'
      });
    }

    if (seat_assignments.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'seat_assignments cannot be empty',
        error: 'INVALID_PARAMS'
      });
    }

    const savedLineup = await challengeService.createSavedLineup({
      saved_lineup_id,
      boat_id,
      lineup_name,
      team_id,
      created_by: athleteId,
      seat_assignments
    });

    return res.status(201).json({
      success: true,
      data: savedLineup,
      message: 'Saved lineup created successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error creating saved lineup:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to create saved lineup',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/challenges/lineups
 * Link a saved lineup to a challenge
 */
router.post('/lineups', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      challenge_lineup_id,
      challenge_id,
      saved_lineup_id
    } = req.body;

    if (!challenge_lineup_id || !challenge_id || !saved_lineup_id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'challenge_lineup_id, challenge_id, and saved_lineup_id are required',
        error: 'MISSING_PARAMS'
      });
    }

    const challengeIdNum = parseInt(challenge_id);
    if (isNaN(challengeIdNum)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid challenge_id',
        error: 'INVALID_PARAMS'
      });
    }

    const challengeLineup = await challengeService.linkLineupToChallenge({
      challenge_lineup_id,
      challenge_id: challengeIdNum,
      saved_lineup_id
    });

    return res.status(201).json({
      success: true,
      data: challengeLineup,
      message: 'Lineup linked to challenge successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error linking lineup to challenge:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to link lineup to challenge',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/challenges/entries/:lineupId
 * Get all entries for a specific lineup (history view)
 */
router.get('/entries/:lineupId', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { lineupId } = req.params;

    if (!lineupId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Lineup ID is required',
        error: 'MISSING_PARAMS'
      });
    }

    const entries = await challengeService.getLineupEntries(lineupId);

    return res.json({
      success: true,
      data: entries,
      message: `Found ${entries.length} entries for lineup`,
      error: null
    });
  } catch (error: any) {
    console.error('Error fetching lineup entries:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch lineup entries',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/challenges/entries
 * Create a new challenge entry
 */
router.post('/entries', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      challenge_entry_id,
      lineup_id,
      time_seconds,
      stroke_rate,
      split_seconds,
      entry_date,
      entry_time,
      notes,
      conditions
    } = req.body;

    if (!challenge_entry_id || !lineup_id || time_seconds === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'challenge_entry_id, lineup_id, and time_seconds are required',
        error: 'MISSING_PARAMS'
      });
    }

    if (time_seconds < 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'time_seconds must be non-negative',
        error: 'INVALID_PARAMS'
      });
    }

    const entryData: {
      challenge_entry_id: string;
      lineup_id: string;
      time_seconds: number;
      stroke_rate?: number;
      split_seconds?: number;
      entry_date?: Date;
      entry_time?: Date;
      notes?: string;
      conditions?: string;
    } = {
      challenge_entry_id,
      lineup_id,
      time_seconds
    };

    if (stroke_rate !== undefined) {
      entryData.stroke_rate = stroke_rate;
    }

    if (split_seconds !== undefined) {
      entryData.split_seconds = split_seconds;
    }

    if (entry_date) {
      entryData.entry_date = new Date(entry_date);
    }

    if (entry_time) {
      entryData.entry_time = new Date(entry_time);
    }

    if (notes) {
      entryData.notes = notes;
    }

    if (conditions) {
      entryData.conditions = conditions;
    }

    const entry = await challengeService.createChallengeEntry(entryData);

    return res.status(201).json({
      success: true,
      data: entry,
      message: 'Challenge entry created successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error creating challenge entry:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to create challenge entry',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/challenges/analytics/:savedLineupId
 * Get all challenge performances for a saved lineup (analytics)
 */
router.get('/analytics/:savedLineupId', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { savedLineupId } = req.params;

    if (!savedLineupId) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Saved lineup ID is required',
        error: 'MISSING_PARAMS'
      });
    }

    const performances = await challengeService.getLineupPerformanceAcrossChallenges(savedLineupId);

    return res.json({
      success: true,
      data: performances,
      message: `Found ${performances.length} challenge performances`,
      error: null
    });
  } catch (error: any) {
    console.error('Error fetching lineup analytics:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to fetch lineup analytics',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/challenges/:id
 * Update a challenge (admin/coach only)
 */
router.put('/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Challenge ID is required',
        error: 'MISSING_PARAMS'
      });
    }
    
    const challengeId = parseInt(id);
    if (isNaN(challengeId)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid challenge ID',
        error: 'INVALID_ID'
      });
    }

    const { distance_meters, description } = req.body;
    const updateData: { distance_meters?: number; description?: string } = {};

    if (distance_meters !== undefined) {
      if (typeof distance_meters !== 'number' || distance_meters <= 0) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'distance_meters must be a positive number',
          error: 'INVALID_PARAMS'
        });
      }
      updateData.distance_meters = distance_meters;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    const challenge = await challengeService.updateChallenge(challengeId, updateData);

    return res.json({
      success: true,
      data: challenge,
      message: 'Challenge updated successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error updating challenge:', error);
    
    if (error.message === 'Challenge not found') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Challenge not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to update challenge',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/challenges/:id
 * Delete a challenge (admin/coach only)
 */
router.delete('/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Challenge ID is required',
        error: 'MISSING_PARAMS'
      });
    }
    
    const challengeId = parseInt(id);
    if (isNaN(challengeId)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Invalid challenge ID',
        error: 'INVALID_ID'
      });
    }

    await challengeService.deleteChallenge(challengeId);

    return res.json({
      success: true,
      data: null,
      message: 'Challenge deleted successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error deleting challenge:', error);
    
    if (error.message === 'Challenge not found') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Challenge not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to delete challenge',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/challenges/saved-lineups/:id
 * Update a saved lineup (admin/coach only)
 */
router.put('/saved-lineups/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Saved lineup ID is required',
        error: 'MISSING_PARAMS'
      });
    }

    const { lineup_name, boat_id, team_id, is_active } = req.body;
    const updateData: {
      lineup_name?: string;
      boat_id?: string;
      team_id?: number;
      is_active?: boolean;
    } = {};

    if (lineup_name !== undefined) {
      updateData.lineup_name = lineup_name;
    }

    if (boat_id !== undefined) {
      updateData.boat_id = boat_id;
    }

    if (team_id !== undefined) {
      updateData.team_id = team_id;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const savedLineup = await challengeService.updateSavedLineup(id, updateData);

    return res.json({
      success: true,
      data: savedLineup,
      message: 'Saved lineup updated successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error updating saved lineup:', error);
    
    if (error.message === 'Saved lineup not found') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Saved lineup not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to update saved lineup',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/challenges/saved-lineups/:id
 * Delete a saved lineup (soft delete - admin/coach only)
 */
router.delete('/saved-lineups/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Saved lineup ID is required',
        error: 'MISSING_PARAMS'
      });
    }

    await challengeService.deleteSavedLineup(id);

    return res.json({
      success: true,
      data: null,
      message: 'Saved lineup deleted successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error deleting saved lineup:', error);
    
    if (error.message === 'Saved lineup not found') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Saved lineup not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to delete saved lineup',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/challenges/lineups/:id
 * Update a challenge lineup (admin/coach only)
 */
router.put('/lineups/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Challenge lineup ID is required',
        error: 'MISSING_PARAMS'
      });
    }

    const { is_active } = req.body;
    const updateData: { is_active?: boolean } = {};

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    const challengeLineup = await challengeService.updateChallengeLineup(id, updateData);

    return res.json({
      success: true,
      data: challengeLineup,
      message: 'Challenge lineup updated successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error updating challenge lineup:', error);
    
    if (error.message === 'Challenge lineup not found') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Challenge lineup not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to update challenge lineup',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/challenges/lineups/:id
 * Delete a challenge lineup (soft delete - admin/coach only)
 */
router.delete('/lineups/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Challenge lineup ID is required',
        error: 'MISSING_PARAMS'
      });
    }

    await challengeService.deleteChallengeLineup(id);

    return res.json({
      success: true,
      data: null,
      message: 'Challenge lineup deleted successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error deleting challenge lineup:', error);
    
    if (error.message === 'Challenge lineup not found') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Challenge lineup not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to delete challenge lineup',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * PUT /api/challenges/entries/:id
 * Update a challenge entry (admin/coach only)
 */
router.put('/entries/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Challenge entry ID is required',
        error: 'MISSING_PARAMS'
      });
    }

    const {
      time_seconds,
      stroke_rate,
      split_seconds,
      entry_date,
      entry_time,
      notes,
      conditions
    } = req.body;

    const updateData: {
      time_seconds?: number;
      stroke_rate?: number;
      split_seconds?: number;
      entry_date?: Date;
      entry_time?: Date;
      notes?: string;
      conditions?: string;
    } = {};

    if (time_seconds !== undefined) {
      if (time_seconds < 0) {
        return res.status(400).json({
          success: false,
          data: null,
          message: 'time_seconds must be non-negative',
          error: 'INVALID_PARAMS'
        });
      }
      updateData.time_seconds = time_seconds;
    }

    if (stroke_rate !== undefined) {
      updateData.stroke_rate = stroke_rate;
    }

    if (split_seconds !== undefined) {
      updateData.split_seconds = split_seconds;
    }

    if (entry_date !== undefined) {
      updateData.entry_date = new Date(entry_date);
    }

    if (entry_time !== undefined) {
      updateData.entry_time = new Date(entry_time);
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (conditions !== undefined) {
      updateData.conditions = conditions;
    }

    const entry = await challengeService.updateChallengeEntry(id, updateData);

    return res.json({
      success: true,
      data: entry,
      message: 'Challenge entry updated successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error updating challenge entry:', error);
    
    if (error.message === 'Challenge entry not found') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Challenge entry not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to update challenge entry',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/challenges/entries/:id
 * Delete a challenge entry (admin/coach only)
 */
router.delete('/entries/:id', authMiddleware.verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Challenge entry ID is required',
        error: 'MISSING_PARAMS'
      });
    }

    await challengeService.deleteChallengeEntry(id);

    return res.json({
      success: true,
      data: null,
      message: 'Challenge entry deleted successfully',
      error: null
    });
  } catch (error: any) {
    console.error('Error deleting challenge entry:', error);
    
    if (error.message === 'Challenge entry not found') {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'Challenge entry not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to delete challenge entry',
      error: error.message || 'INTERNAL_ERROR'
    });
  }
});

export default router;

