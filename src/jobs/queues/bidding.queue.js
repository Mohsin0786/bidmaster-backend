const Queue = require('bull');
const config = require('../../config/config');
const logger = require('../../config/logger');

// Build Redis connection options from existing config
function getRedisOptions() {
  if (config.redis && config.redis.url) {
    return config.redis.url;
  }

  // Fallback to host/port
  const options = {
    host: config.redis?.host || '127.0.0.1',
    port: config.redis?.port || 6379,
  };

  if (config.redis?.username) options.username = config.redis.username;
  if (config.redis?.password) options.password = config.redis.password;
  if (config.redis?.tls) options.tls = {};

  return options;
}

// Create Bull queue for bidding operations
const biddingQueue = new Queue('bidding', {
  redis: getRedisOptions(),
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times if job fails
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 seconds delay
    },
    removeOnComplete: true, // Clean up completed jobs
    removeOnFail: false, // Keep failed jobs for debugging
  },
});

// Event listeners for monitoring
biddingQueue.on('error', (error) => {
  logger.error('Bull queue error:', error);
});

biddingQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
});

biddingQueue.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

module.exports = { biddingQueue };
