// src/App.js
import React, { useState } from "react";
import { io } from "socket.io-client";
import LoginScreen from "./LoginScreen";
import EventCodeScreen from "./EventCodeScreen";
import GameView from "./GameView";
import Leaderboard from "./Leaderboard";
import "./App.css";

const socket = io("http://localhost:4000");

export default function App() {
  const [username, setUsername] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [hasLoggedIn, setHasLoggedIn] = useState(false);
  const [hasStartedGame, setHasStartedGame] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const handleLogin = (user) => {
    setUsername(user);
    setHasLoggedIn(true);
  };

  const handleEventCodeSubmit = (code) => {
    setEventCode(code);
    setHasStartedGame(true);
  };

  const handleGameComplete = (time) => {
    // Send game completion data to the server
    socket.emit("submitTime", eventCode, {
      name: username,
      time: time,
    });
    setShowLeaderboard(true);
  };

  const resetGame = () => {
    setUsername("");
    setEventCode("");
    setHasLoggedIn(false);
    setHasStartedGame(false);
    setShowLeaderboard(false);
  };

  if (!hasLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (!hasStartedGame) {
    return <EventCodeScreen onStartGame={handleEventCodeSubmit} />;
  }

  if (showLeaderboard) {
    return (
      <Leaderboard
        eventCode={eventCode}
        playerName={username}
        onPlayAgain={resetGame}
      />
    );
  }

  return <GameView onComplete={handleGameComplete} teamName={username} />;
}