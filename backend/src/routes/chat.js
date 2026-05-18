import { Router } from 'express';
import { chatController } from '../controllers/chatController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/', requireAuth, chatController);

export default router;
