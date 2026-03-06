import { useEffect, useRef, useState } from "react";

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [listening, setListening] = useState(false);
  const ref = useRef(null);
  const fileRef = useRef(null);
  const recRef = useRef(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const send = () => {
    const msg = text.trim();
    if (!msg && !files.length) return;
    setText("");
    const currentFiles = files;
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    onSend?.(msg, currentFiles);
  };

  const toggleMic = async () => {
    if (disabled) return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (listening && recRef.current) {
      recRef.current.stop();
      return;
    }

    const rec = new SpeechRecognition();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
      }
      if (finalText) {
        setText((t) => (t ? `${t} ${finalText}` : finalText));
      }
    };

    try {
      rec.start();
    } catch {
      // ignore (some browsers throw if called twice quickly)
    }
  };

  return (
    <div className="composerInner">
      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          setFiles(Array.from(e.target.files || []));
        }}
      />
      <textarea
        ref={ref}
        className="composerInput"
        placeholder="Message… (Shift+Enter for newline)"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        rows={1}
      />
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="ghostBtn"
          type="button"
          onClick={toggleMic}
          disabled={disabled || !(window.SpeechRecognition || window.webkitSpeechRecognition)}
          title={
            window.SpeechRecognition || window.webkitSpeechRecognition
              ? listening
                ? "Stop dictation"
                : "Dictate"
              : "Voice input not supported in this browser"
          }
        >
          {listening ? "Listening…" : "Mic"}
        </button>
        <button
          className="secondaryBtn"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
        >
          Attach{files.length ? ` (${files.length})` : ""}
        </button>
        <button
          className="primaryBtn"
          onClick={send}
          disabled={disabled || (!text.trim() && !files.length)}
          type="button"
        >
          Send
        </button>
      </div>
    </div>
  );
}

