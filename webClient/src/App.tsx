import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const [userId, setUserId] = useState('');
  const [connected, setConnected] = useState(false);
  interface PartnerData {
    userId: string;
  }

  const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (connected && partnerData) {
      console.log('Connected with:', partnerData.userId);
    }
  }, [connected, partnerData]);

  const initializeWebSocket = () => {
    ws.current = new WebSocket('ws://localhost:3000');

    ws.current.onopen = () => {
      console.log('Connected to WebSocket server');
    };

    ws.current.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);

      if (message.type === 'start_call') {
        console.log('Starting call with:', message.peerId);
        setPartnerData({ userId: message.peerId });
        await createPeerConnection(message.peerId, true); // Initiate offer
      } else if (message.type === 'ice_candidate') {
        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(message.candidate));
      } else if (message.type === 'offer') {
        await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(message.sdp));
        const answer = await peerConnection.current?.createAnswer();
        await peerConnection.current?.setLocalDescription(answer);
        ws.current?.send(JSON.stringify({
          type: 'answer',
          sdp: answer,
          targetPeerId: message.peerId
        }));
      } else if (message.type === 'answer') {
        await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(message.sdp));
      }
    };

    ws.current.onclose = () => {
      console.log('Disconnected from WebSocket server');
    };
  };

  const createPeerConnection = async (peerId: string, isInitiator: boolean) => {
    peerConnection.current = new RTCPeerConnection(servers);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(track => {
      peerConnection.current?.addTrack(track, stream);
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    peerConnection.current.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current?.send(JSON.stringify({
          type: 'ice_candidate',
          candidate: event.candidate,
          targetPeerId: peerId
        }));
      }
    };

    if (isInitiator) {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      ws.current?.send(JSON.stringify({
        type: 'offer',
        sdp: offer,
        targetPeerId: peerId
      }));
    }

    setConnected(true);
  };

  const joinQueue = async () => {
    if (!userId) {
      alert('Please enter a User ID');
      return;
    }
    setIsWaiting(true);
    initializeWebSocket();

    ws.current?.send(JSON.stringify({
      type: 'join_queue',
      userId,
    }));
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>WebRTC App</h1>
      <input
        type="text"
        placeholder="Enter your user ID"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        style={{ marginBottom: '20px', padding: '10px', width: '300px' }}
      />
      <br />
      <button onClick={joinQueue} disabled={isWaiting}>
        {isWaiting ? 'Waiting for another user...' : 'Connect'}
      </button>

      {connected && partnerData && (
        <div>
          <h3>Connected with {partnerData.userId}</h3>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '300px' }}></video>
        </div>
      )}

      <h3>Your Video:</h3>
      <video ref={localVideoRef} autoPlay playsInline style={{ width: '300px' }}></video>
    </div>
  );
}

export default App;