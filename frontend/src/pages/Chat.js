import { useEffect, useMemo, useState } from "react";
import {
  createChat,
  getChat,
  listChats,
  deleteChat,
  renameChat,
  streamMessageToChat,
  uploadFilesToChat,
  setToken
} from "../api";
import MessageInput from "../components/MessageInput";
import MarkdownMessage from "../components/MarkdownMessage";

function formatTitle(title) {
  return title && title.trim() ? title : "New chat";
}

export default function Chat({ onLogout }) {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  const refreshChats = async ({ selectFirst } = {}) => {
    setLoadingChats(true);
    setError("");
    try {
      const data = await listChats();
      setChats(data.chats || []);
      if (selectFirst && (data.chats || []).length) {
        setActiveChatId((prev) => prev || data.chats[0].id);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to load chats");
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    refreshChats({ selectFirst: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!activeChatId) {
        setMessages([]);
        return;
      }
      setError("");
      try {
        const data = await getChat(activeChatId);
        setMessages(data.messages || []);
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || "Failed to load chat");
      }
    };
    load();
  }, [activeChatId]);

  const newChat = async () => {
    setError("");
    try {
      const created = await createChat({ title: "New chat" });
      await refreshChats();
      setActiveChatId(created.id);
      setMessages([]);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to create chat");
    }
  };

  const doRename = async (chatId, currentTitle) => {
    const title = window.prompt("Rename chat", currentTitle || "New chat");
    if (!title) return;
    try {
      await renameChat(chatId, title);
      await refreshChats();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to rename");
    }
  };

  const doDelete = async (chatId) => {
    const ok = window.confirm("Delete this chat? This cannot be undone.");
    if (!ok) return;
    try {
      await deleteChat(chatId);
      if (chatId === activeChatId) {
        setActiveChatId(null);
        setMessages([]);
      }
      await refreshChats({ selectFirst: true });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to delete");
    }
  };

  const ensureChat = async () => {
    if (activeChatId) return activeChatId;
    const created = await createChat({ title: "New chat" });
    await refreshChats();
    setActiveChatId(created.id);
    setMessages([]);
    return created.id;
  };

  const onSend = async (text, files = []) => {
    const chatId = await ensureChat();

    setSending(true);
    setError("");
    const hasText = Boolean(text && text.trim());
    const optimistic = hasText
      ? { role: "user", content: text.trim(), createdAt: new Date().toISOString() }
      : null;
    const streamId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const assistantDraft = {
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      _streaming: true,
      _streamId: streamId
    };
    setMessages((prev) => [...prev, ...(optimistic ? [optimistic] : []), assistantDraft]);
    try {
      if (files.length) {
        await uploadFilesToChat(chatId, files);
      }
      if (text && text.trim()) {
        await streamMessageToChat(chatId, text, {
        onDelta: (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const idx = next.findIndex((m) => m?._streamId === streamId);
            if (idx === -1) return prev;
            next[idx] = { ...next[idx], content: (next[idx].content || "") + delta };
            return next;
          });
        },
        onDone: (payload) => {
          setMessages((prev) => {
            const next = [...prev];
            const idx = next.findIndex((m) => m?._streamId === streamId);
            if (idx === -1) return prev;
            next[idx] = {
              role: "assistant",
              content: payload?.message ?? next[idx].content,
              createdAt: next[idx].createdAt
            };
            return next;
          });
        },
        onError: (payload) => {
          setError(payload?.error || "Streaming failed");
        }
        });
      } else {
        setMessages((prev) => prev.filter((m) => m?._streamId !== streamId));
      }
      await refreshChats();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to send");
      setMessages((prev) =>
        prev.filter((m) => (optimistic ? m !== optimistic : true) && m?._streamId !== streamId)
      );
    } finally {
      setSending(false);
    }
  };

  const logout = () => {
    setToken(null);
    onLogout?.();
  };

  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch {
      // ignore
    }
  };

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sidebarTop">
          <button className="secondaryBtn" onClick={newChat}>
            + New chat
          </button>
          <button className="ghostBtn" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="sidebarList">
          {loadingChats ? (
            <div className="muted">Loading…</div>
          ) : chats.length ? (
            chats.map((c) => (
              <button
                key={c.id}
                className={
                  "chatRow" + (c.id === activeChatId ? " chatRowActive" : "")
                }
                onClick={() => setActiveChatId(c.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div className="chatRowTitle">{formatTitle(c.title)}</div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      className="linkBtn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        doRename(c.id, c.title);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="linkBtn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        doDelete(c.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="chatRowMeta">
                  {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ""}
                </div>
              </button>
            ))
          ) : (
            <div className="muted">No chats yet</div>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbarTitle">{formatTitle(activeChat?.title)}</div>
          <div className="topbarMeta">{error ? <span className="error">{error}</span> : null}</div>
        </div>

        <div className="chatBody">
          {messages.length ? (
            messages.map((m, idx) => (
              <div key={idx} className={"msg " + (m.role === "user" ? "msgUser" : "msgAI")}>
                <div className="msgRole" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{m.role === "user" ? "You" : "AI"}</span>
                  {m.role === "assistant" && "speechSynthesis" in window ? (
                    <button
                      className="linkBtn"
                      type="button"
                      onClick={() => speak(m.content)}
                      title="Speak this reply"
                    >
                      Speak
                    </button>
                  ) : null}
                </div>
                <div className="msgContent">
                  {m.role === "assistant" ? (
                    <MarkdownMessage content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="emptyState">
              <div className="emptyTitle">Ask me anything</div>
              <div className="emptySub">Start a chat and your history will be saved.</div>
            </div>
          )}
        </div>

        <div className="composer">
          <MessageInput disabled={sending} onSend={onSend} />
        </div>
      </main>
    </div>
  );
}

