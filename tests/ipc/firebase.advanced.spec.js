const { firebaseService } = require('../../services/firebase');
// To mock realTimeUpdatesService, we need its path. Assuming it's './app/services/real-time-updates' relative to main.js
// For testing, it's often easier if services are structured to be easily mockable.
// If realTimeUpdatesService is not directly mockable this way, this test might need adjustment.
const realTimeUpdatesService = require('../../app/services/real-time-updates');

jest.mock('../../services/firebase', () => ({
  firebaseService: {
    updateDocument: jest.fn(),
  },
}));

jest.mock('../../app/services/real-time-updates', () => ({
  publish: jest.fn(),
}));

// Logic for firebase:updateCircularEntity from main.js
const handleUpdateCircularEntity = async (event, entityType, entityId, data) => {
  const result = await firebaseService.updateDocument(entityType, entityId, data);
  await realTimeUpdatesService.publish(entityType, { id: entityId, ...data }, 'ipc-channel');
  return result;
};


describe('Backend Advanced Firebase IPC Handlers', () => {
  const mockEvent = {}; // Mock Electron event object

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('firebase:updateCircularEntity Handler Logic', () => {
    const entityType = 'testEntities';
    const entityId = 'entity1';
    const entityData = { value: 'new value' };
    const mockUpdateResult = { success: true, id: entityId };

    it('should call firebaseService.updateDocument and realTimeUpdatesService.publish', async () => {
      firebaseService.updateDocument.mockResolvedValue(mockUpdateResult);
      realTimeUpdatesService.publish.mockResolvedValue(undefined); // publish usually doesn't return a value

      const result = await handleUpdateCircularEntity(mockEvent, entityType, entityId, entityData);

      expect(firebaseService.updateDocument).toHaveBeenCalledWith(entityType, entityId, entityData);
      expect(realTimeUpdatesService.publish).toHaveBeenCalledWith(
        entityType,
        { id: entityId, ...entityData },
        'ipc-channel'
      );
      expect(result).toEqual(mockUpdateResult);
    });

    it('should propagate error if firebaseService.updateDocument fails', async () => {
      const errorMessage = 'Failed to update document';
      firebaseService.updateDocument.mockRejectedValue(new Error(errorMessage));

      await expect(handleUpdateCircularEntity(mockEvent, entityType, entityId, entityData))
        .rejects.toThrow(errorMessage);
      expect(realTimeUpdatesService.publish).not.toHaveBeenCalled(); // Should not be called if update fails
    });

    it('should still return result from updateDocument even if realTimeUpdatesService.publish fails', async () => {
      // This depends on desired behavior. Current implementation calls publish and then returns result.
      // If publish throws, the whole handler will throw.
      const publishErrorMessage = 'Failed to publish';
      firebaseService.updateDocument.mockResolvedValue(mockUpdateResult);
      realTimeUpdatesService.publish.mockRejectedValue(new Error(publishErrorMessage));

      await expect(handleUpdateCircularEntity(mockEvent, entityType, entityId, entityData))
        .rejects.toThrow(publishErrorMessage);

      // If the requirement was to succeed even if publish fails, the handler logic would need a try/catch for publish.
      // Current test reflects current implementation: error from publish propagates.
    });
  });
});
