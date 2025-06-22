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

// Mock for scrollIntoView
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
}

// Mock for AbortController if not present in JSDOM
if (typeof AbortController === 'undefined') {
  global.AbortController = class AbortController {
    constructor() {
      this.signal = {
        aborted: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        reason: undefined,
        throwIfAborted: jest.fn()
      };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}

// Mock for HTMLCanvasElement.getContext (basic mock)
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextType) {
    if (contextType === '2d') {
      return {
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn((x, y, sw, sh) => ({ data: new Uint8ClampedArray(sw * sh * 4) })),
        putImageData: jest.fn(),
        createImageData: jest.fn(() => ({ data: [] })),
        setTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        fillText: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        strokeRect: jest.fn(),
        canvas: this,
        measureText: jest.fn(() => ({ width: 0 })),
        isPointInPath: jest.fn(() => false),
        getLineDash: jest.fn(() => []),
        setLineDash: jest.fn(),
        // Add any other 2D context methods that your tests might use
      };
    }
    return null; // Or throw an error for unsupported contexts
  };
}

// Mock for EventSource (used in LiveUpdateStream.test.js)
global.EventSource = jest.fn().mockImplementation(function MockEventSource(url) {
  this.url = url;
  this.onopen = jest.fn();
  this.onmessage = jest.fn();
  this.onerror = jest.fn();
  this.close = jest.fn();
  // Store instances to allow tests to access them
  if (!MockEventSource.mock.instances) {
    MockEventSource.mock.instances = [];
  }
  MockEventSource.mock.instances.push(this);
});
Object.defineProperty(global.EventSource, 'CONNECTING', { value: 0 });
Object.defineProperty(global.EventSource, 'OPEN', { value: 1 });
Object.defineProperty(global.EventSource, 'CLOSED', { value: 2 });


// Mock for WebSocket (used in CollaborationTools.test.js)
global.WebSocket = jest.fn().mockImplementation(function MockWebSocket(url) {
  this.url = url;
  this.onopen = jest.fn();
  this.onmessage = jest.fn();
  this.onerror = jest.fn();
  this.onclose = jest.fn();
  this.send = jest.fn();
  this.close = jest.fn();
  if (!MockWebSocket.mock.instances) {
    MockWebSocket.mock.instances = [];
  }
  MockWebSocket.mock.instances.push(this);
});
Object.defineProperty(global.WebSocket, 'CONNECTING', { value: 0 });
Object.defineProperty(global.WebSocket, 'OPEN', { value: 1 });
Object.defineProperty(global.WebSocket, 'CLOSING', { value: 2 });
Object.defineProperty(global.WebSocket, 'CLOSED', { value: 3 });
