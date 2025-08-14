import React, { useState } from "react";

const EventCodePage = ({ onStartGame }) => {
  const [eventCode, setEventCode] = useState("");

  const handleStart = () => {
    if (!eventCode.trim()) {
      alert("Please enter the Event Code!");
      return;
    }
    onStartGame(); // no need to pass user, App.js already has currentUser
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Enter Event Code</h2>
      <input
        type="text"
        placeholder="Event Code"
        value={eventCode}
        onChange={(e) => setEventCode(e.target.value)}
        style={{ padding: "10px", fontSize: "16px", marginBottom: "20px" }}
      />
      <br />
      <button
        onClick={handleStart}
        style={{ padding: "10px 20px", fontSize: "16px" }}
      >
        Start Game
      </button>
    </div>
  );
};

export default EventCodePage;
