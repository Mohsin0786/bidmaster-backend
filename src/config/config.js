const Joi = require('joi');
const path = require('path');
const dotnev = require('dotenv');

dotnev.config({path: path.join(__dirname, '../../.env')});

// schema of env files for validation
const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid('test', 'development', 'production')
      .required(),
    PORT: Joi.number().default(8082),
    MONGODB_URL: Joi.string().required(),
    TWILIO_PHONE: Joi.string(),
    TWILIO_SID: Joi.string(),
    TWILIO_AUTH_TOKEN: Joi.string(),
    AWS_S3_SECRET_ACCESS_KEY: Joi.string(),
    AWS_S3_REGION: Joi.string(),
    AWS_S3_ACCESS_KEY_ID: Joi.string(),
    AWS_S3_BUCKET: Joi.string(),
    //Firebase
    FIREBASE_API_KEY: Joi.string().required(),
    FIREBASE_AUTH_DOMAIN: Joi.string().required(),
    FIREBASE_PROJECT_ID: Joi.string().required(),
    FIREBASE_STORAGE_BUCKET: Joi.string().required(),
    FIREBASE_MESSAGING_SENDER_ID: Joi.string().required(),
    FIREBASE_APP_ID: Joi.string().required(),
    // Redis (optional): local or AWS Elasticache
    REDIS_URL: Joi.string().uri().optional(),
    REDIS_HOST: Joi.string().optional(),
    REDIS_PORT: Joi.number().optional(),
    REDIS_USERNAME: Joi.string().optional(),
    REDIS_PASSWORD: Joi.string().optional(),
    REDIS_TLS: Joi.boolean().optional(),
    // Socket.IO (optional)
    SOCKET_CORS_ORIGINS: Joi.string().optional(), // comma-separated
    SOCKET_PATH: Joi.string().optional(),
    SOCKET_PING_TIMEOUT_MS: Joi.number().optional(),
    SOCKET_PING_INTERVAL_MS: Joi.number().optional(),
    // SendGrid (optional)
    SENDGRID_API_KEY: Joi.string().optional(),
    SENDGRID_FROM_EMAIL: Joi.string().email().optional(),
    SENDGRID_FROM_NAME: Joi.string().optional()

  })
  .unknown();

// validating the process.env object that contains all the env variables
const {value: envVars, error} = envVarsSchema.prefs({errors: {label: 'key'}}).validate(process.env);

// throw error if the validation fails or results into false
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  // Twilio config removed since Twilio is not being used
  // SendGrid (optional)
  sendgrid: envVars.SENDGRID_API_KEY
    ? {
        apiKey: envVars.SENDGRID_API_KEY,
        fromEmail: envVars.SENDGRID_FROM_EMAIL || undefined,
        fromName: envVars.SENDGRID_FROM_NAME || undefined,
      }
    : null,
  aws: {
    s3: {
      name: envVars.AWS_S3_BUCKET,
      region: envVars.AWS_S3_REGION,
      accessKeyId: envVars.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: envVars.AWS_S3_SECRET_ACCESS_KEY,
    },
  },
  mongoose: {
    // exception added for TDD purpose
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  // Firebase config
  firebase: {
    apiKey: envVars.FIREBASE_API_KEY,
    authDomain: envVars.FIREBASE_AUTH_DOMAIN,
    projectId: envVars.FIREBASE_PROJECT_ID,
    storageBucket: envVars.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: envVars.FIREBASE_MESSAGING_SENDER_ID,
    appId: envVars.FIREBASE_APP_ID
  },
  // Redis configuration (optional)
  redis: {
    url: envVars.REDIS_URL || null,
    host: envVars.REDIS_HOST || null,
    port: envVars.REDIS_PORT || null,
    username: envVars.REDIS_USERNAME || null,
    password: envVars.REDIS_PASSWORD || null,
    tls: envVars.REDIS_TLS || false,
  },
  socket: {
    corsOrigins: envVars.SOCKET_CORS_ORIGINS
      ? envVars.SOCKET_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : ['*'],
    path: envVars.SOCKET_PATH || '/socket.io',
    pingTimeout: envVars.SOCKET_PING_TIMEOUT_MS || 20000,
    pingInterval: envVars.SOCKET_PING_INTERVAL_MS || 25000,
  }
};
