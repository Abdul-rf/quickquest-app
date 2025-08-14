// src/Leaderboard.js
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import './Leaderboard.css';

const socket = io("http://localhost:4000");

const Leaderboard = ({ eventCode, playerName, onPlayAgain }) => {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    // Join the event
    socket.emit("joinEvent", eventCode, { teamName: playerName });

    // Initial leaderboard
    socket.on("joinedEvent", (data) => {
      setLeaderboard(data.leaderboard);
    });

    // Listen for updates
    socket.on("leaderboardUpdate", (updatedLeaderboard) => {
      setLeaderboard(updatedLeaderboard);
    });

    return () => {
      socket.off("joinedEvent");
      socket.off("leaderboardUpdate");
    };
  }, [eventCode, playerName]);

  return (
    <div className="leaderboard-container">
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
          {leaderboard.map((player, index) => (
            <tr key={player.name}>
              <td>{index + 1}</td>
              <td>{player.name}</td>
              <td>{player.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onPlayAgain} className="play-again-button">
        Play Again
      </button>
    </div>
  );
};

export default Leaderboard;