const fft = require('firebase-functions-test')({
  projectId: 'carewurx-test-project',
});
const sinon = require('sinon');
const admin = require('firebase-admin');
const { expect } = require('chai');

const myFunctions = require('../index');

describe('Cloud Functions: Client Management', () => {
  let adminAuthStub;
  let firestoreStub, collectionStub, addStub, getStub, docStub, updateStub, deleteStub;

  beforeEach(() => {
    // Stub admin.auth().verifyIdToken() for the auth middleware
    // This will be the default success case. Individual tests can override.
    const verifyIdToken = sinon.stub().resolves({ uid: 'testUser', email: 'test@example.com' });
    adminAuthStub = sinon.stub(admin, 'auth').get(() => () => ({ verifyIdToken }));

    // Mock Firestore
    addStub = sinon.stub();
    getStub = sinon.stub();
    updateStub = sinon.stub();
    deleteStub = sinon.stub();
    docStub = sinon.stub().returns({ get: getStub, update: updateStub, delete: deleteStub });
    collectionStub = sinon.stub().returns({ add: addStub, get: getStub, doc: docStub });

    // Ensure admin.firestore() returns our stubbed collection behavior
    firestoreStub = sinon.stub(admin, 'firestore').get(() => () => ({ collection: collectionStub }));

    sinon.stub(admin.firestore.FieldValue, 'serverTimestamp').returns('SERVER_TIMESTAMP_PLACEHOLDER');
  });

  afterEach(() => {
    sinon.restore();
    fft.cleanup(); // Important for firebase-functions-test
  });

  describe('createClient', () => {
    const wrappedCreateClient = fft.wrap(myFunctions.createClient);

    it('should create a client successfully with valid data and auth', async () => {
      addStub.resolves({ id: 'newClient123' });
      const req = {
        method: 'POST',
        headers: { authorization: 'Bearer validtoken' },
        body: { name: 'Test Client', email: 'test@example.com', careNeeds: ['testing'] },
      };

      const res = {
        status: (code) => {
          expect(code).to.equal(201);
          return { json: (data) => {
            expect(data).to.have.property('id', 'newClient123');
            expect(data.name).to.equal(req.body.name);
            expect(data.createdAt).to.equal('SERVER_TIMESTAMP_PLACEHOLDER');
          }};
        },
      };
      await wrappedCreateClient(req, res);
      expect(addStub.calledOnce).to.be.true;
    });

    // ... other createClient tests from previous step can remain ...
    it('should return 400 if required fields (name) are missing', async () => {
        const req = {
            method: 'POST',
            headers: { authorization: 'Bearer validtoken' },
            body: { email: 'onlyemail@example.com' },
        };
        const res = {
            status: (code) => {
                expect(code).to.equal(400);
                return { send: (message) => {
                    expect(message).to.equal('Bad Request: Missing required client field (name).');
                }};
            },
        };
        await wrappedCreateClient(req, res);
        expect(addStub.called).to.be.false;
    });
  });

  describe('getClients', () => {
    const wrappedGetClients = fft.wrap(myFunctions.getClients);
    const mockClientsData = [
      { id: 'client1', name: 'Client Alpha', email: 'alpha@example.com' },
      { id: 'client2', name: 'Client Beta', email: 'beta@example.com' },
    ];

    it('should return a list of clients successfully', async () => {
      const snapshot = {
        forEach: (callback) => mockClientsData.forEach(client => callback({ id: client.id, data: () => client })),
        empty: false, // Assuming not empty
      };
      getStub.resolves(snapshot); // collection('clients').get()

      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' } };
      const res = {
        status: (code) => {
          expect(code).to.equal(200);
          return { json: (data) => {
            expect(data).to.deep.equal(mockClientsData);
          }};
        },
      };
      await wrappedGetClients(req, res);
      expect(getStub.calledOnce).to.be.true;
    });

    it('should return 405 if method is not GET', async () => {
      const req = { method: 'POST', headers: { authorization: 'Bearer validtoken' } };
      const res = {
        status: (code) => {
          expect(code).to.equal(405);
          return { send: (message) => { expect(message).to.equal('Method Not Allowed'); }};
        },
      };
      await wrappedGetClients(req, res);
    });

    it('should return 500 if Firestore operation fails', async () => {
        getStub.rejects(new Error('Firestore get failed'));
        const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' } };
        const res = {
            status: (code) => {
                expect(code).to.equal(500);
                return { send: (message) => { expect(message).to.equal('Internal Server Error getting clients.'); }};
            },
        };
        await wrappedGetClients(req, res);
    });
  });

  describe('getClientById', () => {
    const wrappedGetClientById = fft.wrap(myFunctions.getClientById);
    const clientId = 'client123';
    const mockClientData = { name: 'Specific Client', email: 'specific@example.com' };

    it('should return a client by ID successfully', async () => {
      getStub.resolves({ exists: true, id: clientId, data: () => mockClientData }); // doc(clientId).get()

      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: { id: clientId } };
      const res = {
        status: (code) => {
          expect(code).to.equal(200);
          return { json: (data) => {
            expect(data).to.deep.equal({ id: clientId, ...mockClientData });
          }};
        },
      };
      await wrappedGetClientById(req, res);
      expect(docStub.calledWith(clientId)).to.be.true;
      expect(getStub.calledOnce).to.be.true;
    });

    it('should return 404 if client not found', async () => {
      getStub.resolves({ exists: false });
      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: { id: 'unknownId' } };
      const res = {
        status: (code) => {
          expect(code).to.equal(404);
          return { send: (message) => { expect(message).to.equal('Client not found.'); }};
        },
      };
      await wrappedGetClientById(req, res);
    });

    it('should return 400 if client ID is missing in query', async () => {
        const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: {} }; // No id
        const res = {
            status: (code) => {
                expect(code).to.equal(400);
                return { send: (message) => { expect(message).to.equal('Bad Request: Missing client ID in query parameter (id).'); }};
            },
        };
        await wrappedGetClientById(req, res);
    });
  });

  describe('updateClient', () => {
    const wrappedUpdateClient = fft.wrap(myFunctions.updateClient);
    const clientId = 'clientToUpdate';
    const updatePayload = { name: 'Updated Name', careNeeds: ['new need'] };

    it('should update a client successfully', async () => {
      getStub.onFirstCall().resolves({ exists: true, id: clientId, data: () => ({ name: 'Old Name'}) }); // For existence check
      updateStub.resolves(); // doc(clientId).update()
      getStub.onSecondCall().resolves({ exists: true, id: clientId, data: () => ({...updatePayload, updatedAt: 'SERVER_TIMESTAMP_PLACEHOLDER' }) }); // For returning updated

      const req = { method: 'PUT', headers: { authorization: 'Bearer validtoken' }, query: { id: clientId }, body: updatePayload };
      const res = {
        status: (code) => {
          expect(code).to.equal(200);
          return { json: (data) => {
            expect(data.name).to.equal(updatePayload.name);
            expect(data.updatedAt).to.equal('SERVER_TIMESTAMP_PLACEHOLDER');
          }};
        },
      };
      await wrappedUpdateClient(req, res);
      expect(docStub.calledWith(clientId)).to.be.true;
      expect(updateStub.calledOnceWith(sinon.match({name: updatePayload.name, updatedAt: 'SERVER_TIMESTAMP_PLACEHOLDER'}))).to.be.true;
    });

    it('should return 404 if client to update is not found', async () => {
        getStub.resolves({ exists: false }); // For existence check
        const req = { method: 'PUT', headers: { authorization: 'Bearer validtoken' }, query: { id: 'unknownId' }, body: updatePayload };
        const res = {
            status: (code) => {
                expect(code).to.equal(404);
                return { send: (message) => { expect(message).to.equal('Client not found. Cannot update non-existent client.'); }};
            },
        };
        await wrappedUpdateClient(req, res);
    });

    it('should return 400 if update payload is empty', async () => {
        const req = { method: 'PUT', headers: { authorization: 'Bearer validtoken' }, query: { id: clientId }, body: {} };
        const res = {
            status: (code) => {
                expect(code).to.equal(400);
                return { send: (message) => { expect(message).to.equal('Bad Request: Missing update data in request body.'); }};
            },
        };
        await wrappedUpdateClient(req, res);
    });

    it('should return 400 if attempting to update immutable fields like id or createdAt', async () => {
        const req = { method: 'PUT', headers: { authorization: 'Bearer validtoken' }, query: { id: clientId }, body: { id: 'newIdAttempt' } };
        const res = {
            status: (code) => {
                expect(code).to.equal(400);
                return { send: (message) => { expect(message).to.equal('Bad Request: Cannot update id or createdAt fields.'); }};
            },
        };
        await wrappedUpdateClient(req, res);
    });
  });

  describe('deleteClient', () => {
    const wrappedDeleteClient = fft.wrap(myFunctions.deleteClient);
    const clientId = 'clientToDelete';

    it('should delete a client successfully', async () => {
      getStub.resolves({ exists: true }); // For existence check
      deleteStub.resolves(); // doc(clientId).delete()

      const req = { method: 'DELETE', headers: { authorization: 'Bearer validtoken' }, query: { id: clientId } };
      const res = {
        status: (code) => {
          expect(code).to.equal(200);
          return { send: (message) => {
            expect(message).to.equal(`Client ${clientId} deleted successfully.`);
          }};
        },
      };
      await wrappedDeleteClient(req, res);
      expect(docStub.calledWith(clientId)).to.be.true;
      expect(deleteStub.calledOnce).to.be.true;
    });

    it('should return 404 if client to delete is not found', async () => {
        getStub.resolves({ exists: false }); // For existence check
        const req = { method: 'DELETE', headers: { authorization: 'Bearer validtoken' }, query: { id: 'unknownId' } };
        const res = {
            status: (code) => {
                expect(code).to.equal(404);
                return { send: (message) => { expect(message).to.equal('Client not found.'); }};
            },
        };
        await wrappedDeleteClient(req, res);
    });
  });
});
