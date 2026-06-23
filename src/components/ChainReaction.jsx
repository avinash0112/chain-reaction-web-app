import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import ChainReactionGrid from "./grid/Grid";

// Connect to the backend on the SAME host that served this page, on port 3000.
// That way it works whether the page is opened locally (localhost) or from
// another device over the LAN/WiFi (http://<your-PC-IP>:5173 -> <your-PC-IP>:3000).
// An explicit VITE_SERVER_URL (e.g. for a deployed backend) always wins.
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  `${window.location.protocol}//${window.location.hostname}:3000`;
const socket = io(SERVER_URL);

const PLAYER_COLORS = {
  P0: { text: "#ff5252", bg: "rgba(255,82,82,0.12)", dot: "red",   bar: "#ff5252" },
  P1: { text: "#448aff", bg: "rgba(68,138,255,0.12)", dot: "blue", bar: "#448aff" },
  P2: { text: "#69f0ae", bg: "rgba(105,240,174,0.12)", dot: "green", bar: "#69f0ae" },
  P3: { text: "#ffd740", bg: "rgba(255,215,64,0.12)",  dot: "#ffd740", bar: "#ffd740" },
};

export const ChainReaction = () => {
  const [sessionNameInput, setSessionNameInput] = useState("");
  const [joinedSession, setJoinedSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [joinedUsers, setJoinedUsers] = useState(0);

  const [grid, setGrid] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [winner, setWinner] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [timeLeft, setTimeLeft] = useState(null);
  const [turnDuration, setTurnDuration] = useState(null);
  const [skipToast, setSkipToast] = useState(null);
  const [explodedAt, setExplodedAt] = useState(null);

  const pendingSessionRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const skipToastTimerRef = useRef(null);

  useEffect(() => {
    const startClientTimer = (durationMs) => {
      clearInterval(timerIntervalRef.current);
      const seconds = Math.floor(durationMs / 1000);
      setTimeLeft(seconds);
      setTurnDuration(seconds);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const stopClientTimer = () => {
      clearInterval(timerIntervalRef.current);
      setTimeLeft(null);
      setTurnDuration(null);
    };

    socket.on("sessionCreated", (name) => {
      setJoinedSession(name);
      pendingSessionRef.current = null;
    });

    socket.on("sessionJoined", (name) => {
      setJoinedSession(name);
      pendingSessionRef.current = null;
    });

    socket.on("playerAssigned", (player) => {
      setMyPlayer(player);
    });

    socket.on("playerJoined", (playersList) => {
      setPlayers(playersList);
    });

    socket.on("playerLeft", (playersList) => {
      setPlayers(playersList);
    });

    socket.on("error", (message) => {
      pendingSessionRef.current = null;
      setErrorMessage(message);
    });

    socket.on("userCount", (userCount) => {
      setJoinedUsers(userCount);
    });

    socket.on("initialGameState", ({ grid, currentTurn }) => {
      setGrid(grid);
      setCurrentTurn(currentTurn);
      setWinner(null);
    });

    socket.on("gameUpdateByOther", ({ grid, currentTurn, explodedAt }) => {
      setGrid(grid);
      if (currentTurn !== undefined) setCurrentTurn(currentTurn);
      setExplodedAt(explodedAt ?? null);
    });

    socket.on("gameOver", ({ winner }) => {
      setWinner(winner);
      stopClientTimer();
    });

    socket.on("gameRestarted", ({ grid, currentTurn }) => {
      setGrid(grid);
      setCurrentTurn(currentTurn);
      setWinner(null);
      setSkipToast(null);
      setExplodedAt(null);
      stopClientTimer();
    });

    socket.on("turnTimer", ({ currentTurn, duration }) => {
      setCurrentTurn(currentTurn);
      startClientTimer(duration);
    });

    socket.on("turnPaused", () => {
      clearInterval(timerIntervalRef.current);
      setTimeLeft(null);
      setTurnDuration(null);
      setExplodedAt(null);
    });

    socket.on("turnSkipped", ({ skippedPlayer, currentTurn }) => {
      setCurrentTurn(currentTurn);
      clearTimeout(skipToastTimerRef.current);
      setSkipToast(`${skippedPlayer}'s turn timed out`);
      skipToastTimerRef.current = setTimeout(() => setSkipToast(null), 3000);
    });

    return () => {
      socket.off("sessionCreated");
      socket.off("sessionJoined");
      socket.off("playerAssigned");
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("error");
      socket.off("userCount");
      socket.off("initialGameState");
      socket.off("gameUpdateByOther");
      socket.off("gameOver");
      socket.off("gameRestarted");
      socket.off("turnTimer");
      socket.off("turnPaused");
      socket.off("turnSkipped");
      clearInterval(timerIntervalRef.current);
      clearTimeout(skipToastTimerRef.current);
    };
  }, []);

  const handleCreateSession = () => {
    if (sessionNameInput) {
      pendingSessionRef.current = sessionNameInput;
      socket.emit("createSession", sessionNameInput);
    }
  };

  const handleJoinSession = () => {
    if (sessionNameInput) {
      pendingSessionRef.current = sessionNameInput;
      socket.emit("joinSession", sessionNameInput);
    }
  };

  const handleLeaveSession = () => {
    if (joinedSession) {
      socket.emit("leaveSession", joinedSession);
      clearInterval(timerIntervalRef.current);
      setJoinedSession(null);
      setPlayers([]);
      setGrid(null);
      setCurrentTurn(null);
      setMyPlayer(null);
      setWinner(null);
      setTimeLeft(null);
      setTurnDuration(null);
      setSkipToast(null);
    }
  };

  const handleRestart = () => {
    socket.emit("restartGame");
  };

  const handleCellClick = (row, col) => {
    socket.emit("cellClicked", row, col);
  };

  const isMyTurn = myPlayer !== null && myPlayer === currentTurn;

  const timerPercent =
    timeLeft !== null && turnDuration ? (timeLeft / turnDuration) * 100 : 100;
  const timerState =
    timeLeft === null ? "safe" : timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warning" : "safe";
  const timerBarColor =
    timerState === "danger" ? "#ff5252" : timerState === "warning" ? "#ffd740" : "#69f0ae";

  const currentColors = PLAYER_COLORS[currentTurn] ?? {};

  return (
    <>
      <div style={{ color: "#888", fontSize: "0.85em" }}>{`Active users: ${joinedUsers}`}</div>

      {errorMessage && (
        <div className="error-banner">
          {errorMessage}
          <button onClick={() => setErrorMessage(null)}>Dismiss</button>
        </div>
      )}

      {skipToast && <div className="skip-toast">{skipToast}</div>}

      {!joinedSession ? (
        <div style={{ marginTop: "1.5em" }}>
          <input
            type="text"
            placeholder="Session Name"
            value={sessionNameInput}
            onChange={(e) => setSessionNameInput(e.target.value)}
          />
          <button onClick={handleCreateSession}>Create game</button>
          <button onClick={handleJoinSession}>Join game</button>
        </div>
      ) : (
        <div>
          <h2 style={{ marginBottom: "0.4em" }}>Session: {joinedSession}</h2>
          <button onClick={handleLeaveSession}>Leave Session</button>

          <ul className="players-list">
            {(players ?? []).filter(Boolean).map((player) => {
              const c = PLAYER_COLORS[player] ?? {};
              const isCurrent = currentTurn === player;
              const isMe = myPlayer === player;
              return (
                <li
                  key={player}
                  className="player-item"
                  style={{
                    color: c.text,
                    borderColor: isCurrent ? c.text : "transparent",
                    background: isCurrent ? c.bg : "rgba(255,255,255,0.04)",
                  }}
                >
                  <span className="player-dot" style={{ background: c.dot }} />
                  {player}
                  {isMe && <span className="player-badge you-badge">YOU</span>}
                  {isCurrent && (
                    <span className="player-badge playing-badge">PLAYING</span>
                  )}
                </li>
              );
            })}
          </ul>

          {!winner && timeLeft !== null && (
            <div className="turn-timer">
              <div className="timer-header">
                <span style={{ color: currentColors.text, fontWeight: 600 }}>
                  {isMyTurn ? "Your turn!" : `${currentTurn}'s turn`}
                </span>
                <span className="timer-seconds" style={{ color: timerBarColor }}>
                  {timeLeft}s
                </span>
              </div>
              <div className="timer-bar-container">
                <div
                  className="timer-bar-fill"
                  style={{ width: `${timerPercent}%`, background: timerBarColor }}
                />
              </div>
            </div>
          )}

          {!winner && timeLeft === null && (
            <p style={{ color: "#888", fontSize: "0.9em", margin: "0.5em 0" }}>
              {myPlayer ? `You are ${myPlayer}` : "Spectating"} — waiting for
              a second player…
            </p>
          )}

          {winner && (
            <div style={{ margin: "1em 0" }}>
              <h3 style={{ color: (PLAYER_COLORS[winner] ?? {}).text, margin: "0 0 0.5em" }}>
                {winner} wins!
              </h3>
              {myPlayer && <button onClick={handleRestart}>Play again</button>}
            </div>
          )}
        </div>
      )}

      {joinedSession && (
        <ChainReactionGrid
          grid={grid}
          myPlayer={myPlayer}
          isMyTurn={isMyTurn}
          gameOver={!!winner}
          handleCellClick={handleCellClick}
          explodedAt={explodedAt}
        />
      )}
    </>
  );
};