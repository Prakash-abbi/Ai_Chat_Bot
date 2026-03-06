import express from "express";
import multer from "multer";
import {
  createChat,
  deleteChat,
  getChat,
  listChats,
  renameChat,
  sendMessage,
  sendMessageToChat,
  streamMessageToChat,
  uploadFilesToChat
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per file
});

router.post("/chat", protect, sendMessage);
router.get("/chats", protect, listChats);
router.post("/chats", protect, createChat);
router.get("/chats/:chatId", protect, getChat);
router.patch("/chats/:chatId", protect, renameChat);
router.delete("/chats/:chatId", protect, deleteChat);
router.post("/chats/:chatId/messages", protect, sendMessageToChat);
router.post("/chats/:chatId/messages/stream", protect, streamMessageToChat);
router.post("/chats/:chatId/files", protect, upload.array("files", 5), uploadFilesToChat);

export default router;