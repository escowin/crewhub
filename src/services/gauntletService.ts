import { GauntletMatch, GauntletPosition } from '../models';
import { randomUUID } from 'crypto';
import sequelize from '../config/database';

export class GauntletService {
  /**
   * Process a match result and update ladder positions atomically
   * This is the core atomic operation that ensures data consistency
   * Updates both user and challenger lineups' ladder positions
   */
  static async processMatchResult(matchData: {
    match_id: string;
    gauntlet_id: string;
    user_lineup_id: string;
    challenger_lineup_id: string;
    user_wins: number;
    user_losses: number;
    sets: number;
    match_date: Date;
  }, options?: { transaction?: any; match?: GauntletMatch }): Promise<{
    match: GauntletMatch;
    ladderUpdate: {
      userLineup: {
        updatedPosition: GauntletPosition;
      };
      challengerLineup: {
        updatedPosition: GauntletPosition;
      };
    };
  }> {
    const externalTx = options?.transaction;
    const transaction = externalTx || await sequelize.transaction();
    const shouldCommit = !externalTx;
    
    console.log('🔍 GauntletService.processMatchResult: Starting', {
      match_id: matchData.match_id,
      gauntlet_id: matchData.gauntlet_id,
      user_lineup_id: matchData.user_lineup_id,
      challenger_lineup_id: matchData.challenger_lineup_id,
      user_wins: matchData.user_wins,
      user_losses: matchData.user_losses,
      sets: matchData.sets,
      hasExternalTx: !!externalTx,
      hasMatch: !!options?.match
    });
    
    try {
      // 1. No ladder lookup needed - positions now reference gauntlet_id directly
      // Simply use the gauntlet_id from matchData

      // 2. Calculate match result from user's perspective
      const userMatchResult = this.determineMatchResult(
        matchData.user_wins, 
        matchData.user_losses, 
        matchData.sets
      );
      
      // 3. Calculate match result from challenger's perspective (opposite)
      const challengerMatchResult = this.determineMatchResult(
        matchData.user_losses, // Challenger's wins = user's losses
        matchData.user_wins,   // Challenger's losses = user's wins
        matchData.sets
      );

      console.log('📊 GauntletService.processMatchResult: Match results determined', {
        userMatchResult,
        challengerMatchResult
      });

      // 4. Update user lineup's ladder position
      console.log('👤 GauntletService.processMatchResult: Updating user lineup position...');
      const userLineupUpdate = await this.updateLineupLadderPosition(
        matchData.gauntlet_id,
        matchData.user_lineup_id,
        userMatchResult,
        {
          wins: matchData.user_wins,
          losses: matchData.user_losses,
          sets: matchData.sets,
          match_date: matchData.match_date
        },
        transaction
      );
      console.log('✅ GauntletService.processMatchResult: User lineup position updated', {
        position_id: userLineupUpdate.updatedPosition.position_id,
        old_position: userLineupUpdate.updatedPosition.previous_position,
        new_position: userLineupUpdate.updatedPosition.position,
        wins: userLineupUpdate.updatedPosition.wins,
        losses: userLineupUpdate.updatedPosition.losses,
        total_matches: userLineupUpdate.updatedPosition.total_matches,
        points: userLineupUpdate.updatedPosition.points
      });

      // 5. Update challenger lineup's ladder position
      console.log('👥 GauntletService.processMatchResult: Updating challenger lineup position...');
      const challengerLineupUpdate = await this.updateLineupLadderPosition(
        matchData.gauntlet_id,
        matchData.challenger_lineup_id,
        challengerMatchResult,
        {
          wins: matchData.user_losses, // Challenger's wins = user's losses
          losses: matchData.user_wins, // Challenger's losses = user's wins
          sets: matchData.sets,
          match_date: matchData.match_date
        },
        transaction
      );
      console.log('✅ GauntletService.processMatchResult: Challenger lineup position updated', {
        position_id: challengerLineupUpdate.updatedPosition.position_id,
        old_position: challengerLineupUpdate.updatedPosition.previous_position,
        new_position: challengerLineupUpdate.updatedPosition.position,
        wins: challengerLineupUpdate.updatedPosition.wins,
        losses: challengerLineupUpdate.updatedPosition.losses,
        total_matches: challengerLineupUpdate.updatedPosition.total_matches,
        points: challengerLineupUpdate.updatedPosition.points
      });

      // 6. Commit all changes atomically (only if we own the transaction)
      if (shouldCommit) {
        console.log('💾 GauntletService.processMatchResult: Committing transaction (owned by service)...');
        await transaction.commit();
        console.log('✅ GauntletService.processMatchResult: Transaction committed');
      } else {
        console.log('⏸️  GauntletService.processMatchResult: Skipping commit (using external transaction)');
      }
      
      // Use provided match if available, otherwise query for it
      let match: GauntletMatch;
      if (options?.match) {
        console.log('✅ GauntletService.processMatchResult: Using provided match object');
        match = options.match;
      } else {
        console.log('🔍 GauntletService.processMatchResult: Querying for match...');
        const foundMatch = await GauntletMatch.findByPk(matchData.match_id, { transaction });
        if (!foundMatch) {
          console.error('❌ GauntletService.processMatchResult: Match not found!', {
            match_id: matchData.match_id,
            hasTransaction: !!transaction,
            transactionId: (transaction as any)?.id
          });
          throw new Error('Match not found after creation');
        }
        match = foundMatch;
        console.log('✅ GauntletService.processMatchResult: Match found');
      }

      console.log('✅ GauntletService.processMatchResult: Successfully completed');

      return {
        match,
        ladderUpdate: {
          userLineup: userLineupUpdate,
          challengerLineup: challengerLineupUpdate
        }
      };

    } catch (error) {
      console.error('❌ GauntletService.processMatchResult: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        match_id: matchData.match_id,
        shouldCommit,
        hasTransaction: !!transaction
      });
      
      // Rollback all changes if any step fails (only if we own the transaction)
      if (shouldCommit) {
        console.log('🔄 GauntletService.processMatchResult: Rolling back transaction...');
        await transaction.rollback();
        console.log('✅ GauntletService.processMatchResult: Transaction rolled back');
      }
      throw error;
    }
  }

  /**
   * Update a lineup's ladder position
   */
  private static async updateLineupLadderPosition(
    gauntletId: string,
    lineupId: string,
    matchResult: 'match_win' | 'match_loss' | 'match_draw',
    matchStats: {
      wins: number;
      losses: number;
      sets: number;
      match_date: Date;
    },
    transaction: any
  ): Promise<{
    updatedPosition: GauntletPosition;
  }> {
    // Get or create ladder position for the lineup
    let currentPosition = await GauntletPosition.findOne({
      where: {
        gauntlet_id: gauntletId,
        gauntlet_lineup_id: lineupId
      },
      transaction
    });

    if (!currentPosition) {
      console.log('No ladder position found for lineup, creating one...');
      // Get the next available position (highest position + 1)
      const maxPosition = await GauntletPosition.max('position', {
        where: { gauntlet_id: gauntletId },
        transaction
      }) as number | null;
      const nextPosition = (maxPosition || 0) + 1;
      
      currentPosition = await GauntletPosition.create({
        position_id: (currentPosition as any)?.position_id || randomUUID(),
        gauntlet_id: gauntletId,
        gauntlet_lineup_id: lineupId,
        position: nextPosition,
        previous_position: null, // Initial position has no previous
        wins: 0,
        losses: 0,
        draws: 0,
        win_rate: 0.00,
        total_matches: 0,
        points: 0,
        streak_type: 'none',
        streak_count: 0,
        joined_date: new Date(),
        last_updated: new Date()
      }, { transaction });
      console.log('Created new ladder position for lineup at position:', nextPosition);
    }

    // Update ladder position with match statistics
    const updatedPosition = await this.updateLadderPosition(
      currentPosition,
      matchResult,
      matchStats,
      transaction
    );

    return {
      updatedPosition
    };
  }

  private static determineMatchResult(
    wins: number, 
    losses: number, 
    _sets: number
  ): 'match_win' | 'match_loss' | 'match_draw' {
    if (wins > losses) return 'match_win';
    if (losses > wins) return 'match_loss';
    return 'match_draw';
  }

  private static async updateLadderPosition(
    currentPosition: GauntletPosition,
    matchResult: 'match_win' | 'match_loss' | 'match_draw',
    matchStats: {
      wins: number;
      losses: number;
      sets: number;
      match_date: Date;
    },
    transaction: any
  ): Promise<GauntletPosition> {
    console.log('📝 GauntletService.updateLadderPosition: Starting update', {
      position_id: currentPosition.position_id,
      lineup_id: currentPosition.gauntlet_lineup_id,
      current_position: currentPosition.position,
      current_wins: currentPosition.wins,
      current_losses: currentPosition.losses,
      current_total_matches: currentPosition.total_matches,
      current_points: currentPosition.points,
      matchResult,
      matchStats
    });

    // Statistics are recorded per match (not per set)
    const winIncrement = matchResult === 'match_win' ? 1 : 0;
    const lossIncrement = matchResult === 'match_loss' ? 1 : 0;
    const drawIncrement = matchResult === 'match_draw' ? 1 : 0;

    const newWins = currentPosition.wins + winIncrement;
    const newLosses = currentPosition.losses + lossIncrement;
    const newDraws = currentPosition.draws + drawIncrement;
    const newTotalMatches = currentPosition.total_matches + 1;
    const newWinRate = newTotalMatches > 0 ? (newWins / newTotalMatches) * 100 : 0;

    // Points are derived from set wins this match
    const newPoints = currentPosition.points + matchStats.wins;

    console.log('📊 GauntletService.updateLadderPosition: Calculated new stats', {
      winIncrement,
      lossIncrement,
      drawIncrement,
      newWins,
      newLosses,
      newDraws,
      newTotalMatches,
      newWinRate,
      newPoints,
      pointsIncrement: matchStats.wins
    });

    // Update streak information
    const { streakType, streakCount } = this.calculateStreak(
      currentPosition.streak_type,
      currentPosition.streak_count,
      matchResult
    );

    console.log('🔥 GauntletService.updateLadderPosition: Streak calculated', {
      previousStreakType: currentPosition.streak_type,
      previousStreakCount: currentPosition.streak_count,
      newStreakType: streakType,
      newStreakCount: streakCount
    });

    // Calculate new position based on ladder rules
    const oldPosition = currentPosition.position;
    const newPosition = await this.calculateNewPosition(
      currentPosition,
      matchResult,
      currentPosition.gauntlet_id,
      transaction
    );

    console.log('🔄 GauntletService.updateLadderPosition: Position change calculated', {
      oldPosition,
      newPosition,
      positionChanged: oldPosition !== newPosition,
      matchResult
    });

    // Update the position record
    await currentPosition.update({
      previous_position: currentPosition.position,
      position: newPosition,
      wins: newWins,
      losses: newLosses,
      draws: newDraws,
      total_matches: newTotalMatches,
      win_rate: newWinRate,
      points: newPoints,
      streak_type: streakType as 'win' | 'loss' | 'draw' | 'none',
      streak_count: streakCount,
      last_match_date: matchStats.match_date,
      last_updated: new Date()
    }, { transaction });

    console.log('✅ GauntletService.updateLadderPosition: Position updated in database', {
      position_id: currentPosition.position_id,
      previous_position: currentPosition.previous_position,
      position: currentPosition.position,
      wins: currentPosition.wins,
      losses: currentPosition.losses,
      total_matches: currentPosition.total_matches,
      points: currentPosition.points
    });

    return currentPosition;
  }

  private static calculateStreak(
    currentStreakType: string,
    currentStreakCount: number,
    matchResult: 'match_win' | 'match_loss' | 'match_draw'
  ): { streakType: 'win' | 'loss' | 'draw' | 'none'; streakCount: number } {
    // Convert match result to streak type enum value
    const newStreakType: 'win' | 'loss' | 'draw' = 
      matchResult === 'match_win' ? 'win' :
      matchResult === 'match_loss' ? 'loss' : 'draw';
    
    // Compare current streak type with new streak type
    if (currentStreakType === newStreakType) {
      return {
        streakType: newStreakType,
        streakCount: currentStreakCount + 1
      };
    } else {
      return {
        streakType: newStreakType,
        streakCount: 1
      };
    }
  }

  private static async calculateNewPosition(
    currentPosition: GauntletPosition,
    matchResult: 'match_win' | 'match_loss' | 'match_draw',
    gauntletId: string,
    transaction: any
  ): Promise<number> {
    // Get total number of positions in ladder
    const totalPositions = await GauntletPosition.count({
      where: { gauntlet_id: gauntletId },
      transaction
    });

    console.log('🎯 GauntletService.calculateNewPosition: Calculating position change', {
      currentPosition: currentPosition.position,
      matchResult,
      totalPositions,
      canMoveUp: matchResult === 'match_win' && currentPosition.position > 1,
      canMoveDown: matchResult === 'match_loss' && currentPosition.position < totalPositions
    });

    // Simple ladder logic (can be enhanced with more complex rules)
    let newPosition: number;
    if (matchResult === 'match_win' && (currentPosition.position) > 1) {
      // Move up one position
      newPosition = (currentPosition.position) - 1;
      console.log('⬆️  GauntletService.calculateNewPosition: Moving UP', {
        from: currentPosition.position,
        to: newPosition
      });
      return newPosition;
    } else if (matchResult === 'match_loss' && (currentPosition.position) < totalPositions) {
      // Move down one position
      newPosition = (currentPosition.position) + 1;
      console.log('⬇️  GauntletService.calculateNewPosition: Moving DOWN', {
        from: currentPosition.position,
        to: newPosition
      });
      return newPosition;
    }
    
    // No change for draws or if already at top/bottom
    console.log('➡️  GauntletService.calculateNewPosition: No position change', {
      reason: matchResult === 'match_draw' ? 'draw' : 
              matchResult === 'match_win' && currentPosition.position === 1 ? 'already at top' :
              matchResult === 'match_loss' && currentPosition.position === totalPositions ? 'already at bottom' : 'unknown',
      currentPosition: currentPosition.position,
      matchResult
    });
    return currentPosition.position;
  }

}
