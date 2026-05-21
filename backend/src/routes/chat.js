import { Router } from 'express';
import { chatController, getChatHistoryController } from '../controllers/chatController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/history', requireAuth, getChatHistoryController);
router.post('/', requireAuth, chatController);

export default router;
