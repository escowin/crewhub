// routes entry point
import { Router } from 'express';
import athleteRoutes from './athletes';
import attendanceRoutes from './attendance';
import boatRoutes from './boats';
import gauntletRoutes from './gauntlets';
import gauntletMatchRoutes from './gauntletMatches';
import ladderRoutes from './ladders';
import ladderPositionRoutes from './ladderPositions';
import lineupRoutes from './lineups';
import practiceSessionRoutes from './practiceSessions';

const router = Router();

// Mount all route modules
router.use('/athletes', athleteRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/boats', boatRoutes);
router.use('/gauntlets', gauntletRoutes);
router.use('/gauntlet-matches', gauntletMatchRoutes);
router.use('/ladders', ladderRoutes);
router.use('/ladder-positions', ladderPositionRoutes);
router.use('/lineups', lineupRoutes);
router.use('/practice-sessions', practiceSessionRoutes);

export { router as apiRoutes };
