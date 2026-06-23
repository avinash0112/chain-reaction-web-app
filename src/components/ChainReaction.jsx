import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import ChainReactionGrid from "./grid/Grid";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";
const socket = io(SERVER_URL);

export const ChainReaction = () => {
  const [sessionNameInput, setSessionNameInput] = useState("");
  const [joinedSession, setJoinedSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [joinedUsers, setJoinedUsers] = useState(0);

  const [grid, setGrid] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null); // "P1" | "P2" | null (spectator)
  const [winner, setWinner] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Tracks which session name we just asked to join, so we can confirm it
  // only once the server actually says so (sessionJoined), instead of
  // optimistically flipping the UI before we know it worked.
  const pendingSessionRef = useRef(null);

  useEffect(() => {
    socket.on("sessionCreated", (name) => {
      setJoinedSession(name);
      pendingSessionRef.current = null;
    });

    socket.on("sessionJoined", (name) => {
      setJoinedSession(name);
      pendingSessionRef.current = null;
    });

    socket.on("playerAssigned", (player) => {
      setMyPlayer(player); // null means spectator
    });

    socket.on("playerJoined", (playersList) => {
      setPlayers(playersList);
    });

    socket.on("playerLeft", (playersList) => {
      setPlayers(playersList);
    });

    socket.on("error", (message) => {
      // If a pending join/create failed, don't leave the UI stuck
      // thinking we're in a session.
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

    socket.on("gameUpdateByOther", ({ grid, currentTurn }) => {
      setGrid(grid);
      setCurrentTurn(currentTurn);
    });

    socket.on("gameOver", ({ winner }) => {
      setWinner(winner);
    });

    socket.on("gameRestarted", ({ grid, currentTurn }) => {
      setGrid(grid);
      setCurrentTurn(currentTurn);
      setWinner(null);
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
      setJoinedSession(null);
      setPlayers([]);
      setGrid(null);
      setCurrentTurn(null);
      setMyPlayer(null);
      setWinner(null);
    }
  };

  const handleRestart = () => {
    socket.emit("restartGame");
  };

  const handleCellClick = (row, col) => {
    socket.emit("cellClicked", row, col);
  };

  const isMyTurn = myPlayer !== null && myPlayer === currentTurn;

  return (
    <>
      <div>{`Active users: ${joinedUsers}`}</div>

      {errorMessage && (
        <div className="error-banner">
          {errorMessage}
          <button onClick={() => setErrorMessage(null)}>Dismiss</button>
        </div>
      )}

      {!joinedSession ? (
        <div>
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
          <h2>Session: {joinedSession}</h2>
          <button onClick={handleLeaveSession}>Leave Session</button>
          <h3>Players in session:</h3>
          <ul>
            {(players ?? []).filter(Boolean).map((player) => (
              <li key={player}>{player}</li>
            ))}
          </ul>

          <p>
            {myPlayer ? `You are ${myPlayer}` : "You're spectating"}
            {!winner && currentTurn && ` — Current turn: ${currentTurn}`}
          </p>

          {winner && (
            <div>
              <h3>{winner} wins!</h3>
              <button onClick={handleRestart}>Play again</button>
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
        />
      )}
    </>
  );
};