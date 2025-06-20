const fft = require('firebase-functions-test')({
  projectId: 'carewurx-test-project',
});
const sinon = require('sinon');
const admin = require('firebase-admin');
const { expect } = require('chai');

const myFunctions = require('../index');

describe('Cloud Functions: Schedule Management', () => {
  let adminAuthStub;
  let firestoreStub, collectionStub, addStub, getStub, docStub, updateStub, deleteStub, whereStub, orderByStub;

  beforeEach(() => {
    const verifyIdToken = sinon.stub().resolves({ uid: 'testUser', email: 'test@example.com' });
    if (typeof admin.auth === 'function' && admin.auth().verifyIdToken) {
        adminAuthStub = sinon.stub(admin.auth(), 'verifyIdToken').callsFake(verifyIdToken);
    } else {
        adminAuthStub = verifyIdToken;
        sinon.stub(admin, 'auth').returns({ verifyIdToken: adminAuthStub });
    }

    addStub = sinon.stub();
    getStub = sinon.stub();
    updateStub = sinon.stub();
    deleteStub = sinon.stub();
    whereStub = sinon.stub(); // Will return 'this' (the query object) for chaining
    orderByStub = sinon.stub(); // Will return 'this' for chaining

    // Mock query object structure
    const queryMock = {
        get: getStub,
        where: whereStub,
        orderBy: orderByStub,
    };
    whereStub.returns(queryMock);
    orderByStub.returns(queryMock);

    docStub = sinon.stub().returns({ get: getStub, update: updateStub, delete: deleteStub });
    collectionStub = sinon.stub().returns({ add: addStub, get: getStub, doc: docStub, where: whereStub, orderBy: orderByStub });

    firestoreStub = sinon.stub(admin, 'firestore').get(() => () => ({ collection: collectionStub }));

    sinon.stub(admin.firestore.FieldValue, 'serverTimestamp').returns('SERVER_TIMESTAMP_PLACEHOLDER');
  });

  afterEach(() => {
    sinon.restore();
    fft.cleanup();
  });

  // --- createSchedule Tests ---
  describe('createSchedule', () => {
    const wrappedCreateSchedule = fft.wrap(myFunctions.createSchedule);
    const validScheduleData = {
        clientId: 'client1',
        date: '2024-09-15',
        startTime: '09:00',
        endTime: '11:00',
        tasks: ['task1'],
        status: 'pending'
    };

    it('should create a schedule successfully', async () => {
      addStub.resolves({ id: 'newSchedule123' });
      const req = { method: 'POST', headers: { authorization: 'Bearer validtoken' }, body: validScheduleData };
      const res = {
        status: (code) => {
          expect(code).to.equal(201);
          return { json: (data) => {
            expect(data).to.have.property('id', 'newSchedule123');
            expect(data.clientId).to.equal(validScheduleData.clientId);
          }};
        },
      };
      await wrappedCreateSchedule(req, res);
      expect(addStub.calledOnce).to.be.true;
    });

    it('should return 400 if required fields are missing', async () => {
      const req = { method: 'POST', headers: { authorization: 'Bearer validtoken' }, body: { clientId: 'client1' } }; // Missing date, times, tasks
      const res = {
        status: (code) => {
          expect(code).to.equal(400);
          return { send: (message) => {
            expect(message).to.equal('Bad Request: Missing required schedule field (date).');
          }};
        },
      };
      await wrappedCreateSchedule(req, res);
    });
  });

  // --- getSchedules Tests ---
  describe('getSchedules', () => {
    const wrappedGetSchedules = fft.wrap(myFunctions.getSchedules);
    const mockSchedulesData = [{ id: 's1', date: '2024-09-15' }, { id: 's2', date: '2024-09-16' }];

    it('should return a list of schedules', async () => {
      const snapshot = { forEach: (cb) => mockSchedulesData.forEach(s => cb({ id: s.id, data: () => s })), empty: false };
      getStub.resolves(snapshot);
      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: {} };
      const res = { status: (code) => { expect(code).to.equal(200); return { json: (data) => { expect(data).to.deep.equal(mockSchedulesData); }}; } };
      await wrappedGetSchedules(req, res);
      expect(collectionStub.calledWith('schedules')).to.be.true; // Ensure collection is called
      expect(getStub.calledOnce).to.be.true;
    });

    it('should filter schedules by date', async () => {
      getStub.resolves({ forEach: sinon.fake(), empty: true }); // Assume query returns empty for simplicity of checking args
      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: { date: '2024-09-15' } };
      const res = { status: (code) => { return { json: sinon.fake() }; } };
      await wrappedGetSchedules(req, res);
      expect(whereStub.calledWith('date', '==', '2024-09-15')).to.be.true;
    });

    it('should filter schedules by clientId and dateRange', async () => {
        getStub.resolves({ forEach: sinon.fake(), empty: true });
        const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: { clientId: 'client1', startDate: '2024-09-01', endDate: '2024-09-30' } };
        const res = { status: (code) => { return { json: sinon.fake() }; } };
        await wrappedGetSchedules(req, res);
        expect(whereStub.calledWith('clientId', '==', 'client1')).to.be.true;
        expect(whereStub.calledWith('date', '>=', '2024-09-01')).to.be.true;
        expect(whereStub.calledWith('date', '<=', '2024-09-30')).to.be.true;
    });
  });

  // --- getScheduleById Tests ---
  describe('getScheduleById', () => {
    const wrappedGetScheduleById = fft.wrap(myFunctions.getScheduleById);
    const scheduleId = 'schedule123';

    it('should return a schedule by ID', async () => {
      getStub.resolves({ exists: true, id: scheduleId, data: () => ({ clientId: 'client1' }) });
      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: { id: scheduleId } };
      const res = { status: (code) => { expect(code).to.equal(200); return { json: (data) => { expect(data.id).to.equal(scheduleId); }}; } };
      await wrappedGetScheduleById(req, res);
      expect(docStub.calledWith(scheduleId)).to.be.true;
    });

    it('should return 404 if schedule not found', async () => {
      getStub.resolves({ exists: false });
      const req = { method: 'GET', headers: { authorization: 'Bearer validtoken' }, query: { id: 'unknown' } };
      const res = { status: (code) => { expect(code).to.equal(404); return { send: sinon.fake() }; } };
      await wrappedGetScheduleById(req, res);
    });
  });

  // --- updateSchedule Tests ---
  describe('updateSchedule', () => {
    const wrappedUpdateSchedule = fft.wrap(myFunctions.updateSchedule);
    const scheduleId = 'sToUpdate';
    const updatePayload = { status: 'confirmed' };

    it('should update a schedule successfully', async () => {
      getStub.onFirstCall().resolves({ exists: true, id: scheduleId, data: () => ({ status: 'pending' }) });
      updateStub.resolves();
      getStub.onSecondCall().resolves({ exists: true, id: scheduleId, data: () => ({ ...updatePayload, updatedAt: 'SERVER_TIMESTAMP_PLACEHOLDER' }) });

      const req = { method: 'PUT', headers: { authorization: 'Bearer validtoken' }, query: { id: scheduleId }, body: updatePayload };
      const res = { status: (code) => { expect(code).to.equal(200); return { json: (data) => { expect(data.status).to.equal('confirmed'); }}; } };
      await wrappedUpdateSchedule(req, res);
      expect(updateStub.calledOnceWith(sinon.match({ status: 'confirmed' }))).to.be.true;
    });
     it('should return 400 if attempting to update immutable fields like id or createdAt', async () => {
        const req = { method: 'PUT', headers: { authorization: 'Bearer validtoken' }, query: { id: scheduleId }, body: { id: 'newIdAttempt' } };
        const res = {
            status: (code) => {
                expect(code).to.equal(400);
                return { send: (message) => { expect(message).to.equal('Bad Request: Cannot update id or createdAt fields.'); }};
            },
        };
        await wrappedUpdateSchedule(req, res);
    });
  });

  // --- deleteSchedule Tests ---
  describe('deleteSchedule', () => {
    const wrappedDeleteSchedule = fft.wrap(myFunctions.deleteSchedule);
    const scheduleId = 'sToDelete';

    it('should delete a schedule successfully', async () => {
      getStub.resolves({ exists: true });
      deleteStub.resolves();
      const req = { method: 'DELETE', headers: { authorization: 'Bearer validtoken' }, query: { id: scheduleId } };
      const res = { status: (code) => { expect(code).to.equal(200); return { send: (message) => { expect(message).to.contain('deleted successfully'); }}; } };
      await wrappedDeleteSchedule(req, res);
      expect(deleteStub.calledOnce).to.be.true;
    });
     it('should return 404 if schedule to delete is not found', async () => {
        getStub.resolves({ exists: false });
        const req = { method: 'DELETE', headers: { authorization: 'Bearer validtoken' }, query: { id: 'unknownId' } };
        const res = {
            status: (code) => {
                expect(code).to.equal(404);
                return { send: (message) => { expect(message).to.equal('Schedule not found.'); }};
            },
        };
        await wrappedDeleteSchedule(req, res);
    });
  });
});
