// Setup file for Jest tests
import '@testing-library/jest-dom';

// Mock the global window object for electronAPI
global.window = {
  ...global.window,
  electronAPI: {},
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Set up any other global mocks here
