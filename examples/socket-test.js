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
const URL = 'http://localhost:8000';
const PATH = '/socket.io';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImU4MWYwNTJhZWYwNDBhOTdjMzlkMjY1MzgxZGU2Y2I0MzRiYzM1ZjMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYmlkbWFzdGVyLTM1MDY2IiwiYXVkIjoiYmlkbWFzdGVyLTM1MDY2IiwiYXV0aF90aW1lIjoxNzU5NjczNDMzLCJ1c2VyX2lkIjoiRzZuWExRSk12dGF5RHpUaFBoeTUwOHZybUdaMiIsInN1YiI6Ikc2blhMUUpNdnRheUR6VGhQaHk1MDh2cm1HWjIiLCJpYXQiOjE3NTk2NzM0MzMsImV4cCI6MTc1OTY3NzAzMywiZW1haWwiOiJiaWRtYXN0ZXIxQHlvcG1haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbImJpZG1hc3RlcjFAeW9wbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJjdXN0b20ifX0.IzC2rBe0K8Rs9FVwK3Xt7ShDJtcb4rxnsTtHIJjAeOMMWy2lOCIpXyDlqlpVWCdeGaSh1MYNturyUjGRjtHRTH4y0wW_l9Z3UZerbSVu4IsQxzjmbGOXvUO84JIQ30eCszLCxsE9BOCw7oq00SNDo5BQhCUy58BlUXB4pf7PTfkoLvAkcfI4O7KJ6mMenUWvdBITMDT_4nbzpV1atsHcgNEUtyP_Bg3M21CkGcxYGtiW703VjJ14PZY1tbpdEBY3HOmr6yQuK2BNACm5KmPY_lPaXq_tp2EnDG1KaQ-ZNuZlAfm0j3EliCrivQ0tbPv10nULkqFjPWTXKaV-WZJoMQ';
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
