// Setup file for Jest tests
import '@testing-library/jest-dom';
import 'jest-canvas-mock'; // For mocking canvas operations
import fetchMock from 'jest-fetch-mock';

// Polyfill AbortController if not present in JSDOM version
if (typeof AbortController === 'undefined') {
  const AbortControllerPolyfill = require('abort-controller');
  global.AbortController = AbortControllerPolyfill.AbortController;
  global.AbortSignal = AbortControllerPolyfill.AbortSignal;
}

// Enable fetch mocks globally
fetchMock.enableMocks();

// Mock for scrollIntoView
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

// Basic mock for EventSource
if (typeof global.EventSource === 'undefined') {
  global.EventSource = jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    onopen: jest.fn(),
    onmessage: jest.fn(),
    onerror: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
  global.EventSource.mock = { instances: [global.EventSource()] }; // Simplified mock structure
}


// Mock parts of the window object if still needed by some tests,
// but electronAPI itself should no longer be the primary mock target.
global.window = {
  ...global.window,
  // electronAPI: {}, // Remove this as services will use fetch
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(), // Add if services dispatch global events
};

// Reset fetch mocks before each test
beforeEach(() => {
  fetchMock.resetMocks();
});

// Set up any other global mocks here
