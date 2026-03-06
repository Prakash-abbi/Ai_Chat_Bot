import { useEffect, useState } from "react";
import "./App.css";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import { getToken } from "./api";

function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  useEffect(() => {
    setAuthed(Boolean(getToken()));
  }, []);

  return (
    <div className="root">
      {authed ? (
        <Chat onLogout={() => setAuthed(false)} />
      ) : (
        <Login onAuthed={() => setAuthed(true)} />
      )}
    </div>
  );
}

export default App;