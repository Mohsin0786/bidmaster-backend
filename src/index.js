const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const mongoose = require('mongoose');
const http = require('http');
const { initSocket, shutdownSocket } = require('./socket');
let server;

mongoose
  .connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to mongodb');
  })
  .catch(err => {
    console.log(err);
  });

// create HTTP server and initialize Socket.IO
server = http.createServer(app);
initSocket(server);

server.listen(config.port, () => {
  console.log(`BiddingMaster app listening on port ${config.port}!`);
});

// ------------- Don't Modify  -------------
const exitHandler = () => {
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await shutdownSocket();
        logger.info('Socket.IO closed');
      } catch (e) {
        logger.warn(`Socket shutdown error: ${e.message}`);
      }
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = error => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
// ------------- Don't Modify  -------------
