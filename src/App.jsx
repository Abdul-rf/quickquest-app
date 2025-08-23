import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// --- Constants & Game Data ---
const games = [
  {
    id: 'game-1',
    name: 'Spot the Difference',
    description: 'Find 5 differences between the two images.',
    images: {
      left: '/images/difference-left.png',
      right: '/images/difference-right.png',
    },
    differenceCoords: [
      { x: 29, y: 133, found: false },
      { x: 84, y: 32, found: false },
      { x: 156, y: 111, found: false },
      { x: 144, y: 182, found: false },
      { x: 199, y: 130, found: false },
    ],
  },
];

// --- Firebase Initialization (Client-side) ---
// IMPORTANT: Replace with your actual Firebase config
const FIREBASE_CONFIG = {
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id",
};

const App = () => {
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [gameState, setGameState] = useState('login');
  const [teamName, setTeamName] = useState('');
  const [section, setSection] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentTimer, setCurrentTimer] = useState(0);
  const [foundDifferences, setFoundDifferences] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [hostCode, setHostCode] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');

  const [isOffline, setIsOffline] = useState(false);
  const timerIntervalRef = useRef(null);
  const timerStartRef = useRef(null);

  const socket = useRef(null);
  const gameRef = useRef(games[0]);
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const stateRef = useRef();
  stateRef.current = { teamName, section, userId, eventCode };

  const resetGameState = () => {
    console.log("Resetting game state...");
    setFoundDifferences([]);
    setCurrentTimer(0);
    setLeaderboard([]);
  };

  const startLocalTimer = () => {
    stopLocalTimer();
    timerStartRef.current = performance.now();
    setCurrentTimer(0);
    timerIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - timerStartRef.current;
      setCurrentTimer(elapsed);
    }, 50);
  };

  const stopLocalTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  useEffect(() => {
    try {
      const firebaseApp = initializeApp(FIREBASE_CONFIG);
      const authInstance = getAuth(firebaseApp);
      setAuth(authInstance);
      signInAnonymously(authInstance).catch(error => {
        console.error('Firebase authentication error:', error);
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }

    const serverURL =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SOCKET_URL) ||
      (window.location.protocol === 'https:'
        ? window.location.origin
        : 'http://localhost:4000');

    const newSocket = io(serverURL, {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
    });

    socket.current = newSocket;

    const offlineFallback = setTimeout(() => {
      if (!newSocket.connected) {
        console.warn('Socket not reachable, switching to offline mode');
        setIsOffline(true);
        try { newSocket.disconnect(); } catch {}
        socket.current = null;
      }
    }, 1500);

    newSocket.on('connect', () => {
      clearTimeout(offlineFallback);
      console.log('Connected to server:', serverURL);
    });

    newSocket.on('connect_error', () => {
      clearTimeout(offlineFallback);
      setIsOffline(true);
      try { newSocket.disconnect(); } catch {}
      socket.current = null;
    });

    newSocket.on('gameStateUpdate', (data) => {
      console.log('Received gameStateUpdate:', data.state);
      if (!isHostRef.current) {
        if (data.state === 'playing') {
          resetGameState();
          setGameState('playing');
        } else if (data.state === 'leaderboard') {
          setGameState('leaderboard');
        } else {
          setGameState('waitingForHost');
          setConnectionMessage('Waiting for the host to start...');
        }
      }
      if (isHostRef.current && data.state === 'leaderboard') {
        setGameState('leaderboard');
      }
    });

    newSocket.on('timerUpdate', (time) => {
      if (!isHostRef.current) {
        setCurrentTimer(time);
      }
    });

    newSocket.on('leaderboardUpdate', (data) => {
      setLeaderboard([...data].sort((a, b) => a.time - b.time));
    });

    newSocket.on('hostCode', (code) => {
      setHostCode(code);
      setGameState('hostDashboard');
    });

    newSocket.on('joinResponse', (response) => {
      if (response.success) {
        setEventCode(response.eventCode);
        if (response.gameState === 'playing') {
          resetGameState();
          setGameState('playing');
        } else {
          setGameState('waitingForHost');
          setConnectionMessage('Successfully joined, waiting for host...');
        }
      } else {
        setConnectionMessage('Failed to join event: ' + response.message);
        // Using a custom modal/alert would be better than window.alert
        alert(response.message);
      }
    });
    
    newSocket.on('eventEnded', () => {
      alert('The event has ended. Redirecting to login.');
      resetGameState();
      setGameState('login');
      setIsHost(false);
      setEventCode('');
      setHostCode('');
    });

    return () => {
      clearTimeout(offlineFallback);
      try { newSocket.disconnect(); } catch {}
      stopLocalTimer();
    };
  }, []);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserId(user.uid);
        }
        setIsAuthLoading(false);
      });
      return () => unsubscribe();
    }
  }, [auth]);

  const handleLogin = (name, teamSection, hostPasswordInput) => {
    if (hostPasswordInput === '1918') {
      setIsHost(true);
      setTeamName(name || 'Host');
      setSection(teamSection || 'Admin');
      setGameState('hostDashboard');

      if (isOffline) {
        setHostCode('OFFLINE');
      } else {
        socket.current && socket.current.emit('createEvent', { hostId: userId });
      }
      return;
    }

    if (!name.trim() || !teamSection.trim()) {
      alert("Please enter both Team Name and Section!");
      return;
    }

    setTeamName(name);
    setSection(teamSection);
    setIsHost(false);

    if (isOffline) {
      setEventCode('OFFLINE');
      resetGameState();
      setGameState('playing');
      startLocalTimer();
      return;
    }

    setGameState('waitingForHost');
    socket.current && socket.current.emit('joinEvent', {
      eventCode: hostPasswordInput,
      teamId: userId,
      teamName: name,
      section: teamSection
    });
  };
  
  const handleGameComplete = (time) => {
    if (isOffline) {
      stopLocalTimer();
      setGameState('leaderboard');
      setLeaderboard(prev =>
        [...prev, { name: stateRef.current.teamName, section: stateRef.current.section, time }].sort((a, b) => a.time - b.time)
      );
      return;
    }
    setGameState('leaderboard');
    socket.current && socket.current.emit('submitTime', {
      eventCode: stateRef.current.eventCode,
      teamId: stateRef.current.userId,
      teamName: stateRef.current.teamName,
      section: stateRef.current.section,
      time,
    });
  };
  
  const handleStartGame = () => {
    if (isOffline) {
      resetGameState();
      setGameState('playing');
      startLocalTimer();
      return;
    }
    if (isHost && hostCode) {
      socket.current && socket.current.emit('startGame', { eventCode: hostCode });
    }
  };
  
  const handleRestartGame = () => {
    if (isOffline) {
      stopLocalTimer();
      resetGameState();
      setGameState(isHost ? 'hostDashboard' : 'waitingForHost');
      return;
    }
    if (isHost && hostCode) {
      resetGameState();
      setGameState('hostDashboard');
      socket.current && socket.current.emit('restartGame', { eventCode: hostCode });
    }
  };
  
  const handleEndEvent = () => {
    if (isOffline) {
      stopLocalTimer();
      resetGameState();
      setGameState('login');
      setIsHost(false);
      setEventCode('');
      setHostCode('');
      return;
    }
    if (isHost && hostCode) {
      socket.current && socket.current.emit('endEvent', { eventCode: hostCode });
    }
  };

  const LoginScreen = ({ onLogin, userId }) => {
    const [name, setName] = useState('');
    const [teamSection, setTeamSection] = useState('');
    const [hostPasswordInput, setHostPasswordInput] = useState('');

    const handleLoginSubmit = (e) => {
      e.preventDefault();
      onLogin(name, teamSection, hostPasswordInput);
    };

    return (
      <div className="login-container">
        <div className="login-form-box">
          <img src="/images/logo.png" alt="Logo" className="logo" onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/150x150/ffffff/000000?text=Logo'; }} />
          <h1 className="animated-title">Welcome</h1>
          <h2 className="animated-subtitle">DO-IT</h2>
          <form className="login-form" onSubmit={handleLoginSubmit}>
            <div className="input-group">
              <input
                type="text"
                placeholder="Team Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder="Section"
                value={teamSection}
                onChange={(e) => setTeamSection(e.target.value)}
              />
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder="Host Password / Event Code"
                value={hostPasswordInput}
                onChange={(e) => setHostPasswordInput(e.target.value)}
              />
            </div>
            <button type="submit" className="login-button">
              Next
            </button>
          </form>
          {userId && (
            <div className="user-id">
              Your ID: {userId}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const HostDashboard = ({ hostCode, onStart, onRestart, onEnd }) => {
    return (
      <div className="login-container">
        <div className="login-form-box">
          <h1 className="animated-title">Host Dashboard</h1>
          <div className="host-code-display">{hostCode || 'Generating code...'}</div>
          <p className="animated-subtitle">Players can join using this code.</p>
          <div className="host-controls">
            <button className="login-button" onClick={onStart} disabled={!hostCode && !isOffline}>Start Game</button>
            <button className="login-button" onClick={onRestart} disabled={false}>Restart Game</button>
            <button className="login-button" onClick={onEnd} disabled={false}>End Event</button>
          </div>
        </div>
      </div>
    );
  };

  const GameView = ({ game, onComplete, timer, foundDifferences, setFoundDifferences }) => {
    const imgRefs = useRef([]);
    
    const handleClick = (e) => {
      const img = e.currentTarget;
      if (!img || img.naturalWidth === 0) return;

      const rect = img.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const radius = 20;

      const scaleX = rect.width / img.naturalWidth;
      const scaleY = rect.height / img.naturalHeight;

      const foundIndex = game.differenceCoords.findIndex((coord, i) => {
        if (foundDifferences.includes(i)) return false;

        const coordX = coord.x * scaleX;
        const coordY = coord.y * scaleY;

        return Math.abs(clickX - coordX) < radius && Math.abs(clickY - coordY) < radius;
      });

      if (foundIndex !== -1) {
        setFoundDifferences(prevFound => {
          const newFound = [...prevFound, foundIndex];
          if (newFound.length === game.differenceCoords.length) {
            onComplete(timer);
          }
          return newFound;
        });
      }
    };
    
    const displayTimer = (timer / 1000).toFixed(2);

    return (
      <div className="game-container">
        <div className="timer">Time: {displayTimer}s</div>
        <div className="images">
          {['left', 'right'].map((side, index) => (
            <div className="image-wrapper" key={side}>
              <img
                src={game.images[side]}
                alt={side}
                ref={(el) => (imgRefs.current[index] = el)}
                onClick={handleClick}
              />
              {foundDifferences.map(i => {
                const coord = game.differenceCoords[i];
                if (!imgRefs.current[index] || !imgRefs.current[index].naturalWidth) return null;

                const rect = imgRefs.current[index].getBoundingClientRect();
                const scaleX = rect.width / imgRefs.current[index].naturalWidth;
                const scaleY = rect.height / imgRefs.current[index].naturalHeight;

                const circleX = coord.x * scaleX;
                const circleY = coord.y * scaleY;

                return (
                  <div
                    key={i}
                    className="circle"
                    style={{
                      position: 'absolute',
                      top: circleY - 12,
                      left: circleX - 12,
                    }}
                  ></div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="found-count">
          {foundDifferences.length}/{game.differenceCoords.length} found
        </div>
      </div>
    );
  };

  const Leaderboard = ({ leaderboardData, onRestart, onEnd, isHost }) => {
    return (
      <div className="leaderboard-container">
        <h2>Leaderboard</h2>
        <div className="scores-list">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team Name</th>
                <th>Section</th>
                <th>Time (s)</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((player, index) => (
                <tr key={player.teamId || (player.name + index)}>
                  <td>{index + 1}</td>
                  <td>{player.name}</td>
                  <td>{player.section}</td>
                  <td>{(player.time / 1000).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isHost && (
          <div className="host-controls">
            <button onClick={onRestart} className="play-again-button">
              Restart Game
            </button>
            <button onClick={onEnd} className="play-again-button">
              End Event
            </button>
          </div>
        )}
        {!isHost && (
          <p className="waiting-message">Waiting for the host to restart...</p>
        )}
      </div>
    );
  };

  const WaitingForHostScreen = ({ connectionMessage }) => {
    return (
      <div className="login-container">
        <div className="login-form-box">
          <h1 className="animated-title">Waiting for Host...</h1>
          <p className="loading-message">{connectionMessage}</p>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isAuthLoading) {
      return <div>Authenticating...</div>;
    }

    switch (gameState) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} userId={userId} />;
      case 'hostDashboard':
        return <HostDashboard hostCode={hostCode} onStart={handleStartGame} onRestart={handleRestartGame} onEnd={handleEndEvent} />;
      case 'waitingForHost':
        return <WaitingForHostScreen connectionMessage={connectionMessage} />;
      case 'playing':
        return <GameView game={gameRef.current} onComplete={handleGameComplete} timer={currentTimer} foundDifferences={foundDifferences} setFoundDifferences={setFoundDifferences} />;
      case 'leaderboard':
        return <Leaderboard leaderboardData={leaderboard} onRestart={handleRestartGame} onEnd={handleEndEvent} isHost={isHost} />;
      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <div>
      {renderContent()}
    </div>
  );
};

const styles = `
  body {
    font-family: 'Arial', sans-serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    color: white;
    background: radial-gradient(circle at center, #2e2e2e 0%, #0a0a0a 100%);
  }

  .login-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: radial-gradient(circle at center, #2e2e2e 0%, #0a0a0a 100%);
    color: white;
  }

  .login-form-box {
    background: rgba(58, 63, 74, 0.9);
    padding: 30px 40px;
    border-radius: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    text-align: center;
    width: 300px;
  }
  
  .logo {
    max-width: 150px;
    height: auto;
    margin-bottom: 10px;
    filter: drop-shadow(0 0 10px #fff);
  }

  .user-id {
    margin-top: 15px;
    font-size: 0.8em;
    color: #a0a0a0;
  }

  .animated-title {
    font-size: 2em;
    margin-bottom: 0;
    animation: fadeInDown 1s ease-in-out;
  }

  .animated-subtitle {
    font-size: 1.5em;
    margin-top: 5px;
    margin-bottom: 15px;
    animation: fadeInDown 1.2s ease-in-out;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .input-group input {
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 5px;
    background: #282c34;
    color: white;
    font-size: 1em;
  }

  .login-button {
    padding: 12px;
    border: none;
    border-radius: 5px;
    background: #000;
    color: white;
    font-size: 1.1em;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2), inset 0 0 10px rgba(255, 255, 255, 0.1);
  }

  .login-button:hover {
    background: #111;
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.3), inset 0 0 15px rgba(255, 255, 255, 0.2);
  }

  @keyframes fadeInDown {
    0% {
      opacity: 0;
      transform: translateY(-20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .host-code-display {
    font-size: 3em;
    font-weight: bold;
    color: #61dafb;
    margin-bottom: 20px;
  }

  .loading-message, .waiting-message {
    font-size: 1.2em;
    color: #a0a0a0;
  }
  
  .host-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 20px;
  }
  
  .host-controls button:disabled {
    background-color: #555;
    cursor: not-allowed;
    box-shadow: none;
    opacity: 0.7;
  }

  .game-container {
    text-align: center;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background-color: #1c1c1c;
  }

  .timer {
    font-size: 2em;
    font-weight: bold;
    margin-bottom: 20px;
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 5px 15px;
    border-radius: 8px;
  }

  .images {
    display: flex;
    justify-content: center;
    gap: 20px;
  }

  .image-wrapper {
    position: relative;
  }

  .image-wrapper img {
    max-width: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  .circle {
    position: absolute;
    border: 3px solid #ff7eb3;
    background-color: rgba(255, 126, 179, 0.2);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    pointer-events: none;
  }

  .found-count {
    font-size: 1.2em;
    margin-top: 20px;
  }

  .leaderboard-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: radial-gradient(circle at center, #1a1a1a 0%, #000000 100%);
    color: white;
    font-family: Arial, sans-serif;
    padding: 20px;
    box-shadow: inset 0 0 50px rgba(255, 255, 255, 0.1);
  }

  .scores-list {
    width: 80%;
    max-width: 600px;
    background: rgba(50, 50, 50, 0.9);
    border-radius: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .scores-list table {
    width: 100%;
    border-collapse: collapse;
    color: white;
    text-align: center;
  }

  .scores-list th, .scores-list td {
    padding: 15px;
    border-bottom: 1px solid #4a4f59;
  }

  .scores-list tr:last-child td {
    border-bottom: none;
  }

  .play-again-button {
    margin-top: 30px;
    padding: 12px 24px;
    border: none;
    border-radius: 5px;
    background-color: #000;
    color: white;
    font-size: 1.1em;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2), inset 0 0 10px rgba(255, 255, 255, 0.1);
  }

  .play-again-button:hover {
    background-color: #111;
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.3), inset 0 0 15px rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 768px) {
    .images {
      flex-direction: column;
      align-items: center;
    }
    .image-wrapper img {
      max-width: 100%;
    }
    .leaderboard-container h2 {
      font-size: 1.8em;
    }
    .scores-list {
      width: 100%;
      max-width: 300px;
    }
    .scores-list th, .scores-list td {
      font-size: 0.9em;
      padding: 10px;
    }
    .game-container {
      padding: 10px;
      height: auto;
    }
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default App;
