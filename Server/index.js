const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());

let queue = [];
const peers = new Map(); // Map to store WebSocket connections by userId

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    console.log('Received message:', message);
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON:', message);
      return;
    }

    if (data.type === 'join_queue') {
      queue.push({ ws, userId: data.userId });
      peers.set(data.userId, ws);
      console.log(`User ${data.userId} added to queue`);

      if (queue.length >= 2) {
        const user1 = queue.shift();
        const user2 = queue.shift();

        user1.ws.send(JSON.stringify({ type: 'start_call', peerId: user2.userId }));
        user2.ws.send(JSON.stringify({ type: 'start_call', peerId: user1.userId }));
        console.log('Matched two users for call');

        // Incorrect Peer Mapping
        peers.set(user1.userId, user2.ws);
        peers.set(user2.userId, user1.ws);
      }
    } else if (data.type === 'ice_candidate' && data.candidate) {
      const targetPeerId = data.targetPeerId;
      if (targetPeerId) {
        const targetPeer = peers.get(targetPeerId);
        if (targetPeer) {
          targetPeer.send(JSON.stringify({
            type: 'ice_candidate',
            candidate: data.candidate,
            peerId: data.userId // Include the sender's userId
          }));
          console.log(`Forwarded ICE candidate to peer ${targetPeerId}`);
        } else {
          console.error(`Peer ${targetPeerId} not found`);
        }
      } else {
        console.error('targetPeerId is missing in the ICE candidate message');
      }
    } else if (data.type === 'offer' && data.sdp) {
      const targetPeerId = data.targetPeerId;
      if (targetPeerId) {
        const targetPeer = peers.get(targetPeerId);
        if (targetPeer) {
          targetPeer.send(JSON.stringify({
            type: 'offer',
            sdp: data.sdp,
            peerId: data.userId // Include the sender's userId
          }));
          console.log(`Forwarded offer to peer ${targetPeerId}`);
        } else {
          console.error(`Peer ${targetPeerId} not found`);
        }
      } else {
        console.error('targetPeerId is missing in the offer message');
      }
    } else if (data.type === 'answer' && data.sdp) {
      const targetPeerId = data.targetPeerId;
      if (targetPeerId) {
        const targetPeer = peers.get(targetPeerId);
        if (targetPeer) {
          targetPeer.send(JSON.stringify({
            type: 'answer',
            sdp: data.sdp,
            peerId: data.userId // Include the sender's userId
          }));
          console.log(`Forwarded answer to peer ${targetPeerId}`);
        } else {
          console.error(`Peer ${targetPeerId} not found`);
        }
      } else {
        console.error('targetPeerId is missing in the answer message');
      }
    } else {
      console.error('Unknown message type or missing data:', data);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    queue = queue.filter(client => client.ws !== ws);
    for (let [userId, peerWs] of peers.entries()) {
      if (peerWs === ws) {
        peers.delete(userId);
        break;
      }
    }
  });
});``

server.listen(3000, () => {
  console.log('Server running on port 3000');
});