/*
Usage:
  1) Install deps: npm install
  2) Edit the constants below (URL, PATH, TOKEN, REQUIREMENT_ID)
  3) Run: node examples/socket-test.js

This client connects to the server, authenticates, joins the requirement room,
then logs real-time updates:
- bid:new (room-wide)
- bid:updated (room-wide)
- bid:rank (per-user)
- requirement:stats (room-wide total unique bidders)
*/

const { io } = require('socket.io-client');

// ----- Configure these values -----
// const URL = 'http://localhost:8000';
const URL = 'http://68.183.85.147'
const PATH = '/socket.io';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MDI5MzRmZTBlZWM0NmE1ZWQwMDA2ZDE0YTFiYWIwMWUzNDUwODMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYmlkbWFzdGVyLTM1MDY2IiwiYXVkIjoiYmlkbWFzdGVyLTM1MDY2IiwiYXV0aF90aW1lIjoxNzYzNDYxNTcxLCJ1c2VyX2lkIjoidm5qZWs5cWExaWJuWUFWblFHU1JJdTFYNzAwMiIsInN1YiI6InZuamVrOXFhMWlibllBVm5RR1NSSXUxWDcwMDIiLCJpYXQiOjE3NjM0NjE1NzEsImV4cCI6MTc2MzQ2NTE3MSwiZW1haWwiOiJiaWRtYXN0ZXI0QHlvcG1haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImJpZG1hc3RlcjRAeW9wbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJjdXN0b20ifX0.eHl3jhn8JY9Of4Hni8ZCqDB_VWuqRaS6mF-uf9UxBpjnw394T5xjA1ZvJPcIfaA_s0abin9JX4bodBO_n6-jmrjzeWdarAjSCfa6Vx8B-_Kdj8KOZAAt-di8weiA8azB5SCEUVtQMphhMuNpQewYzPF-cEpjuUjXbZDZ8qznce6zDZU6d7QGxnh2tO9v-f4QhUpH1SkjwKCEXns8mvxJiDTV51v-gUHnSRx4kEdLrQUdQ22aGloDs8E20UhzO9PITyMWHtt8pbSJtsB6YE8So0l5HHvBdGFnULHU_zRMjd-Pfn50GidSN_onvKpVxlXOfmuKGnEmv2EU94xnmxR5mg';
const REQUIREMENT_ID = '68e0d171f13c64e2af9f3b4f';
// ----------------------------------

async function main() {
  const url = URL;
  const path = PATH;
  const token = TOKEN;
  const requirementId = REQUIREMENT_ID;

  if (!token) {
    console.error('Missing TOKEN (Firebase ID token). Provide it by editing TOKEN constant in this file.');
    process.exit(1);
  }
  if (!requirementId) {
    console.error('Missing REQUIREMENT_ID. Provide it by editing REQUIREMENT_ID constant in this file.');
    process.exit(1);
  }

  console.log('Connecting...', { url, path, requirementId });

  const socket = io(url, {
    path,
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  function joinReq() {
    socket.emit('join:requirement', { requirementId }, (res) => {
      if (!res?.ok) {
        console.error('Join failed:', res?.error);
        return;
      }
      console.log('Joined requirement room (ack):', requirementId);
    });
  }

  socket.on('connect', () => {
    console.log('Connected. Socket ID:', socket.id);
    joinReq();
  });

  socket.on('connect_error', (err) => {
    console.error('Connect error:', err?.message || err);
  });

  socket.on('error', (msg) => {
    console.error('Server error event:', msg);
  });

  socket.on('joined:requirement', (payload) => {
    console.log('joined:requirement', payload);
  });

  socket.on('left:requirement', (payload) => {
    console.log('left:requirement', payload);
  });

  socket.on('bid:new', (payload) => {
    console.log('bid:new', JSON.stringify(payload, null, 2));
  });

  socket.on('bid:updated', (payload) => {
    console.log('bid:updated', JSON.stringify(payload, null, 2));
  });

  socket.on('bid:rank', (payload) => {
    console.log('bid:rank', JSON.stringify(payload, null, 2));
  });

  socket.on('requirement:stats', (payload) => {
    console.log('requirement:stats', JSON.stringify(payload, null, 2));
  });

  // Re-join on reconnects
  socket.on('reconnect', () => {
    console.log('Reconnected. Rejoining requirement room...');
    joinReq();
  });

  // Graceful exit
  const shutdown = () => {
    try { socket.close(); } catch (_) {}
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Fatal', e);
  process.exit(1);
});
