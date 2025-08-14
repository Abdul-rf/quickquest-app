// LeaderboardApp.jsx
import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:4000");

const LeaderboardApp = () => {
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);

  const eventCode = "EVENT1";

  // Timer logic
  useEffect(() => {
    let interval;
    if (running) {
      interval = setInterval(() => setTimer(prev => prev + 0.1), 100);
    }
    return () => clearInterval(interval);
  }, [running]);

  // Socket events
  useEffect(() => {
    socket.on("joinedEvent", data => {
      console.log("joinedEvent:", data);
      setLeaderboard(data.leaderboard);
    });

    socket.on("leaderboardUpdate", data => {
      console.log("leaderboardUpdate:", data);
      setLeaderboard(data);
    });

    return () => {
      socket.off("joinedEvent");
      socket.off("leaderboardUpdate");
    };
  }, []);

  const handleJoin = () => {
    if (!playerName) return alert("Enter player name");
    socket.emit("joinEvent", eventCode, { playerName });
    setJoined(true);
  };

  const handleFinish = () => {
    setRunning(false);
    socket.emit("submitTime", eventCode, { name: playerName, time: timer.toFixed(1) });
  };

  return (
    <div style={{ padding: "20px" }}>
      {!joined ? (
        <div>
          <input
            placeholder="Player Name"
            onChange={e => setPlayerName(e.target.value)}
          />
          <button onClick={handleJoin}>Join Game</button>
        </div>
      ) : (
        <div>
          <h3>Player: {playerName}</h3>
          <p>Timer: {timer.toFixed(1)} s</p>
          {!running ? (
            <button onClick={() => setRunning(true)}>Start Game</button>
          ) : (
            <button onClick={handleFinish}>Finish Game</button>
          )}

          <h2>Leaderboard</h2>
          <table border="1" style={{ width: "100%", textAlign: "center" }}>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Player Name</th>
                <th>Time (s)</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((p, idx) => (
                <tr key={p.name}>
                  <td>{idx + 1}</td>
                  <td>{p.name}</td>
                  <td>{p.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardApp;
