import { Router } from "express";
import {
  chatController,
  deleteChatHistoryController,
  getChatHistoryController,
  getLatestRiskAssessmentController,
} from "../controllers/chatController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/history", requireAuth, getChatHistoryController);
router.delete("/history", requireAuth, deleteChatHistoryController);
router.get("/risk/latest", getLatestRiskAssessmentController);
router.post("/", requireAuth, chatController);

export default router;
