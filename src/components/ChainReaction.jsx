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

// The session id passed in via a shareable link: ...?session=ABC123
const sessionFromUrl = new URLSearchParams(window.location.search).get("session");

const loadSavedName = () => {
  try {
    return localStorage.getItem("crPlayerName") || "";
  } catch {
    return "";
  }
};

export const ChainReaction = () => {
  const [playerName, setPlayerName] = useState(loadSavedName);
  const [joinCodeInput, setJoinCodeInput] = useState(sessionFromUrl || "");
  const [joinedSession, setJoinedSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [joinedUsers, setJoinedUsers] = useState(0);
  const [copied, setCopied] = useState(false);

  const [grid, setGrid] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [winner, setWinner] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [timeLeft, setTimeLeft] = useState(null);
  const [turnDuration, setTurnDuration] = useState(null);
  const [skipToast, setSkipToast] = useState(null);
  const [explodedAt, setExplodedAt] = useState(null);

  const timerIntervalRef = useRef(null);
  const skipToastTimerRef = useRef(null);
  const shareInputRef = useRef(null);

  // Name -> label lookup so the UI can show names while the engine stays
  // label-based (board cells, turns and the winner are all labels).
  const nameByLabel = Object.fromEntries(
    (players ?? []).filter(Boolean).map((p) => [p.label, p.name])
  );
  const labelToName = (label) => nameByLabel[label] ?? label;

  const shareUrl = joinedSession
    ? `${window.location.origin}${window.location.pathname}?session=${joinedSession}`
    : "";

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

    // Reflect the joined room in the URL so it's directly shareable / refreshable.
    const onJoined = (sessionId) => {
      setJoinedSession(sessionId);
      const url = `${window.location.pathname}?session=${sessionId}`;
      window.history.replaceState(null, "", url);
    };

    socket.on("sessionCreated", onJoined);
    socket.on("sessionJoined", onJoined);
    socket.on("playerAssigned", (player) => setMyPlayer(player));
    socket.on("playerJoined", (playersList) => setPlayers(playersList));
    socket.on("playerLeft", (playersList) => setPlayers(playersList));
    socket.on("error", (message) => setErrorMessage(message));
    socket.on("userCount", (userCount) => setJoinedUsers(userCount));

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
      setSkipToast(`${labelToName(skippedPlayer)}'s turn timed out`);
      skipToastTimerRef.current = setTimeout(() => setSkipToast(null), 3000);
    });

    return () => {
      socket.off("sessionCreated", onJoined);
      socket.off("sessionJoined", onJoined);
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
    // labelToName is derived from state and only used inside the toast handler;
    // re-subscribing on every player change isn't needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rememberName = (name) => {
    try {
      localStorage.setItem("crPlayerName", name);
    } catch {
      /* ignore storage errors */
    }
  };

  const requireName = () => {
    const name = playerName.trim();
    if (!name) {
      setErrorMessage("Please enter your name first.");
      return null;
    }
    rememberName(name);
    return name;
  };

  const handleCreateGame = () => {
    const name = requireName();
    if (!name) return;
    socket.emit("createSession", { playerName: name });
  };

  const handleJoinGame = (codeArg) => {
    const name = requireName();
    if (!name) return;
    const sessionId = (codeArg ?? joinCodeInput).trim();
    if (!sessionId) {
      setErrorMessage("Enter a game code (or open an invite link).");
      return;
    }
    socket.emit("joinSession", { sessionId, playerName: name });
  };

  const handleLeaveSession = () => {
    if (!joinedSession) return;
    socket.emit("leaveSession", joinedSession);
    clearInterval(timerIntervalRef.current);
    window.history.replaceState(null, "", window.location.pathname);
    setJoinedSession(null);
    setPlayers([]);
    setGrid(null);
    setCurrentTurn(null);
    setMyPlayer(null);
    setWinner(null);
    setTimeLeft(null);
    setTurnDuration(null);
    setSkipToast(null);
    setJoinCodeInput("");
  };

  const handleRestart = () => socket.emit("restartGame");
  const handleCellClick = (row, col) => socket.emit("cellClicked", row, col);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API isn't available (e.g. plain-http LAN) — select for manual copy.
      shareInputRef.current?.select();
    }
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
        <div className="lobby">
          <label className="field-label" htmlFor="player-name">
            Your name
          </label>
          <input
            id="player-name"
            type="text"
            className="lobby-input"
            placeholder="e.g. Alex"
            maxLength={20}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          {sessionFromUrl ? (
            <>
              <p className="lobby-hint">
                You&apos;ve been invited to game{" "}
                <strong>{sessionFromUrl}</strong>
              </p>
              <button className="primary-btn" onClick={() => handleJoinGame(sessionFromUrl)}>
                Join game
              </button>
              <button className="link-btn" onClick={handleCreateGame}>
                or start your own game
              </button>
            </>
          ) : (
            <>
              <button className="primary-btn" onClick={handleCreateGame}>
                Create new game
              </button>

              <div className="lobby-divider"><span>or join with a code</span></div>

              <div className="join-row">
                <input
                  type="text"
                  className="lobby-input"
                  placeholder="Game code"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinGame()}
                />
                <button onClick={() => handleJoinGame()}>Join</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="session-bar">
            <h2 className="session-title">Game {joinedSession}</h2>
            <button className="leave-btn" onClick={handleLeaveSession}>Leave</button>
          </div>

          <div className="share-box">
            <span className="share-label">Invite link</span>
            <input
              ref={shareInputRef}
              className="share-input"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
            />
            <button className="copy-btn" onClick={handleCopyLink}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <ul className="players-list">
            {(players ?? []).filter(Boolean).map((player) => {
              const c = PLAYER_COLORS[player.label] ?? {};
              const isCurrent = currentTurn === player.label;
              const isMe = myPlayer === player.label;
              return (
                <li
                  key={player.label}
                  className="player-item"
                  style={{
                    color: c.text,
                    borderColor: isCurrent ? c.text : "transparent",
                    background: isCurrent ? c.bg : "rgba(255,255,255,0.04)",
                  }}
                >
                  <span className="player-dot" style={{ background: c.dot }} />
                  {player.name}
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
                  {isMyTurn ? "Your turn!" : `${labelToName(currentTurn)}'s turn`}
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
              {myPlayer ? `You are ${labelToName(myPlayer)}` : "Spectating"} —
              waiting for another player to join…
            </p>
          )}

          {winner && (
            <div style={{ margin: "1em 0" }}>
              <h3 style={{ color: (PLAYER_COLORS[winner] ?? {}).text, margin: "0 0 0.5em" }}>
                {labelToName(winner)} wins! 🎉
              </h3>
              {myPlayer && <button onClick={handleRestart}>Play again</button>}
            </div>
          )}
        </div>
      )}

      {joinedSession && !winner && (
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
