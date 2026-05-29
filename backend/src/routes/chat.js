import { Router } from 'express';
import { chatController, getChatHistoryController, getLatestRiskAssessmentController } from '../controllers/chatController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/history', requireAuth, getChatHistoryController);
router.get('/risk/latest', getLatestRiskAssessmentController);
router.post('/', requireAuth, chatController);

export default router;
