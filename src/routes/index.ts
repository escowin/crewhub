// routes entry point
import { Router } from 'express';
import athleteRoutes from './athletes';
import attendanceRoutes from './attendance';
import boatRoutes from './boats';
import challengeRoutes from './challenges';
import gauntletRoutes from './gauntlets';
import gauntletMatchRoutes from './gauntletMatches';
import ladderPositionRoutes from './gauntletPositions';
import lineupRoutes from './lineups';
import practiceSessionRoutes from './practiceSessions';
import teamRoutes from './teams';

const router = Router();

// Mount all route modules
router.use('/athletes', athleteRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/boats', boatRoutes);
router.use('/challenges', challengeRoutes);
router.use('/gauntlets', gauntletRoutes);
router.use('/gauntlet-matches', gauntletMatchRoutes);
router.use('/gauntlet-positions', ladderPositionRoutes);
router.use('/lineups', lineupRoutes);
router.use('/practice-sessions', practiceSessionRoutes);
router.use('/teams', teamRoutes);

export { router as apiRoutes };
