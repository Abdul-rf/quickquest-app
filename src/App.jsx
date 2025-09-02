
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// Firebase config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBGBGrjPwiGKksG6NCU1bL95s7RRqo1X40",
  authDomain: "quickquest-40069.firebaseapp.com",
  projectId: "quickquest-40069",
  storageBucket: "quickquest-40069.firebasestorage.app",
  messagingSenderId: "8939930784",
  appId: "1:8939930784:web:a1c272d9262cfb4169b5c5",
  measurementId: "G-8HJ5KHF4BD"
};

const games = {
  'spot-the-difference': {
    id: 'spot-the-difference',
    name: 'Spot the Difference',
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
  'image-scramble': {
    id: 'image-scramble',
    name: 'Image Scramble',
    imageParts: Array.from({ length: 9 }, (_, i) => `/images/logo/logo-part-${i + 1}.jpg`),
  },
  'matching-pairs': {
    id: 'matching-pairs',
    name: 'Matching Pairs',
    images: [
      '/images/card1.jpg',
      '/images/card2.jpg',
      '/images/card3.jpg',
    ]
  }
};

function shuffle(arr) {
  let currentIndex = arr.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }
  return arr;
}

const MatchingPairsGameView = ({ game, onComplete, timer, scrambledOrder }) => {
  const pairImages = [
    game.images[0], game.images[0],
    game.images[1], game.images[1],
    game.images[2], game.images[2],
  ];

  const [cards] = React.useState(scrambledOrder.length === 6 ? scrambledOrder : shuffle([...pairImages]));
  const [flipped, setFlipped] = React.useState(Array(6).fill(false));
  const [matched, setMatched] = React.useState(Array(6).fill(false));
  const [selected, setSelected] = React.useState([]);

  React.useEffect(() => {
    if (matched.filter(Boolean).length === 6) {
      onComplete(timer, game.id);
    }
  }, [matched, onComplete, timer, game.id]);

  const handleCardClick = (index) => {
    if (flipped[index] || matched[index] || selected.length === 2) return;
    const newSelected = [...selected, index];
    setFlipped(prev => prev.map((v, i) => (i === index ? true : v)));
    setSelected(newSelected);

    if (newSelected.length === 2) {
      const [first, second] = newSelected;
      if (cards[first] === cards[second]) {
        setTimeout(() => {
          setMatched(prev => prev.map((v, i) => (i === first || i === second ? true : v)));
          setSelected([]);
        }, 700);
      } else {
        setTimeout(() => {
          setFlipped(prev => prev.map((v, i) => (i === first || i === second ? false : v)));
          setSelected([]);
        }, 700);
      }
    }
  };

  return (
    <div className="game-container pairs-game">
      <div className="timer">Time: {(timer / 1000).toFixed(2)}s</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 400, margin: '0 auto' }}>
        {cards.map((src, i) => (
          <div key={i} onClick={() => handleCardClick(i)} style={{
            cursor: matched[i] ? 'default' : 'pointer',
            borderRadius: 10,
            boxShadow: matched[i] ? '0 0 10px #61dafb' : '0 2px 8px rgba(0,0,0,0.18)',
            border: matched[i] ? '3px solid #61dafb' : 'none',
            width: 120,
            height: 160,
            overflow: 'hidden',
            backgroundColor: '#222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              src={flipped[i] || matched[i] ? src : '/images/card-back.jpg'}
              alt="card"
              style={{ width: '100%', height: '100%', borderRadius: 10 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
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
  const [scrambledOrder, setScrambledOrder] = useState([]);
  const [selectedPiece, setSelectedPiece] = useState(null);

  const [isHost, setIsHost] = useState(false);
  const [hostCode, setHostCode] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [currentGameMode, setCurrentGameMode] = useState('spot-the-difference');

  const socket = useRef(null);
  const timerIntervalRef = useRef(null);
  const serverTimeRef = useRef(0);
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const stateRef = useRef();
  stateRef.current = { teamName, section, userId, eventCode };

  const resetGameState = useCallback(() => {
    setFoundDifferences([]);
    setScrambledOrder([]);
    setSelectedPiece(null);
    setCurrentTimer(0);
    setLeaderboard([]);
  }, []);

  const stopLocalTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startLocalTimer = useCallback(() => {
    stopLocalTimer();
    timerIntervalRef.current = setInterval(() => {
      serverTimeRef.current += 50;
      setCurrentTimer(serverTimeRef.current);
    }, 50);
  }, [stopLocalTimer]);


  useEffect(() => {
    if (socket.current) {
      return;
    }

    try {
      const firebaseApp = initializeApp(FIREBASE_CONFIG);
      const authInstance = getAuth(firebaseApp);
      setAuth(authInstance);
      signInAnonymously(authInstance).catch(error => console.error('Firebase auth error:', error));
    } catch (error) {
      console.error('Firebase init error:', error);
    }

    const serverURL = 'https://quickquest-backend.onrender.com';

    const newSocket = io(serverURL, { transports: ['websocket'], withCredentials: true, autoConnect: true });
    socket.current = newSocket;

    const offlineFallback = setTimeout(() => {
      if (!newSocket.connected) {
        console.warn('Socket not reachable, switching to offline mode');
        setIsOffline(true);
        try { newSocket.disconnect(); } catch {}
        socket.current = null;
      }
    }, 8000);

    newSocket.on('connect', () => {
      clearTimeout(offlineFallback);
      console.log('Connected to server:', serverURL);
      setIsOffline(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection Error:', err);
      clearTimeout(offlineFallback);
      setIsOffline(true);
      try { newSocket.disconnect(); } catch {}
      socket.current = null;
    });

    newSocket.on('gameStateUpdate', (data) => {
      console.log('Received gameStateUpdate:', data.state, data.gameMode, 'scrambledOrder:', data.scrambledOrder);
      setCurrentGameMode(data.gameMode);

      // Host: stay in control panels
      if (isHostRef.current) {
        if (data.state === 'playing') setGameState('playing');
        else if (data.state === 'waiting') setGameState('hostDashboard');
        else if (data.state === 'leaderboard') setGameState('leaderboard');
        return;
      }

      // Players
      if (data.state === 'playing') {
        resetGameState();
        if (data.gameMode === 'image-scramble' && data.scrambledOrder && data.scrambledOrder.length > 0) {
          setScrambledOrder(data.scrambledOrder);
        }
        // ONLINE: do NOT start local timer — rely on server timerUpdate
        if (isOffline) startLocalTimer();
        setGameState('playing');
      } else {
        // waiting or leaderboard
        stopLocalTimer(); // ensure local timer is stopped
        setGameState(data.state === 'leaderboard' ? 'leaderboard' : 'waitingForHost');
      }
    });

    newSocket.on('timerUpdate', (timeFromServer) => {
      serverTimeRef.current = timeFromServer;
      // All clients (including host UI if needed) see server time during online mode
      if (!isOffline) setCurrentTimer(timeFromServer);
    });

    newSocket.on('leaderboardUpdate', (data) => setLeaderboard([...data].sort((a, b) => a.time - b.time)));
    newSocket.on('differenceUpdate', (updatedFoundDifferences) => setFoundDifferences(updatedFoundDifferences));
    newSocket.on('hostCode', (code) => { setHostCode(code); setGameState('hostDashboard'); });

    newSocket.on('joinResponse', (response) => {
      if (response.success) {
        setEventCode(response.eventCode);
        setConnectionMessage('Successfully joined, waiting for host...');
        setGameState(response.gameState === 'playing' ? 'playing' : 'waitingForHost');
        setCurrentGameMode(response.currentGameMode);
        if (response.gameState === 'playing') {
          // ONLINE: rely on server timer; OFFLINE: start local
          if (isOffline) startLocalTimer();
        }
      } else {
        setConnectionMessage('Failed to join event: ' + response.message);
        alert(response.message);
      }
    });

    newSocket.on('eventEnded', () => {
      alert('The event has ended. Redirecting to login.');
      stopLocalTimer();
      resetGameState();
      setGameState('login');
      setIsHost(false);
      setEventCode('');
      setHostCode('');
      setCurrentGameMode('spot-the-difference');
    });

    return () => {
      clearTimeout(offlineFallback);
      if (socket.current) {
        socket.current.disconnect();
        socket.current = null;
      }
      stopLocalTimer();
    };
  }, [resetGameState, startLocalTimer, stopLocalTimer, isOffline]);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) setUserId(user.uid);
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
      if (isOffline) setHostCode('OFFLINE');
      else socket.current?.emit('createEvent', { hostId: userId });
      return;
    }
    if (!name.trim() || !teamSection.trim()) return alert("Please enter both Team Name and Section!");
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
    socket.current?.emit('joinEvent', { eventCode: hostPasswordInput, teamId: userId, teamName: name, section: teamSection });
  };

  const handleGameComplete = (time, gameId) => {
    if (isOffline) {
      stopLocalTimer();
      setGameState('leaderboard');
      setLeaderboard(prev => [...prev, { name: stateRef.current.teamName, section: stateRef.current.section, time }].sort((a, b) => a.time - b.time));
      return;
    }
    setGameState('leaderboard');
    if (gameId === 'spot-the-difference') {
      socket.current?.emit('submitTime', { ...stateRef.current, time });
    } else if (gameId === 'image-scramble') {
      socket.current?.emit('submitScrambleTime', { ...stateRef.current, time });
    } else if (gameId === 'matching-pairs') {
      socket.current?.emit('submitTime', { ...stateRef.current, time }); // Assuming same event
    }
  };

  const handleDifferenceFound = (index) => {
    if (isOffline) {
      setFoundDifferences(prev => [...new Set([...prev, index])]);
      return;
    }
    socket.current?.emit('differenceFound', { eventCode: stateRef.current.eventCode, differenceIndex: index });
  };

  const handleStartGame = () => {
    if (isOffline) {
      resetGameState();
      setGameState('playing');
      startLocalTimer();
      return;
    }
    resetGameState();
    setGameState('playing');
    // ONLINE: no local timer; server will emit timerUpdate
    if (isHost && hostCode) {
      socket.current?.emit('startGame', { eventCode: hostCode, gameMode: currentGameMode });
    }
  };


  const handleRestartGame = useCallback(() => {
     console.log("[Frontend] Restart button clicked", { hostCode, currentGameMode });
    if (isOffline) {
      stopLocalTimer();
      resetGameState();
      setGameState(isHost ? 'hostDashboard' : 'waitingForHost');
      setCurrentTimer(0);
      return;
    }
    stopLocalTimer();
    resetGameState();
    setCurrentTimer(0);
    setGameState(isHost ? 'hostDashboard' : 'waitingForHost');

    if (isHost && hostCode) {
      socket.current?.emit('restartGame', { eventCode: hostCode, gameMode: currentGameMode });
    }
  }, [isOffline, isHost, hostCode, currentGameMode, resetGameState, stopLocalTimer]);

  const handleEndEvent = useCallback(() => {
    console.log("[Frontend] End event button clicked", { hostCode });
    if (isOffline) {
      stopLocalTimer();
      resetGameState();
      setGameState('login');
      setIsHost(false);
      setCurrentTimer(0);
      return;
    }
    stopLocalTimer();
    resetGameState();
    setCurrentTimer(0);
    setGameState('login');
    setIsHost(false);

    if (isHost && hostCode) {
      socket.current?.emit('endEvent', { eventCode: hostCode });
    }
  }, [isOffline, isHost, hostCode, resetGameState, stopLocalTimer]);

  const ImageScrambleGameView = ({ game, onComplete, timer, scrambledOrder, setScrambledOrder, selectedPiece, setSelectedPiece }) => {
    if (!scrambledOrder || scrambledOrder.length === 0) {
      return (
        <div className="game-container image-scramble-game">
          <div className="login-form-box">
            <h1 className="animated-title">Loading Game...</h1>
            <p className="loading-message">Waiting for puzzle pieces from the host.</p>
          </div>
        </div>
      );
    }
    const handlePieceClick = (index) => {
      if (selectedPiece === null) {
        setSelectedPiece(index);
      } else {
        const newOrder = [...scrambledOrder];
        [newOrder[selectedPiece], newOrder[index]] = [newOrder[index], newOrder[selectedPiece]];
        setScrambledOrder(newOrder);
        setSelectedPiece(null);

        const isSolved = newOrder.every((piece, i) => piece === i + 1);
        if (isSolved) {
          onComplete(timer, game.id);
        }
      }
    };
    return (
      <div className="game-container image-scramble-game">
        <div className="timer">Time: {(timer / 1000).toFixed(2)}s</div>
        <div className="image-grid">
          {scrambledOrder.map((piece, index) => (
            <div
              key={index}
              className={`image-piece ${selectedPiece === index ? 'selected' : ''}`}
              onClick={() => handlePieceClick(index)}
            >
              <img src={game.imageParts[piece - 1]} alt={`Piece ${piece}`} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Sub-Components ---
  const LoginScreen = ({ onLogin, userId }) => {
    const [name, setName] = useState('');
    const [teamSection, setTeamSection] = useState('');
    const [hostPasswordInput, setHostPasswordInput] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); onLogin(name, teamSection, hostPasswordInput); };
    return (
      <div className="login-container">
        <div className="login-form-box">
          <img src="/images/logo/logo.jpg" alt="Logo" className="logo" />
          <h1 className="animated-title">Welcome</h1>
          <h2 className="animated-subtitle">DO-IT</h2>
          <form className="login-form" onSubmit={handleSubmit}>
            <input type="text" placeholder="Team Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="text" placeholder="Section" value={teamSection} onChange={(e) => setTeamSection(e.target.value)} />
            <input type="text" placeholder="Host Password / Event Code" value={hostPasswordInput} onChange={(e) => setHostPasswordInput(e.target.value)} />
            <button type="submit" className="login-button">Next</button>
          </form>
          {userId && <div className="user-id">Your ID: {userId}</div>}
        </div>
      </div>
    );
  };

// HostDashboard select update

const HostDashboard = ({ hostCode, onStart, onRestart, onEnd, currentGameMode, setCurrentGameMode }) => (
    <div className="login-container">
      <div className="login-form-box">
        <h1 className="animated-title">Host Dashboard</h1>
        <div className="host-code-display">{hostCode || 'Generating...'}</div>
        <p className="animated-subtitle">Players can join using this code.</p>
        <div className="host-controls">
          <select value={currentGameMode} onChange={(e) => setCurrentGameMode(e.target.value)} className="game-select">
            <option value="spot-the-difference">Spot the Difference</option>
            <option value="image-scramble">Image Scramble</option>
            <option value="matching-pairs">Matching Pairs</option>
          </select>
          <button className="login-button" onClick={onStart} disabled={!hostCode && !isOffline}>Start Game</button>
          <button className="login-button" onClick={onRestart}>Restart Game</button>
          <button className="login-button" onClick={onEnd}>End Event</button>
        </div>
      </div>
    </div>
  );

  const HostPlayingView = ({ onRestart, onEnd }) => (
    <div className="login-container">
      <div className="login-form-box">
        <h1 className="animated-title">Game in Progress</h1>
        <p className="animated-subtitle">Players are competing now!</p>
        <div className="host-controls">
          <button className="login-button" onClick={onRestart}>Restart Game</button>
          <button className="login-button" onClick={onEnd}>End Event</button>
        </div>
      </div>
    </div>
  );

  const GameView = ({ game, onComplete, timer, foundDifferences, onDifferenceFound }) => {
    const imgRefs = useRef([]);
    const handleClick = (e) => {
      const img = e.currentTarget;
      if (!img || !img.naturalWidth) return;
      const rect = img.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const scaleX = rect.width / img.naturalWidth;
      const scaleY = rect.height / img.naturalHeight;

      const radius = 25;
      const foundIndex = game.differenceCoords.findIndex((coord, i) => {
        if (foundDifferences.includes(i)) return false;
        const targetX = coord.x * scaleX;
        const targetY = coord.y * scaleY;
        return Math.hypot(clickX - targetX, clickY - targetY) < radius;
      });
      if (foundIndex !== -1) {
        onDifferenceFound(foundIndex);
      }
    };
    useEffect(() => {
      if (foundDifferences.length > 0 && foundDifferences.length === game.differenceCoords.length) {
        onComplete(timer, game.id);
      }
    }, [foundDifferences, game.differenceCoords.length, onComplete, timer, game.id]);
    return (
      <div className="game-container">
        <div className="timer">Time: {(timer / 1000).toFixed(2)}s</div>
        <div className="images">
          {['left', 'right'].map((side, index) => (
            <div className="image-wrapper" key={side}>
              <img src={game.images[side]} alt={side} ref={(el) => (imgRefs.current[index] = el)} onClick={handleClick} />
              {foundDifferences.map(i => {
                const coord = game.differenceCoords[i];
                if (!imgRefs.current[index]?.naturalWidth) return null;
                const rect = imgRefs.current[index].getBoundingClientRect();
                const scaleX = rect.width / imgRefs.current[index].naturalWidth;
                const scaleY = rect.height / imgRefs.current[index].naturalHeight;
                return <div key={i} className="circle" style={{ position: 'absolute', top: (coord.y * scaleY) - 15, left: (coord.x * scaleX) - 15 }}></div>;
              })}
            </div>
          ))}
        </div>
        <div className="found-count">{foundDifferences.length}/{game.differenceCoords.length} found</div>
      </div>
    );
  };

  const Leaderboard = ({ leaderboardData, onRestart, onEnd, isHost }) => (
    <div className="leaderboard-container">
      <h2>Leaderboard</h2>
      <div className="scores-list">
        <table>
          <thead><tr><th>Rank</th><th>Team Name</th><th>Section</th><th>Time (s)</th></tr></thead>
          <tbody>
            {leaderboardData.map((player, index) => (
              <tr key={player.teamId || (player.name + index)}>
                <td>{index + 1}</td><td>{player.name}</td><td>{player.section}</td><td>{(player.time / 1000).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isHost ? (
        <div className="host-controls"><button onClick={onRestart}>Restart Game</button><button onClick={onEnd}>End Event</button></div>
      ) : <p className="waiting-message">Waiting for the host to restart...</p>}
    </div>
  );

  const WaitingForHostScreen = ({ connectionMessage }) => (
    <div className="login-container">
      <div className="login-form-box">
        <h1 className="animated-title">Waiting for Host...</h1>
        <p className="loading-message">{connectionMessage || 'Connecting...'}</p>
      </div>
    </div>
  );

const renderContent = () => {
    if (isAuthLoading) return <div>Authenticating...</div>;
    switch (gameState) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} userId={userId} />;
      case 'hostDashboard':
        return (
          <HostDashboard
            hostCode={hostCode}
            onStart={handleStartGame}
            onRestart={handleRestartGame}
            onEnd={handleEndEvent}
            currentGameMode={currentGameMode}
            setCurrentGameMode={setCurrentGameMode}
          />
        );
      case 'waitingForHost':
        return <WaitingForHostScreen connectionMessage={connectionMessage} />;
      case 'playing':
        if (isHost) return <HostPlayingView onRestart={handleRestartGame} onEnd={handleEndEvent} />;
        if (currentGameMode === 'spot-the-difference') {
          return <GameView game={games['spot-the-difference']} onComplete={handleGameComplete} timer={currentTimer} foundDifferences={foundDifferences} onDifferenceFound={handleDifferenceFound} />;
        } else if (currentGameMode === 'image-scramble') {
          return <ImageScrambleGameView game={games['image-scramble']} onComplete={handleGameComplete} timer={currentTimer} scrambledOrder={scrambledOrder} setScrambledOrder={setScrambledOrder} selectedPiece={selectedPiece} setSelectedPiece={setSelectedPiece} />;
        } else if (currentGameMode === 'matching-pairs') {
          return <MatchingPairsGameView game={games['matching-pairs']} onComplete={handleGameComplete} timer={currentTimer} scrambledOrder={scrambledOrder} />;
        }
        break;
      case 'leaderboard':
        return <Leaderboard leaderboardData={leaderboard} onRestart={handleRestartGame} onEnd={handleEndEvent} isHost={isHost} />;
      default:
        return <div>Loading...</div>;
    }
  };

  return <div>{renderContent()}</div>;
};

const styles = `body{font-family:'Arial',sans-serif;margin:0;padding:0;box-sizing:border-box;color:#fff;background:radial-gradient(circle at center,#2e2e2e 0%,#0a0a0a 100%)}.login-container,.leaderboard-container,.game-container{height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center}.login-form-box{background:rgba(58,63,74,.9);padding:30px 40px;border-radius:10px;box-shadow:0 4px 8px rgba(0,0,0,.2);text-align:center;width:300px}.logo{max-width:150px;height:auto;margin-bottom:10px;filter:drop-shadow(0 0 10px #fff)}.user-id{margin-top:15px;font-size:.8em;color:#a0a0a0}.animated-title{font-size:2em;margin-bottom:0;animation:fadeInDown 1s ease-in-out}.animated-subtitle{font-size:1.5em;margin-top:5px;margin-bottom:15px;animation:fadeInDown 1.2s ease-in-out}.login-form{display:flex;flex-direction:column;gap:10px}.login-form input,.game-select{width:100%;padding:10px;border:none;border-radius:5px;background:#282c34;color:#fff;font-size:1em}.login-button,.host-controls button{padding:12px;border:none;border-radius:5px;background:#000;color:#fff;font-size:1.1em;font-weight:700;cursor:pointer;transition:all .3s ease;box-shadow:0 4px 15px rgba(255,255,255,.2),inset 0 0 10px rgba(255,255,255,.1)}.login-button:hover,.host-controls button:hover{background:#111;box-shadow:0 4gpx 20px rgba(255,255,255,.3),inset 0 0 15px rgba(255,255,255,.2)}@keyframes fadeInDown{0%{opacity:0;transform:translateY(-20px)}100%{opacity:1;transform:translateY(0)}}.host-code-display{font-size:3em;font-weight:700;color:#61dafb;margin-bottom:20px}.loading-message,.waiting-message{font-size:1.2em;color:#a0a0a0}.host-controls{display:flex;flex-direction:column;gap:10px;margin-top:20px; width: 100%;}.host-controls button:disabled{background-color:#555;cursor:not-allowed;box-shadow:none;opacity:.7}.game-container{background-color:#1c1c1c}.timer{font-size:2em;font-weight:700;margin-bottom:20px;background:rgba(0,0,0,.6);padding:5px 15px;border-radius:8px}.images{display:flex;justify-content:center;gap:20px}.image-wrapper{position:relative}.image-wrapper img{max-width:400px;border-radius:8px;box-shadow:0 4px 8px rgba(0,0,0,.2);cursor:pointer}.circle{position:absolute;border:3px solid #ff7eb3;background-color:rgba(255,126,179,.2);border-radius:50%;width:30px;height:30px;pointer-events:none}.found-count{font-size:1.2em;margin-top:20px}.leaderboard-container{background:radial-gradient(circle at center,#1a1a1a 0%,#000 100%);padding:20px;box-shadow:inset 0 0 50px rgba(255,255,255,.1)}.scores-list{width:80%;max-width:600px;background:rgba(50,50,50,.9);border-radius:10px;box-shadow:0 4px 8px rgba(0,0,0,.4),inset 0 0 15px rgba(255,255,255,.1);overflow:hidden}.scores-list table{width:100%;border-collapse:collapse;text-align:center}.scores-list th,.scores-list td{padding:15px;border-bottom:1px solid #4a4f59}.scores-list tr:last-child td{border-bottom:none}@media (max-width:768px){.images{flex-direction:column;align-items:center}.image-wrapper img{max-width:100%}.scores-list{width:100%}}.game-select{background: #333;color: #fff;border: 1px solid #555;padding: 10px;margin-bottom: 20px;}.image-scramble-game{background: #000;}.image-grid{display:grid;grid-template-columns:repeat(3, 1fr);gap:5px;width:calc(100% - 10px);max-width:600px;background:#333;padding:5px;border-radius:10px;}.image-piece{border:2px solid transparent;transition:border-color .2s;cursor:pointer;}.image-piece img{display:block;width:100%;height:auto;border-radius:5px;}.image-piece.selected{border-color:#61dafb;}.host-controls .game-select {margin-bottom: 10px;}`
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default App;
