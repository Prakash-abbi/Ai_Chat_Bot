import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token) {
  if (!token) localStorage.removeItem("token");
  else localStorage.setItem("token", token);
}

const client = axios.create({
  baseURL: API_BASE_URL
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function register({ email, password }) {
  const res = await client.post("/auth/register", {
    email,
    password
  });
  return res.data;
}

export async function login({ email, password }) {
  const res = await client.post("/auth/login", {
    email,
    password
  });
  return res.data;
}

export async function listChats() {
  const res = await client.get("/chats");
  return res.data;
}

export async function createChat({ title } = {}) {
  const res = await client.post("/chats", { title });
  return res.data;
}

export async function getChat(chatId) {
  const res = await client.get(`/chats/${chatId}`);
  return res.data;
}

export async function renameChat(chatId, title) {
  const res = await client.patch(`/chats/${chatId}`, { title });
  return res.data;
}

export async function deleteChat(chatId) {
  const res = await client.delete(`/chats/${chatId}`);
  return res.data;
}

export async function uploadFilesToChat(chatId, files) {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const res = await client.post(`/chats/${chatId}/files`, form, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data;
}

export async function sendMessageToChat(chatId, message) {
  const res = await client.post(`/chats/${chatId}/messages`, { message });
  return res.data;
}

export async function streamMessageToChat(
  chatId,
  message,
  { onDelta, onDone, onError } = {}
) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/chats/${chatId}/messages/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ message })
  });

  if (!res.ok) {
    let details = "";
    try {
      details = await res.text();
    } catch {
      // ignore
    }
    throw new Error(details || `Request failed (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming not supported in this browser");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const idx = buffer.indexOf("\n\n");
      if (idx === -1) break;
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = rawEvent.split("\n").filter(Boolean);
      let eventName = "message";
      let dataLine = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }

      if (eventName === "error") {
        try {
          const payload = JSON.parse(dataLine || "{}");
          onError?.(payload);
        } catch {
          onError?.({ error: dataLine || "error" });
        }
        return;
      }

      if (eventName === "done") {
        try {
          const payload = JSON.parse(dataLine || "{}");
          onDone?.(payload);
        } catch {
          onDone?.({ message: "" });
        }
        return;
      }

      if (dataLine) {
        try {
          const payload = JSON.parse(dataLine);
          if (payload?.delta) onDelta?.(payload.delta);
        } catch {
          // ignore
        }
      }
    }
  }
}

