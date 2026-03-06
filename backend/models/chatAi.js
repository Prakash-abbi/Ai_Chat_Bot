import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["system", "user", "assistant"], required: true },
    content: { type: String, required: true },
    attachments: {
      type: [
        {
          name: String,
          mime: String,
          size: Number,
          storagePath: String,
          extractedText: String
        }
      ],
      default: []
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New chat" },
    messages: { type: [messageSchema], default: [] }
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);