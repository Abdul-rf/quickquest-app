import React, { useState } from "react";

const LoginPage = ({ onLogin }) => {
  const [teamName, setTeamName] = useState("");
  const [section, setSection] = useState("");

  const handleLogin = () => {
    if (!teamName.trim() || !section.trim()) {
      alert("Please enter both Team Name and Section!");
      return;
    }
    onLogin({ teamName, section });
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Login</h2>
      <input
        type="text"
        placeholder="Team Name"
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        style={{ padding: "10px", fontSize: "16px", marginBottom: "10px" }}
      />
      <br />
      <input
        type="text"
        placeholder="Section"
        value={section}
        onChange={(e) => setSection(e.target.value)}
        style={{ padding: "10px", fontSize: "16px", marginBottom: "10px" }}
      />
      <br />
      <button
        onClick={handleLogin}
        style={{ padding: "10px 20px", fontSize: "16px" }}
      >
        Login
      </button>
    </div>
  );
};

export default LoginPage;
