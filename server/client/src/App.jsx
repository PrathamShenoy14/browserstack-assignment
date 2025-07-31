import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000"); // connect to backend

function App() {
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    socket.on("init", (lines) => setLogs(lines));
    socket.on("update", (lines) => {
      setLogs((prev) => [...prev, ...lines]);
    });

    return () => {
      socket.off("init");
      socket.off("update");
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{ padding: "1rem", fontFamily: "monospace" }}>
      <h2>📄 Live Log Viewer</h2>
      <div
        ref={logRef}
        style={{
          height: "400px",
          overflowY: "scroll",
          background: "#111",
          color: "#0f0",
          padding: "1rem",
          borderRadius: "8px",
        }}
      >
        {logs.map((line, index) => (
            <div key={index} style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
        {line === "" ? "\u00A0" : line}
      </div>
        ))}
      </div>
    </div>
  );
}

export default App;
