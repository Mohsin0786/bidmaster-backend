const admin = require('firebase-admin');
const httpStatus = require('http-status');
const axios = require('axios');
const ApiError = require('../utils/ApiError');
const {firebase} = require('../config/config');
const serviceAccount = require('../../firebase-service-secret.json');
const {authService} = require('../services');
const logger  = require('../config/logger');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firebaseAuth = (allowUserType = 'All') => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Please provide a valid token'));
    }

    const token = authHeader.split(' ')[1].trim();
    const payload = await admin.auth().verifyIdToken(token, true);

    const user = await authService.getUserByFirebaseUId(payload.uid);
    logger.info(`Firebase Authenticated user: ${payload.uid}, Email: ${payload?.email}`);
    // If user not found
    if (!user) {
      const openPaths = ['/register'];
      const isOpenPath = openPaths.includes(req.path) || req.path.includes('secretSignup');

      if (isOpenPath) {
        req.newUser = payload;
        req.routeType = allowUserType;
        return next();
      } else {
        return next(new ApiError(httpStatus.NOT_FOUND, "User doesn't exist. Please create account"));
      }
    }
    logger.info(`Authorized user: ${user}`);
    // If user is blocked or deleted
    if (user.isBlocked) return next(new ApiError(httpStatus.FORBIDDEN, 'User is blocked'));
    if (user.isDeleted) return next(new ApiError(httpStatus.GONE, "User doesn't exist anymore"));

    req.user = user;
    next();
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Session is expired'));
    }
    console.error('FirebaseAuthError:', err);
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Failed to authenticate'));
  }
};


//Only for backend developer to generate token to call APIS


const generateToken = async (req, res) => {
  const { uid } = req.params;

  try {
    // Create custom token
    const token = await admin.auth().createCustomToken(uid);

    // Exchange custom token for ID token
    const { data } = await axios.post(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyCustomToken?key=${firebase.apiKey}`,
      {
        token,
        returnSecureToken: true
      }
    );

    return res.status(200).json({
      status: true,
      token: data.idToken
    });

  } catch (err) {
    console.error('Error generating token:', err);
    return res.status(500).json({
      status: false,
      msg: err.message
    });
  }
};

module.exports = generateToken;


module.exports = {firebaseAuth, generateToken};
