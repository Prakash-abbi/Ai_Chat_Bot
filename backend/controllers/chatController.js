import OpenAI from "openai";
import Chat from "../models/chatAi.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

function getLLMClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const baseURL =
    process.env.OPENAI_BASE_URL ||
    (process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : undefined);

  return new OpenAI({
    apiKey,
    baseURL
  });
}

function getModel() {
  return (
    process.env.OPENAI_MODEL ||
    (process.env.OPENROUTER_API_KEY ? "openai/gpt-4o-mini" : "gpt-4o-mini")
  );
}

async function generateAssistantReply({ messages }) {
  const openai = getLLMClient();
  if (!openai) {
    const err = new Error(
      "Missing AI credentials. Set OPENAI_API_KEY (OpenAI) or OPENROUTER_API_KEY (OpenRouter) in backend/.env"
    );
    err.statusCode = 500;
    throw err;
  }

  const response = await openai.chat.completions.create({
    model: getModel(),
    messages
  });

  return response?.choices?.[0]?.message?.content || "";
}

function messageToPrompt(m) {
  let content = m.content || "";
  const atts = Array.isArray(m.attachments) ? m.attachments : [];
  const withText = atts.filter((a) => a?.extractedText);
  if (withText.length) {
    content += "\n\nAttached files:\n";
    for (const a of withText) {
      const snippet = String(a.extractedText).slice(0, 50_000);
      content += `\n[${a.name || "file"}]\n${snippet}\n`;
    }
  }
  return { role: m.role, content };
}

export const listChats = async (req, res) => {
  const chats = await Chat.find({ userId: req.user.id })
    .select("_id title updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .lean();

  res.json({
    chats: chats.map((c) => ({
      id: String(c._id),
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }))
  });
};

export const createChat = async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title : "New chat";
  const chat = await Chat.create({ userId: req.user.id, title, messages: [] });
  res.status(201).json({ id: String(chat._id), title: chat.title });
};

export const getChat = async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user.id }).lean();
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  res.json({
    id: String(chat._id),
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messages: (chat.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt
    }))
  });
};

export const renameChat = async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "title is required" });

  const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user.id });
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  chat.title = title.slice(0, 120);
  await chat.save();
  res.json({ id: String(chat._id), title: chat.title });
};

export const deleteChat = async (req, res) => {
  const deleted = await Chat.findOneAndDelete({ _id: req.params.chatId, userId: req.user.id });
  if (!deleted) return res.status(404).json({ error: "Chat not found" });
  res.json({ ok: true });
};

export const sendMessageToChat = async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user.id });
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  chat.messages.push({ role: "user", content: message });

  try {
    const history = chat.messages.map(messageToPrompt);
    const reply = await generateAssistantReply({ messages: history });
    chat.messages.push({ role: "assistant", content: reply });

    // basic auto-title (first user message)
    if (chat.title === "New chat") {
      const firstUser = chat.messages.find((m) => m.role === "user")?.content || "";
      chat.title = firstUser.slice(0, 40) || "New chat";
    }

    await chat.save();
    res.json({ message: reply });
  } catch (err) {
    const status = err?.statusCode || 502;
    res.status(status).json({ error: err?.message || "AI request failed" });
  }
};

export const streamMessageToChat = async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const openai = getLLMClient();
  if (!openai) {
    return res.status(500).json({
      error:
        "Missing AI credentials. Set OPENAI_API_KEY (OpenAI) or OPENROUTER_API_KEY (OpenRouter) in backend/.env"
    });
  }

  const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user.id });
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  chat.messages.push({ role: "user", content: message });
  await chat.save();

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  let full = "";
  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  try {
    const history = chat.messages.map(messageToPrompt);

    const stream = await openai.chat.completions.create({
      model: getModel(),
      messages: history,
      stream: true
    });

    for await (const chunk of stream) {
      if (closed) break;
      const delta = chunk?.choices?.[0]?.delta?.content || "";
      if (!delta) continue;
      full += delta;
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }

    if (!closed) {
      chat.messages.push({ role: "assistant", content: full });
      if (chat.title === "New chat") {
        const firstUser = chat.messages.find((m) => m.role === "user")?.content || "";
        chat.title = firstUser.slice(0, 40) || "New chat";
      }
      await chat.save();
      res.write(`event: done\ndata: ${JSON.stringify({ message: full })}\n\n`);
      res.end();
    }
  } catch (err) {
    if (!closed) {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          error: err?.message || "AI request failed"
        })}\n\n`
      );
      res.end();
    }
  }
};

export const uploadFilesToChat = async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user.id });
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ error: "No files uploaded" });

  const userDir = path.join(process.cwd(), "uploads", String(req.user.id));
  await fs.mkdir(userDir, { recursive: true });

  const attachments = [];
  for (const f of files) {
    const id = crypto.randomUUID();
    const safeName = String(f.originalname || "file").replace(/[^\w.\- ()]/g, "_");
    const filename = `${id}_${safeName}`;
    const storagePath = path.join(userDir, filename);
    await fs.writeFile(storagePath, f.buffer);

    // Basic text extraction for common text files
    let extractedText = "";
    const mime = f.mimetype || "";
    const isText =
      mime.startsWith("text/") ||
      ["application/json", "application/xml", "application/javascript"].includes(mime);
    if (isText) {
      extractedText = f.buffer.toString("utf8").slice(0, 200_000);
    }

    attachments.push({
      name: safeName,
      mime,
      size: f.size,
      storagePath,
      extractedText
    });
  }

  // Store a "user" message noting the upload (so history preserves it)
  chat.messages.push({
    role: "user",
    content: `Uploaded ${attachments.length} file(s).`,
    attachments
  });
  await chat.save();

  res.status(201).json({
    attachments: attachments.map((a) => ({
      name: a.name,
      mime: a.mime,
      size: a.size,
      hasText: Boolean(a.extractedText)
    }))
  });
};

// Backward compatible endpoint: create a chat + send first message
export const sendMessage = async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const chat = await Chat.create({ userId: req.user.id, title: "New chat", messages: [] });
  req.params.chatId = String(chat._id);
  return sendMessageToChat(req, res);
};