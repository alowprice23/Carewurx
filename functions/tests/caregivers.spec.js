const fft = require('firebase-functions-test')({
  projectId: 'carewurx-test-project', // Use a dummy project ID for testing
});
const sinon = require('sinon');
const admin = require('firebase-admin');
const { expect } = require('chai');

// Import the functions to test
const myFunctions = require('../index');

describe('Cloud Functions: Caregiver Management', () => {
  let adminAuthStub;
  let firestoreStub, collectionStub, addStub, getStub, docStub, updateStub, deleteStub;

  beforeEach(() => {
    // Default stub for successful auth
    const verifyIdToken = sinon.stub().resolves({ uid: 'testUser', email: 'test@example.com' });
    // Check if admin.auth itself needs to be stubbed or just its methods
    if (typeof admin.auth === 'function' && admin.auth().verifyIdToken) {
        adminAuthStub = sinon.stub(admin.auth(), 'verifyIdToken').callsFake(verifyIdToken);
    } else { // Fallback if admin.auth() is not a function (e.g. not initialized fully in test)
        adminAuthStub = verifyIdToken; // Assign stub directly
        sinon.stub(admin, 'auth').returns({ verifyIdToken: adminAuthStub });
    }


    // Mock Firestore
    addStub = sinon.stub();
    getStub = sinon.stub();
    updateStub = sinon.stub();
    deleteStub = sinon.stub();
    docStub = sinon.stub().returns({ get: getStub, update: updateStub, delete: deleteStub });
    collectionStub = sinon.stub().returns({ add: addStub, get: getStub, doc: docStub });

    firestoreStub = sinon.stub(admin, 'firestore').get(() => () => ({ collection: collectionStub }));

    sinon.stub(admin.firestore.FieldValue, 'serverTimestamp').returns('SERVER_TIMESTAMP_PLACEHOLDER');
  });

  afterEach(() => {
    sinon.restore();
    fft.cleanup();
  });

  // --- createCaregiver Tests ---
  describe('createCaregiver', () => {
    const wrappedCreateCaregiver = fft.wrap(myFunctions.createCaregiver);

    it('should create a caregiver successfully with valid data and auth', async () => {
      addStub.resolves({ id: 'newCaregiver123' });
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer validtoken' },
        body: { name: 'Test Caregiver', email: 'cg@example.com', skills: ['cpr'] },
      };
      const res = {
        status: (code) => {
          expect(code).to.equal(201);
          return { json: (data) => {
            expect(data).to.have.property('id', 'newCaregiver123');
            expect(data.name).to.equal(req.body.name);
            expect(data.createdAt).to.equal('SERVER_TIMESTAMP_PLACEHOLDER');
          }};
        },
      };
      await wrappedCreateCaregiver(req, res);
      expect(addStub.calledOnce).to.be.true;
    });

    it('should return 400 if required fields (name, email) are missing', async () => {
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer validtoken' },
        body: { phone: '12345' }, // Missing name and email
      };
      const res = {
        status: (code) => {
          expect(code).to.equal(400);
          return { send: (message) => {
            expect(message).to.equal('Bad Request: Missing required caregiver fields (name, email).');
          }};
        },
      };
      await wrappedCreateCaregiver(req, res);
      expect(addStub.called).to.be.false;
    });
     it('should return 405 if method is not POST', async () => {
      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' } };
      const res = {
        status: (code) => {
          expect(code).to.equal(405);
          return { send: (message) => { expect(message).to.equal('Method Not Allowed'); }};
        },
      };
      await wrappedCreateCaregiver(req, res);
    });
  });

  // --- getCaregivers Tests ---
  describe('getCaregivers', () => {
    const wrappedGetCaregivers = fft.wrap(myFunctions.getCaregivers);
    const mockCaregiversData = [
      { id: 'cg1', name: 'Caregiver Alpha', email: 'alpha_cg@example.com' },
      { id: 'cg2', name: 'Caregiver Beta', email: 'beta_cg@example.com' },
    ];

    it('should return a list of caregivers successfully', async () => {
      const snapshot = {
        forEach: (callback) => mockCaregiversData.forEach(cg => callback({ id: cg.id, data: () => cg })),
        empty: false,
      };
      getStub.resolves(snapshot);

      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' } };
      const res = {
        status: (code) => {
          expect(code).to.equal(200);
          return { json: (data) => {
            expect(data).to.deep.equal(mockCaregiversData);
          }};
        },
      };
      await wrappedGetCaregivers(req, res);
      expect(getStub.calledOnce).to.be.true;
    });
     it('should return 500 if Firestore operation fails', async () => {
        getStub.rejects(new Error('Firestore get failed for caregivers'));
        const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' } };
        const res = {
            status: (code) => {
                expect(code).to.equal(500);
                return { send: (message) => { expect(message).to.equal('Internal Server Error getting caregivers.'); }};
            },
        };
        await wrappedGetCaregivers(req, res);
    });
  });

  // --- getCaregiverById Tests ---
  describe('getCaregiverById', () => {
    const wrappedGetCaregiverById = fft.wrap(myFunctions.getCaregiverById);
    const caregiverId = 'cg123';
    const mockCaregiverData = { name: 'Specific CG', email: 'specific_cg@example.com' };

    it('should return a caregiver by ID successfully', async () => {
      getStub.resolves({ exists: true, id: caregiverId, data: () => mockCaregiverData });

      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: { id: caregiverId } };
      const res = {
        status: (code) => {
          expect(code).to.equal(200);
          return { json: (data) => {
            expect(data).to.deep.equal({ id: caregiverId, ...mockCaregiverData });
          }};
        },
      };
      await wrappedGetCaregiverById(req, res);
      expect(docStub.calledWith(caregiverId)).to.be.true;
    });

    it('should return 404 if caregiver not found', async () => {
      getStub.resolves({ exists: false });
      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: { id: 'unknownId' } };
      const res = {
        status: (code) => {
          expect(code).to.equal(404);
          return { send: (message) => { expect(message).to.equal('Caregiver not found.'); }};
        },
      };
      await wrappedGetCaregiverById(req, res);
    });
  });

  // --- updateCaregiver Tests ---
  describe('updateCaregiver', () => {
    const wrappedUpdateCaregiver = fft.wrap(myFunctions.updateCaregiver);
    const caregiverId = 'cgToUpdate';
    const updatePayload = { name: 'Updated CG Name', skills: ['new_skill'] };

    it('should update a caregiver successfully', async () => {
      getStub.onFirstCall().resolves({ exists: true, id: caregiverId, data: () => ({ name: 'Old CG Name'}) });
      updateStub.resolves();
      getStub.onSecondCall().resolves({ exists: true, id: caregiverId, data: () => ({...updatePayload, updatedAt: 'SERVER_TIMESTAMP_PLACEHOLDER' }) });

      const req = { method: 'PUT', headers: { authorization: 'Bearer validtoken' }, query: { id: caregiverId }, body: updatePayload };
      const res = {
        status: (code) => {
          expect(code).to.equal(200);
          return { json: (data) => {
            expect(data.name).to.equal(updatePayload.name);
          }};
        },
      };
      await wrappedUpdateCaregiver(req, res);
      expect(updateStub.calledOnceWith(sinon.match({name: updatePayload.name}))).to.be.true;
    });

    it('should return 404 if caregiver to update is not found', async () => {
        getStub.resolves({ exists: false });
        const req = { method: 'PUT', headers: { authorization: 'Bearer validtoken' }, query: { id: 'unknownId' }, body: updatePayload };
        const res = {
            status: (code) => {
                expect(code).to.equal(404);
                return { send: (message) => { expect(message).to.equal('Caregiver not found. Cannot update non-existent caregiver.'); }};
            },
        };
        await wrappedUpdateCaregiver(req, res);
    });
  });

  // --- deleteCaregiver Tests ---
  describe('deleteCaregiver', () => {
    const wrappedDeleteCaregiver = fft.wrap(myFunctions.deleteCaregiver);
    const caregiverId = 'cgToDelete';

    it('should delete a caregiver successfully', async () => {
      getStub.resolves({ exists: true });
      deleteStub.resolves();

      const req = { method: 'DELETE', headers: { authorization: 'Bearer validtoken' }, query: { id: caregiverId } };
      const res = {
        status: (code) => {
          expect(code).to.equal(200);
          return { send: (message) => {
            expect(message).to.equal(`Caregiver ${caregiverId} deleted successfully.`);
          }};
        },
      };
      await wrappedDeleteCaregiver(req, res);
      expect(deleteStub.calledOnce).to.be.true;
    });

    it('should return 404 if caregiver to delete is not found', async () => {
        getStub.resolves({ exists: false });
        const req = { method: 'DELETE', headers: { authorization: 'Bearer validtoken' }, query: { id: 'unknownId' } };
        const res = {
            status: (code) => {
                expect(code).to.equal(404);
                return { send: (message) => { expect(message).to.equal('Caregiver not found.'); }};
            },
        };
        await wrappedDeleteCaregiver(req, res);
    });
  });
});
