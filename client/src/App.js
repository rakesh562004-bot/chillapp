import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:4000"); 
const CORRECT_PASSWORD = "rakoverse";

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [videoId, setVideoId] = useState("dQw4w9WgXcQ"); // YouTube ID only
  const [userInteracted, setUserInteracted] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [micEnabled, setMicEnabled] = useState(false);

  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const webcamRef = useRef(null);

  // Socket listeners
  useEffect(() => {
    socket.on("connect", () => console.log("Connected:", socket.id));

    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, `${data.sender}: ${data.text}`]);
    });

    socket.on("sync_video", (data) => {
      if (data.url) {
        const id = extractVideoId(data.url);
        if (id) setVideoId(id);
      }
      if (typeof data.playing === "boolean") setPlaying(data.playing);
    });

    return () => {
      socket.off("receive_message");
      socket.off("sync_video");
    };
  }, []);

  // Webcam + microphone setup
  useEffect(() => {
    if (!authenticated) return;
    async function initWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setWebcamStream(stream);
        if (webcamRef.current) webcamRef.current.srcObject = stream;
      } catch (err) {
        console.error("Could not access webcam:", err);
      }
    }
    initWebcam();
  }, [authenticated]);

  // Function to toggle mic
  const toggleMic = async () => {
    if (!micEnabled) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (webcamStream) {
          audioStream.getTracks().forEach(track => webcamStream.addTrack(track));
          setWebcamStream(webcamStream);
          if (webcamRef.current) webcamRef.current.srcObject = webcamStream;
        }
        setMicEnabled(true);
      } catch (err) {
        console.error("Microphone error:", err);
      }
    } else {
      // turn off mic
      if (webcamStream) {
        webcamStream.getAudioTracks().forEach(track => track.stop());
      }
      setMicEnabled(false);
    }
  };

  // YouTube API loader
  useEffect(() => {
    let player;
    const loadYouTubeAPI = () => {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          resolve();
        } else {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          tag.onload = () => {
            const checkYT = setInterval(() => {
              if (window.YT && window.YT.Player) {
                clearInterval(checkYT);
                resolve();
              }
            }, 100);
          };
          document.body.appendChild(tag);
        }
      });
    };

    loadYouTubeAPI().then(() => {
      player = new window.YT.Player(iframeRef.current, {
        videoId,
        events: {
          onReady: (event) => {
            if (playing && userInteracted) event.target.playVideo();
          },
          onStateChange: (event) => {
            if (!userInteracted) return;
            if (event.data === window.YT.PlayerState.PLAYING && !playing) {
              setPlaying(true);
              socket.emit("sync_video", { playing: true, url: `https://youtu.be/${videoId}` });
            }
            if (event.data === window.YT.PlayerState.PAUSED && playing) {
              setPlaying(false);
              socket.emit("sync_video", { playing: false, url: `https://youtu.be/${videoId}` });
            }
          },
        },
      });
      playerRef.current = player;
    });
  }, [videoId, playing, userInteracted]);

  const handleLogin = () => {
    if (password === CORRECT_PASSWORD) setAuthenticated(true);
    else alert("Incorrect password!");
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    const data = { sender: "You", text: message };
    socket.emit("send_message", data);
    setChat((prev) => [...prev, `You: ${message}`]);
    setMessage("");
  };

  const togglePlay = () => {
    if (!userInteracted) setUserInteracted(true);
    if (!playerRef.current) return;
    if (playing) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
    setPlaying(!playing);
    socket.emit("sync_video", { playing: !playing, url: `https://youtu.be/${videoId}` });
  };

  const handleUrlChange = (e) => {
    const url = e.target.value.trim();
    const id = extractVideoId(url);
    if (id) {
      setVideoId(id);
      if (userInteracted) socket.emit("sync_video", { url, playing });
    } else console.warn("Invalid YouTube URL");
  };

  const extractVideoId = (url) => {
    const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };

  if (!authenticated)
    return (
      <div className="app-container">
        <h1>Enter Password</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password..."
        />
        <br />
        <button onClick={handleLogin}>Enter</button>
      </div>
    );

  return (
    <div className="app-container">
      <h1>Chill App Watch Party + Webcam</h1>

      {/* YouTube IFrame */}
      <div style={{ width: "640px", height: "360px" }} ref={iframeRef}></div>
      <br />
      <button onClick={togglePlay}>{playing ? "Pause" : "Play"} for Everyone</button>

      {/* YouTube URL input */}
      <div style={{ marginTop: "20px" }}>
        <input
          type="text"
          placeholder="Paste YouTube URL..."
          onChange={handleUrlChange}
          style={{ width: "400px" }}
        />
      </div>

      {/* Webcam preview */}
      <h2 style={{ marginTop: "30px" }}>Your Webcam</h2>
      <video
        ref={webcamRef}
        autoPlay
        muted={!micEnabled}   // mute unless mic is ON
        playsInline
        style={{ width: "320px", height: "240px", background: "black" }}
      ></video>
      <br />
      <button onClick={toggleMic}>
        {micEnabled ? "Turn Microphone Off" : "Turn Microphone On"}
      </button>

      <hr style={{ margin: "40px 0", borderColor: "#00f2ff" }} />

      {/* Chat */}
      <h2>Chat</h2>
      <div className="chat-box">
        {chat.map((msg, idx) => (
          <p key={idx}>{msg}</p>
        ))}
      </div>
      <input
        type="text"
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <br />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;
