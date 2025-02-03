import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { ChainReaction } from "./components/ChainReaction";
import io from "socket.io-client";

// The server URL
// const socket = io('http://localhost:3000');

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>Welcome to chain reaction</div>
      <ChainReaction />
    </>
  );
}

export default App;
