// src/GameView.js
import React, { useState, useRef, useEffect } from "react";

// Coordinates of differences
const differenceCoords = [
  { x: 29, y: 133 },
  { x: 84, y: 32 },
  { x: 156, y: 111 },
  { x: 144, y: 182 },
  { x: 199, y: 130 },
];

const GameView = ({ onComplete, teamName }) => {
  const [found, setFound] = useState([]);
  const [timer, setTimer] = useState(0);
  const [completed, setCompleted] = useState(false);
  const imgRefs = useRef([]);

  // Start timer when component mounts
  useEffect(() => {
    setFound([]);
    setTimer(0);
    setCompleted(false);

    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle click on an image
  const handleClick = (e, index) => {
    const img = imgRefs.current[index];
    if (!img || completed) return;

    const rect = img.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * img.naturalWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * img.naturalHeight;

    differenceCoords.forEach((coord, i) => {
      if (
        !found.includes(i) &&
        Math.abs(clickX - coord.x) < 10 &&
        Math.abs(clickY - coord.y) < 10
      ) {
        setFound((prev) => {
          const newFound = [...prev, i];
          if (newFound.length === differenceCoords.length && !completed) {
            setCompleted(true);
            onComplete(timer); // Pass only the timer
          }
          return newFound;
        });
      }
    });
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          marginBottom: "10px",
        }}
      >
        Time: {timer}s
      </div>

      {/* Images stacked vertically */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          alignItems: "center",
        }}
      >
        <img
          src="/images/difference-left.png"
          alt="Original"
          style={{ width: "350px", height: "350px", border: "2px solid black" }}
          ref={(el) => (imgRefs.current[0] = el)}
          onClick={(e) => handleClick(e, 0)}
        />
        <img
          src="/images/difference-right.png"
          alt="Modified"
          style={{ width: "350px", height: "350px", border: "2px solid black" }}
          ref={(el) => (imgRefs.current[1] = el)}
          onClick={(e) => handleClick(e, 1)}
        />
      </div>

      <div style={{ marginTop: "10px", fontSize: "20px" }}>
        {found.length}/{differenceCoords.length} found
      </div>
    </div>
  );
};

export default GameView;