const sinon = require('sinon');
const admin = require('firebase-admin');
const { verifyFirebaseToken } = require('../authMiddleware'); // Adjust path as needed

// Initialize firebase-admin if not already done (e.g. by functions/index.js)
// For standalone middleware testing, it might be necessary.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

describe('Auth Middleware - verifyFirebaseToken', () => {
  let req, res, next;
  let verifyIdTokenStub;

  beforeEach(() => {
    // Reset request, response, and next objects for each test
    req = {
      headers: {},
    };
    res = {
      status: sinon.stub().returnsThis(), // Allows chaining like res.status(401).send()
      send: sinon.stub(),
    };
    next = sinon.spy(); // Use a spy to check if next() is called

    // Stub admin.auth().verifyIdToken()
    // Ensure admin.auth() itself is available. If admin is not initialized, this could fail.
    // The initializeApp above should handle it.
    if (admin.auth && typeof admin.auth === 'function' && typeof admin.auth().verifyIdToken === 'function') {
        verifyIdTokenStub = sinon.stub(admin.auth(), 'verifyIdToken');
    } else {
        // Fallback if admin.auth() or verifyIdToken is not available (e.g. init failed or type issue)
        // This helps identify issues with Firebase Admin SDK initialization in tests.
        const mockAuth = { verifyIdToken: sinon.stub() };
        sinon.stub(admin, 'auth').returns(mockAuth);
        verifyIdTokenStub = mockAuth.verifyIdToken;
    }
  });

  afterEach(() => {
    // Restore stubs/spies
    sinon.restore();
  });

  it('should call next() and attach user if token is valid', async () => {
    const mockDecodedToken = { uid: 'testUser123', email: 'test@example.com' };
    req.headers.authorization = 'Bearer validtoken123';
    verifyIdTokenStub.withArgs('validtoken123').resolves(mockDecodedToken);

    await verifyFirebaseToken(req, res, next);

    expect(next.calledOnce).to.be.true;
    expect(req.user).to.deep.equal(mockDecodedToken);
    expect(res.status.called).to.be.false;
  });

  it('should send 401 if no Authorization header is provided', async () => {
    await verifyFirebaseToken(req, res, next);

    expect(next.called).to.be.false;
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledWith('Unauthorized: No token provided or malformed header.')).to.be.true;
  });

  it('should send 401 if Authorization header does not start with "Bearer "', async () => {
    req.headers.authorization = 'InvalidScheme token123';
    await verifyFirebaseToken(req, res, next);

    expect(next.called).to.be.false;
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledWith('Unauthorized: No token provided or malformed header.')).to.be.true;
  });

  it('should send 401 if token is empty after "Bearer "', async () => {
    req.headers.authorization = 'Bearer '; // Note the space, makes split[1] empty
    await verifyFirebaseToken(req, res, next);

    expect(next.called).to.be.false;
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledWith('Unauthorized: No token provided.')).to.be.true;
  });


  it('should send 403 if token is invalid (verifyIdToken throws auth/invalid-token style error)', async () => {
    req.headers.authorization = 'Bearer invalidtoken123';
    const  invalidTokenError = new Error('Token is invalid.');
    invalidTokenError.code = 'auth/argument-error'; // Example error code for invalid token
    verifyIdTokenStub.withArgs('invalidtoken123').rejects(invalidTokenError);

    await verifyFirebaseToken(req, res, next);

    expect(next.called).to.be.false;
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.send.calledWith('Unauthorized: Invalid token.')).to.be.true;
  });

  it('should send 403 if token is expired', async () => {
    req.headers.authorization = 'Bearer expiredtoken';
    const expiredTokenError = new Error('Token expired.');
    expiredTokenError.code = 'auth/id-token-expired';
    verifyIdTokenStub.withArgs('expiredtoken').rejects(expiredTokenError);

    await verifyFirebaseToken(req, res, next);

    expect(next.called).to.be.false;
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.send.calledWith('Unauthorized: Token expired.')).to.be.true;
  });

  it('should send 500 if verifyIdToken throws an unexpected error', async () => {
    req.headers.authorization = 'Bearer validtoken123';
    verifyIdTokenStub.withArgs('validtoken123').rejects(new Error('Unexpected Firebase error.'));

    await verifyFirebaseToken(req, res, next);

    expect(next.called).to.be.false;
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledWith('Unauthorized: Could not verify token.')).to.be.true;
  });
});
