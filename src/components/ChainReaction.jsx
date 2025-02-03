import io from "socket.io-client";
const socket = io("http://localhost:3000");
import { useState, useEffect } from "react";
import ChainReactionGrid from "./grid/Grid";

export const ChainReaction = () => {
  const [sessionName, setSessionName] = useState("");
  const [joinedSession, setJoinedSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [joinedUsers, setJoinedUsers] = useState(0);
  const [sGrid, setSGrid] = useState(null);

  useEffect(() => {
    socket.on("sessionCreated", (name) => {
      setJoinedSession(name);
    });

    socket.on("playerJoined", (playersList) => {
      setPlayers(playersList);
    });

    socket.on("playerLeft", (playersList) => {
      setPlayers(playersList);
    });

    socket.on("error", (message) => {
      alert(message);
    });

    socket.on("userCount", (userCount) => {
      setJoinedUsers(userCount);
    });

    socket.on("initialGameState", (iniState) => {
      setSGrid(iniState);
    });

    socket.on("gameUpdateByOther", (updatedGameState) => {
      setSGrid(updatedGameState);
    });

    return () => {
      socket.off("sessionCreated");
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("error");
      socket.off("userCount");
      socket.off("initialGameState");
      socket.off("gameUpdateByOther");
    };
  }, []);
  const handleCreateSession = () => {
    if (sessionName) {
      socket.emit("createSession", sessionName);
    }
  };

  const handleJoinSession = () => {
    if (sessionName) {
      socket.emit("joinSession", sessionName);
      setJoinedSession(sessionName);
    }
  };

  const handleLeaveSession = () => {
    if (joinedSession) {
      socket.emit("leaveSession", joinedSession);
      setJoinedSession(null);
      setPlayers([]);
    }
  };

  const handleGameStateUpdate = (row, col) => {
    socket.emit("cellClicked", row, col);
  };

  return (
    <>
      <div>{`Active users : ${joinedUsers}`}</div>
      {!joinedSession ? (
        <div>
          <input
            type="text"
            placeholder="Session Name"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
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
            {players.map((player) => (
              <li key={player}>{player}</li>
            ))}
          </ul>
        </div>
      )}
      <ChainReactionGrid
        // rows={6}
        // cols={6}
        sGrid={sGrid}
        setSGrid={setSGrid}
        handleCellClick={handleGameStateUpdate}
      />
    </>
  );
};
