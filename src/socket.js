const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const config = require('./config/config');
const admin = require('firebase-admin');
const { authService, requirementService } = require('./services');
const { Requirement } = require('./models/requirement.model');
const { Bid } = require('./models/bid.model');
const { setIO: setEventsIO } = require('./events/bid.events');
const { notifyAllBiddersRanks, emitRequirementStats } = require('./events/bid.events');
const { logger } = require('firebase-functions');

let io;
let redisPub;
let redisSub;

function buildRedisClients() {
  // Prefer REDIS_URL if provided (works for local and many managed providers)
  if (config.redis && config.redis.url) {
    const common = {
      retryStrategy(times) {
        // Exponential backoff up to 5 seconds
        return Math.min(times * 100, 5000);
      },
      reconnectOnError(err) {
        // Reconnect on MOVED/ASK and network errors
        const targetErrors = ['READONLY', 'MOVED', 'ASK'];
        return targetErrors.some((code) => err && err.message && err.message.includes(code));
      },
    };
    redisPub = new Redis(config.redis.url, config.redis.tls ? { tls: {} , ...common } : common);
    redisSub = redisPub.duplicate();
    return { pub: redisPub, sub: redisSub };
  }

  // Otherwise fall back to host/port/username/password
  const options = {};
  if (config.redis?.username) options.username = config.redis.username;
  if (config.redis?.password) options.password = config.redis.password;
  if (config.redis?.tls) options.tls = {};
  options.retryStrategy = function (times) {
    return Math.min(times * 100, 5000);
  };
  options.reconnectOnError = function (err) {
    const targetErrors = ['READONLY', 'MOVED', 'ASK'];
    return targetErrors.some((code) => err && err.message && err.message.includes(code));
  };
  const host = config.redis?.host || '127.0.0.1';
  const port = config.redis?.port || 6379;

  redisPub = new Redis({ host, port, ...options });
  redisSub = redisPub.duplicate();
  return { pub: redisPub, sub: redisSub };
}

function initSocket(server) {
  if (io) return io; // idempotent

  io = new Server(server, {
    cors: {
      origin: config.socket?.corsOrigins || ['*'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: config.socket?.path || '/socket.io',
    pingTimeout: config.socket?.pingTimeout || 20000,
    pingInterval: config.socket?.pingInterval || 25000,
    transports: ['websocket', 'polling'],
  });

  // Provide io to events module to avoid circular requires
  try { setEventsIO(io); } catch (_) {}

  // Attach Redis adapter for horizontal scaling
  const { pub, sub } = buildRedisClients();
  io.adapter(createAdapter(pub, sub));

  // Initialize Firebase Admin if not already
  if (!admin.apps || admin.apps.length === 0) {
    try {
      // Reuse the same service account used in firebaseAuth middleware
      const serviceAccount = require('../firebase-service-secret.json');
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (e) {
      // If already initialized elsewhere, ignore
    }
  }

  // Socket auth middleware
  io.use(async (socket, next) => {
    try {
      // Accept token via handshake.auth.token, query.token, or Authorization header
      const authToken = socket.handshake?.auth?.token
        || socket.handshake?.query?.token
        || (socket.handshake?.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!authToken) return next(new Error('Unauthorized: token missing'));

      const payload = await admin.auth().verifyIdToken(authToken, true);
      const user = await authService.getUserByFirebaseUId(payload.uid);
      if (!user) return next(new Error("Unauthorized: user doesn't exist"));
      if (user.isBlocked) return next(new Error('Forbidden: user is blocked'));
      if (user.isDeleted) return next(new Error("Gone: user doesn't exist anymore"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Unauthorized: invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // join a user-specific room for targeted notifications (e.g., rank updates)
    try {
      if (socket.user?._id) {
        socket.join(`user:${socket.user._id.toString()}`);
      }
    } catch (_) {}
    // join a requirement auction room
    socket.on('join:requirement', async ({ requirementId }, ack) => {
      try {
        if (!requirementId) {
          const errMsg = 'requirementId is required';
          if (ack) return ack({ ok: false, error: errMsg });
          return socket.emit('error', errMsg);
        }

        const requirement = await Requirement.findById(requirementId);
        if (!requirement) {
          const errMsg = 'Requirement not found';
          if (ack) return ack({ ok: false, error: errMsg });
          return socket.emit('error', errMsg);
        }

        const user = socket.user;
        // Public if no participants listed
        let authorized = !requirement.participants || requirement.participants.length === 0;

        if (!authorized) {
          const isCreator = requirement.createdBy?.toString() === user._id.toString();
          const isInvited = requirement.participants.some((p) =>
            (p.userId && p.userId.toString() === user._id.toString()) ||
            (p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase())
          );
          authorized = isCreator || isInvited;
        }

        if (!authorized) {
          const errMsg = 'Forbidden: not authorized for this requirement';
          if (ack) return ack({ ok: false, error: errMsg });
          return socket.emit('error', errMsg);
        }
        socket.join(`auction:${requirementId}`);
        // Compute basic info to send on join
        // const totalBidders = await Bid.countDocuments({ requirement: requirementId });
        // const payload = {
        //   requirementId,
        //   totalBidders,
        //   ceilingPrice: requirement.ceilingPrice,
        //   minDecrement: requirement.minDecrement,
        // };
        // if (ack) return ack({ ok: true });
        socket.emit('joined:requirement', { requirementId });
        try {
          emitRequirementStats(requirementId);
        } catch (e) {
          logger.error('Failed to emit requirement stats:', e);
        }
        logger.info('Joined requirement room:', requirementId);
        // Immediately push ranks and leading bid to all bidders in this requirement
        // try { await notifyAllBiddersRanks(requirementId); } catch (e) {
        //   logger.error('Failed to notify ranks:', e);
        // }
      } catch (e) {
        const errMsg = 'Failed to join requirement';
        if (ack) return ack({ ok: false, error: errMsg });
        socket.emit('error', errMsg);
      }
    });

    socket.on('leave:requirement', ({ requirementId }) => {
      if (!requirementId) return;
      socket.leave(`auction:${requirementId}`);
      socket.emit('left:requirement', { requirementId });
    });

    socket.on('disconnect', () => {
      // no-op for now
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket(server) first.');
  return io;
}

async function shutdownSocket() {
  // Close Socket.IO server and Redis clients gracefully
  try {
    if (io) {
      await new Promise((resolve) => io.close(() => resolve()));
      io = null;
    }
  } catch (_) {}
  try {
    if (redisSub) {
      await redisSub.quit();
      redisSub.disconnect();
      redisSub = null;
    }
  } catch (_) {}
  try {
    if (redisPub) {
      await redisPub.quit();
      redisPub.disconnect();
      redisPub = null;
    }
  } catch (_) {}
}

module.exports = { initSocket, getIO, shutdownSocket };
