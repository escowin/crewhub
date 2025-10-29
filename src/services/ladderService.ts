import { GauntletMatch, LadderPosition, LadderProgression, Ladder } from '../models';
import { randomUUID } from 'crypto';
import sequelize from '../config/database';

export class LadderService {
  /**
   * Process a match result and update ladder positions/progressions atomically
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
  }): Promise<{
    match: GauntletMatch;
    ladderUpdate: {
      userLineup: {
        updatedPosition: LadderPosition;
        progression?: LadderProgression;
      };
      challengerLineup: {
        updatedPosition: LadderPosition;
        progression?: LadderProgression;
      };
    };
  }> {
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Get or create the ladder for this gauntlet
      let ladder = await Ladder.findOne({
        where: { gauntlet_id: matchData.gauntlet_id },
        transaction
      });
      
      if (!ladder) {
        console.log('No ladder found for gauntlet, creating one...');
        ladder = await Ladder.create({
          ladder_id: randomUUID(),
          gauntlet_id: matchData.gauntlet_id
        }, { transaction });
        console.log('Created new ladder:', ladder.ladder_id);
      }

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

      // 4. Update user lineup's ladder position
      const userLineupUpdate = await this.updateLineupLadderPosition(
        ladder.ladder_id,
        matchData.user_lineup_id,
        userMatchResult,
        {
          wins: matchData.user_wins,
          losses: matchData.user_losses,
          sets: matchData.sets,
          match_date: matchData.match_date
        },
        matchData.match_id,
        transaction
      );

      // 5. Update challenger lineup's ladder position
      const challengerLineupUpdate = await this.updateLineupLadderPosition(
        ladder.ladder_id,
        matchData.challenger_lineup_id,
        challengerMatchResult,
        {
          wins: matchData.user_losses, // Challenger's wins = user's losses
          losses: matchData.user_wins, // Challenger's losses = user's wins
          sets: matchData.sets,
          match_date: matchData.match_date
        },
        matchData.match_id,
        transaction
      );

      // 6. Commit all changes atomically
      await transaction.commit();
      
      const match = await GauntletMatch.findByPk(matchData.match_id);
      if (!match) {
        throw new Error('Match not found after creation');
      }

      return {
        match,
        ladderUpdate: {
          userLineup: userLineupUpdate,
          challengerLineup: challengerLineupUpdate
        }
      };

    } catch (error) {
      // Rollback all changes if any step fails
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Update a lineup's ladder position and create progression if needed
   */
  private static async updateLineupLadderPosition(
    ladderId: string,
    lineupId: string,
    matchResult: 'match_win' | 'match_loss' | 'match_draw',
    matchStats: {
      wins: number;
      losses: number;
      sets: number;
      match_date: Date;
    },
    matchId: string,
    transaction: any
  ): Promise<{
    updatedPosition: LadderPosition;
    progression?: LadderProgression;
  }> {
    // Get or create ladder position for the lineup
    let currentPosition = await LadderPosition.findOne({
      where: {
        ladder_id: ladderId,
        gauntlet_lineup_id: lineupId
      },
      transaction
    });

    if (!currentPosition) {
      console.log('No ladder position found for lineup, creating one...');
      // Get the next available position (highest position + 1)
      const maxPosition = await LadderPosition.max('position', {
        where: { ladder_id: ladderId },
        transaction
      }) as number | null;
      const nextPosition = (maxPosition || 0) + 1;
      
      currentPosition = await LadderPosition.create({
        position_id: randomUUID(),
        ladder_id: ladderId,
        gauntlet_lineup_id: lineupId,
        position: nextPosition,
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

    // Create ladder progression record if position changed
    let progression: LadderProgression | undefined = undefined;
    if (updatedPosition.position !== currentPosition.position) {
      progression = await this.createLadderProgression(
        ladderId,
        lineupId,
        currentPosition.position,
        updatedPosition.position,
        matchResult,
        matchId,
        transaction
      );
    }

    const result: {
      updatedPosition: LadderPosition;
      progression?: LadderProgression;
    } = {
      updatedPosition
    };
    
    if (progression) {
      result.progression = progression;
    }
    
    return result;
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
    currentPosition: LadderPosition,
    matchResult: 'match_win' | 'match_loss' | 'match_draw',
    matchStats: {
      wins: number;
      losses: number;
      sets: number;
      match_date: Date;
    },
    transaction: any
  ): Promise<LadderPosition> {
    // Calculate new statistics
    const draws = matchStats.sets - matchStats.wins - matchStats.losses;
    const newWins = currentPosition.wins + matchStats.wins;
    const newLosses = currentPosition.losses + matchStats.losses;
    const newDraws = currentPosition.draws + draws;
    const newTotalMatches = newWins + newLosses + newDraws;
    const newWinRate = newTotalMatches > 0 ? (newWins / newTotalMatches) * 100 : 0;

    // Update streak information
    const { streakType, streakCount } = this.calculateStreak(
      currentPosition.streak_type,
      currentPosition.streak_count,
      matchResult
    );

    // Calculate new position based on ladder rules
    const newPosition = await this.calculateNewPosition(
      currentPosition,
      matchResult,
      currentPosition.ladder_id,
      transaction
    );

    // Update the position record
    await currentPosition.update({
      previous_position: currentPosition.position,
      position: newPosition,
      wins: newWins,
      losses: newLosses,
      draws: newDraws,
      total_matches: newTotalMatches,
      win_rate: newWinRate,
      streak_type: streakType as 'win' | 'loss' | 'draw' | 'none',
      streak_count: streakCount,
      last_match_date: matchStats.match_date,
      last_updated: new Date()
    }, { transaction });

    return currentPosition;
  }

  private static calculateStreak(
    currentStreakType: string,
    currentStreakCount: number,
    matchResult: 'match_win' | 'match_loss' | 'match_draw'
  ): { streakType: string; streakCount: number } {
    if (currentStreakType === matchResult) {
      return {
        streakType: matchResult,
        streakCount: currentStreakCount + 1
      };
    } else {
      return {
        streakType: matchResult,
        streakCount: 1
      };
    }
  }

  private static async calculateNewPosition(
    currentPosition: LadderPosition,
    matchResult: 'match_win' | 'match_loss' | 'match_draw',
    ladderId: string,
    transaction: any
  ): Promise<number> {
    // Get total number of positions in ladder
    const totalPositions = await LadderPosition.count({
      where: { ladder_id: ladderId },
      transaction
    });

    // Simple ladder logic (can be enhanced with more complex rules)
    if (matchResult === 'match_win' && (currentPosition.position) > 1) {
      // Move up one position
      return (currentPosition.position) - 1;
    } else if (matchResult === 'match_loss' && (currentPosition.position) < totalPositions) {
      // Move down one position
      return (currentPosition.position) + 1;
    }
    
    // No change for draws or if already at top/bottom
    return currentPosition.position;
  }

  private static async createLadderProgression(
    ladderId: string,
    lineupId: string,
    fromPosition: number,
    toPosition: number,
    reason: 'match_win' | 'match_loss' | 'match_draw',
    matchId: string,
    transaction: any
  ): Promise<LadderProgression> {
    return await LadderProgression.create({
      progression_id: randomUUID(),
      ladder_id: ladderId,
      gauntlet_lineup_id: lineupId,
      from_position: fromPosition,
      to_position: toPosition,
      change: toPosition - fromPosition,
      reason: reason === 'match_win' ? 'match_win' : reason === 'match_loss' ? 'match_loss' : 'match_draw',
      match_id: matchId,
      date: new Date()
    }, { transaction });
  }
}
