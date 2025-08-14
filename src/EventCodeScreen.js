import React, { useState } from "react";
import "./EventCodeScreen.css";

const CORRECT_CODE = "1234"; // You can change this code

export default function EventCodeScreen({ onStartGame }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code === CORRECT_CODE) {
      onStartGame();
    } else {
      setError("Incorrect code. Please try again.");
    }
  };

  return (
    <div className="event-code-container">
      <div className="event-code-box">
        <h2>Enter Event Code</h2>
        <form className="event-code-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="password"
              placeholder="Enter event code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength="4"
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="start-game-button">
            Start Game
          </button>
        </form>
      </div>
    </div>
  );
}