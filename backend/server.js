import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";

import chatRoutes from "./routes/chatRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    credentials: true
  })
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const port = Number(process.env.PORT || 5000);

connectDB().catch(() => {
  // keep process alive for nodemon to show logs; exit non-zero for prod
  process.exitCode = 1;
});

// Auth routes
app.use("/api/auth", authRoutes);

// Chat routes
app.use("/api", chatRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`Server running on ${port}`);
});