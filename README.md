# Carewurx

Carewurx is a smart scheduling application for home healthcare services, designed to streamline operations using AI-assisted insights.

## Prerequisites

*   **Node.js**: LTS version (e.g., v18.x or v20.x) is recommended.
*   **npm**: (Comes with Node.js) Used for dependency management.

## Getting Started

### 1. Clone Repository
```bash
git clone <repository_url> # Replace <repository_url> with the actual URL
cd carewurx
```

### 2. Install Dependencies
Install dependencies for both the root project and the frontend:
```bash
npm install       # Installs root dependencies
cd frontend
npm install       # Installs frontend dependencies
cd ..
```

### 3. Environment Variables
Sensitive configurations like API keys are managed through environment variables. You'll need to create `.env` files in the project root and in the `frontend` directory.

*   **Root `.env` file (for backend services):**
    Create a file named `.env` in the root of the project. Example content:
    ```env
    # Firebase Admin SDK: Choose one method
    # Option 1: Path to your service account JSON file
    # FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/your/serviceAccountKey.json
    # Option 2: Base64 encoded JSON content of your service account key (if using this, ensure it's a single line)
    # FIREBASE_SERVICE_ACCOUNT=your_base64_encoded_json_string

    # Groq API Key (for AI agent functionality)
    GROQ_API_KEY=your_groq_api_key
    ```

*   **`frontend/.env` file (for the React frontend):**
    Create a file named `.env` inside the `frontend/` directory. Example content:
    ```env
    REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
    REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
    REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
    REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
    REACT_APP_FIREBASE_APP_ID=your_firebase_app_id
    # Optional: REACT_APP_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
    ```
    **Note:** You need to replace placeholder values with your actual Firebase project configuration and Groq API key.

## Development

### Run Application
Starts the Electron app with the React frontend (hot-reloading enabled):
```bash
npm start
```
The frontend will typically be available at `http://localhost:3000`.

## Building for Production

1.  **Build Frontend Assets:**
    ```bash
    npm run build:frontend
    ```
    (This step is also part of `npm start` but can be run standalone if needed).
    Output is in `frontend/build/`.

2.  **Package Electron Application:**
    ```bash
    npm run build
    ```
    The packaged application (e.g., an executable or installer) will be in the `dist/` directory.

## Linting and Testing

### Linting

*   **Root & Backend (ESLint with `eslint.config.js`):**
    ```bash
    npm run lint
    ```
*   **Frontend (ESLint with `frontend/.eslintrc.json`):**
    ```bash
    cd frontend
    npm run lint
    cd ..
    ```

### Testing

*   **Frontend Unit/Integration Tests (Jest):**
    ```bash
    npm test
    ```
    (This runs `cd frontend && npm test` as configured in the root `package.json`)

*   **End-to-End Tests (Playwright):**
    ```bash
    npm run test:e2e
    ```

(Note: Setup for dedicated backend tests is not yet part of the root `npm test` script.)
