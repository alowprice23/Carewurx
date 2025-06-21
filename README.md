# Carewurx - Smart Scheduling for Home Healthcare

Carewurx is an intelligent scheduling application designed to streamline and optimize home healthcare services. It aims to connect clients needing care with suitable caregivers, considering availability, skills, location, and client needs. The application leverages AI components for tasks like matching and insights.

## Prerequisites

*   **Node.js**: Recommended LTS version (e.g., v18.x, v20.x). Check `.nvmrc` if present, or ensure a recent LTS version.
*   **npm**: Usually comes with Node.js. (Or Yarn, if preferred by the project, though `package-lock.json` suggests npm).
*   **Git**: For cloning the repository.

## Project Structure

The project is organized as an Electron application with a React frontend:

*   `main.js`: Electron main process.
*   `preload.js`: Electron preload script.
*   `frontend/`: Contains the React frontend application (created with Create React App).
*   `services/`: Backend services, including Firebase integration.
*   `agents/`: AI agent core logic and models.

## Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd carewurx
    ```

2.  **Install root dependencies:**
    These are primarily for the Electron app, build tools, and backend services.
    ```bash
    npm install
    ```

3.  **Install frontend dependencies:**
    The React frontend has its own set of dependencies.
    ```bash
    cd frontend
    npm install
    cd ..
    ```
    Alternatively, the root `npm run build:frontend` script also handles frontend installation.

## Development

### Running the Application

To run the Carewurx application in development mode:

1.  Ensure all dependencies are installed (root and frontend).
2.  The root `start` script handles building the frontend and then launching Electron:
    ```bash
    npm start
    ```
    This command will:
    *   Run `npm run build:frontend` (which navigates to `frontend/`, installs dependencies if needed, and runs `npm run build` for the React app).
    *   Launch the Electron application using `electron .`.

    Changes in the Electron main process (`main.js`, `preload.js`, `services/`, `agents/`) might require restarting the Electron app. The React frontend build is a one-time build with this script; for hot-reloading of the frontend during development, you might want to run the React development server separately and point Electron to it (this setup is not explicitly defined in the current scripts).

### Running Frontend Separately (for UI development with hot-reloading)

If you want to develop the frontend UI with hot-reloading:

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Start the React development server:
    ```bash
    npm start
    ```
    This will usually open the frontend in your web browser at `http://localhost:3000`.
    *Note: When running this way, Electron-specific functionalities (IPC calls to the backend) might not work directly from the browser. The UI will be available, but backend integrations will rely on the Electron environment.*

## Building for Production

To build the Electron application for production:

1.  Ensure all dependencies are installed.
2.  Run the build script from the root directory:
    ```bash
    npm run build
    ```
    This uses `electron-builder` to package the application. The output will typically be in the `dist/` directory (as per `electron-builder` defaults, though `package.json` build config specifies `output: "dist"`). The `build:frontend` script is usually part of the production build process implicitly or should be run before `npm run build` if not automatically included by `electron-builder` packaging steps. The root `npm start` script includes a frontend build, which might be sufficient if `electron-builder` picks up the built frontend from `frontend/build`.

## Linting

The project uses ESLint for code linting, with a consolidated configuration at the root.

*   **To run linters for the entire project (backend and frontend):**
    From the root directory:
    ```bash
    npm run lint
    ```
*   **To run linters from the frontend directory (points to the root linter):**
    ```bash
    cd frontend
    npm run lint
    cd ..
    ```

## Testing

### Frontend Unit/Integration Tests (Jest)

The frontend application uses Jest for unit and integration tests.

*   **To run frontend tests once:**
    From the `frontend/` directory:
    ```bash
    npm test
    ```
    Or, from the root directory (if a root test script is configured to run frontend tests, currently the root `test` script is a placeholder):
    *Currently, no root script directly runs frontend tests. You need to `cd frontend` first.*

*   **To run frontend tests in watch mode:**
    From the `frontend/` directory:
    ```bash
    npm run test:watch
    ```

### End-to-End Tests (Playwright)

The project is set up for End-to-End (E2E) testing using Playwright.

*   **To run E2E tests:**
    From the root directory:
    ```bash
    npm run test:e2e
    ```
    This will also run E2E tests if run from the `frontend/` directory using its `test:e2e` script, though playwright configuration might differ. The root one is likely intended for full application E2E tests.

### Backend Tests

The root `package.json` shows `test: "echo \"Error: no test specified\" && exit 1"`.
If backend tests are added (e.g., for `services/` or `agents/`), this script should be updated. For example, if Jest is used for backend tests as well:
1.  Install Jest as a root dev dependency (already done during ESLint setup).
2.  Configure Jest for the backend (e.g., `jest.config.backend.js`).
3.  Update the root `test` script: `"test": "jest --config jest.config.backend.js"` (or similar).

## Seeding Data

A script is available to seed the database (presumably Firebase Firestore):
```bash
npm run seed
```
This script executes `node -e "require('./services/seed-data').seedDatabase()"`. Ensure your Firebase Admin SDK is correctly configured with appropriate environment variables for this to work.
---

This README provides a starting point. It can be further expanded with more details on:
*   Specific environment variable requirements (e.g., for Firebase, Groq).
*   Architectural overview.
*   Deployment details.
*   Contribution guidelines.