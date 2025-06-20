const admin = require('firebase-admin');

/**
 * Express-style middleware to verify Firebase ID tokens.
 * Expects a "Bearer <token>" in the Authorization header.
 * If valid, attaches the decoded token to `req.user`.
 * Sends 401/403 responses for missing/invalid tokens.
 */
async function verifyFirebaseToken(req, res, next) {
  console.log('Verifying Firebase token...'); // Log entry

  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    console.log('Unauthorized: No token provided or malformed header.');
    return res.status(401).send('Unauthorized: No token provided or malformed header.');
  }

  const idToken = authorizationHeader.split('Bearer ')[1];

  if (!idToken) {
    console.log('Unauthorized: Token is empty after Bearer split.');
    return res.status(401).send('Unauthorized: No token provided.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('Token verified successfully. UID:', decodedToken.uid);
    req.user = decodedToken; // Attach user information to the request object
    next(); // Proceed to the next middleware or request handler
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    if (error.code === 'auth/id-token-expired') {
        return res.status(403).send('Unauthorized: Token expired.');
    }
    if (error.code === 'auth/argument-error' || error.code === 'auth/id-token-revoked') {
        return res.status(403).send('Unauthorized: Invalid token.');
    }
    // For other errors, it might be a server-side issue with admin.auth()
    return res.status(500).send('Unauthorized: Could not verify token.');
  }
}

module.exports = { verifyFirebaseToken };
