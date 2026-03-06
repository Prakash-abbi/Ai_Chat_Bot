import { useState } from "react";
import axios from "axios";

function ChatWindow() {

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const sendMessage = async () => {

    const res = await axios.post(
      "http://localhost:5000/api/chat",
      { message }
    );

    setMessages([
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: res.data }
    ]);

    setMessage("");
  };

  return (
    <div>

      {messages.map((m, i) => (
        <p key={i}>
          <b>{m.role}:</b> {m.content}
        </p>
      ))}

      <input
        value={message}
        onChange={(e) =>
          setMessage(e.target.value)
        }
      />

      <button onClick={sendMessage}>
        Send
      </button>

    </div>
  );
}

export default ChatWindow;