# Carewurx API Endpoints Guide

This document provides a reference for the available HTTP API endpoints for the Carewurx backend system. All endpoints require Firebase Authentication via a Bearer token in the `Authorization` header.

## Base URL

All endpoint paths are relative to your Firebase Functions deployment URL (e.g., `https://<region>-<project-id>.cloudfunctions.net/`).

## Authentication

All endpoints (unless otherwise specified) require a Firebase ID token to be passed in the `Authorization` header:

`Authorization: Bearer <FIREBASE_ID_TOKEN>`

Failure to provide a valid token will result in a `403 Unauthorized` error.

---

## Schedule Endpoints

These endpoints manage client schedules and caregiver assignments.

### 1. Create a new schedule

*   **Method:** `POST`
*   **Path:** `/createSchedule` (Note: Cloud Function name often becomes the path segment. Assumed deployment name.)
*   **Description:** Creates a new schedule for a client. Initially 'unassigned'.
*   **Request Body (JSON):**
    ```json
    {
      "clientId": "string (required)",
      "date": "YYYY-MM-DD (required)",
      "startTime": "HH:MM (required)",
      "endTime": "HH:MM (required)",
      "notes": "string (optional)"
    }
    ```
*   **Success Response (201 Created):**
    ```json
    {
      "id": "scheduleGeneratedId",
      "client_id": "clientId_from_request",
      "client_name": "Fetched Client Name",
      "client_location": { /* client location object */ },
      "required_skills": [ /* client skills */ ],
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "notes": "notes_from_request",
      "status": "unassigned",
      "created_by_user": "firebase_user_uid",
      "createdAt": "ISO8601 Timestamp",
      "updatedAt": "ISO8601 Timestamp"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing required fields, invalid data format, client not found.
    *   `401/403 Unauthorized`: Authentication error.
    *   `405 Method Not Allowed`: If not a POST request.
    *   `500 Internal Server Error`: Server-side issue.

### 2. Assign a caregiver to a schedule

*   **Method:** `POST`
*   **Path:** `/assignCaregiverToSchedule/:scheduleId`
*   **Description:** Assigns a specified caregiver to an existing schedule.
*   **URL Parameters:**
    *   `scheduleId` (string, required): The ID of the schedule to update.
*   **Request Body (JSON):**
    ```json
    {
      "caregiverId": "string (required)"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      // Full updated schedule object with caregiver_id, caregiver_name, status: 'assigned', etc.
      "id": "scheduleId_from_param",
      "client_id": "...",
      "caregiver_id": "caregiverId_from_request",
      "caregiver_name": "Fetched Caregiver Name",
      // ... other schedule fields
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `caregiverId` or `scheduleId`.
    *   `404 Not Found`: Schedule or Caregiver not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 3. Get a specific schedule by ID

*   **Method:** `GET`
*   **Path:** `/getScheduleById/:scheduleId`
*   **Description:** Retrieves details for a specific schedule.
*   **URL Parameters:**
    *   `scheduleId` (string, required): The ID of the schedule.
*   **Success Response (200 OK):**
    ```json
    {
      // Full schedule object
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `scheduleId`.
    *   `404 Not Found`: Schedule not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 4. Update general schedule details

*   **Method:** `PUT`
*   **Path:** `/updateScheduleById/:scheduleId`
*   **Description:** Updates mutable fields of a schedule (e.g., notes, status). Does not change client or caregiver assignment.
*   **URL Parameters:**
    *   `scheduleId` (string, required): The ID of the schedule to update.
*   **Request Body (JSON):**
    ```json
    {
      "notes": "string (optional)",
      "status": "string (optional, e.g., 'confirmed', 'cancelled')",
      "date": "YYYY-MM-DD (optional)",
      "startTime": "HH:MM (optional)",
      "endTime": "HH:MM (optional)"
      // Other mutable fields
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      // Full updated schedule object
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `scheduleId` or empty update body.
    *   `404 Not Found`: Schedule not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 5. Delete a schedule by ID

*   **Method:** `DELETE`
*   **Path:** `/deleteScheduleById/:scheduleId`
*   **Description:** Deletes a specific schedule.
*   **URL Parameters:**
    *   `scheduleId` (string, required): The ID of the schedule to delete.
*   **Success Response (200 OK):**
    ```json
    {
      "message": "Schedule scheduleId_from_param deleted successfully."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `scheduleId`.
    *   `404 Not Found`: Schedule not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 6. Get schedules (with filtering)

*   **Method:** `GET`
*   **Path:** `/getSchedules`
*   **Description:** Retrieves a list of schedules, supporting various filters.
*   **Query Parameters (optional):**
    *   `clientId` (string): Filter by client ID.
    *   `caregiverId` (string): Filter by caregiver ID.
    *   `startDate` (YYYY-MM-DD): Filter by start date of a range.
    *   `endDate` (YYYY-MM-DD): Filter by end date of a range.
    *   (Note: At least one filter or a date range is typically required by the implementation to prevent fetching all schedules).
*   **Success Response (200 OK):**
    ```json
    [
      { /* schedule object */ },
      { /* schedule object */ }
    ]
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid date format, or no/insufficient query parameters.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

---

## Client Endpoints

These endpoints manage client profiles.

### 1. Get all clients

*   **Method:** `GET`
*   **Path:** `/getClients`
*   **Description:** Retrieves a list of all clients.
*   **Success Response (200 OK):**
    ```json
    [
      { /* client object */ },
      { /* client object */ }
    ]
    ```
*   **Error Responses:**
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 2. Create a new client

*   **Method:** `POST`
*   **Path:** `/createClient`
*   **Description:** Creates a new client profile.
*   **Request Body (JSON):**
    ```json
    {
      "name": "string (required)",
      "location": { "address": "string", "latitude": "number", "longitude": "number" }, // Optional
      "contact": { "phone": "string", "email": "string" }, // Optional
      "authorized_weekly_hours": "number (optional)",
      "bus_line_access": "boolean (optional)",
      "required_skills": ["string"], // Optional
      "status": "string (optional, e.g., 'active_receiving_care')"
      // ... other client fields as per data model
    }
    ```
*   **Success Response (201 Created):**
    ```json
    {
      "id": "clientGeneratedId",
      "name": "name_from_request",
      // ... other client fields including created_by_user, createdAt, updatedAt
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `name`.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 3. Get a specific client by ID

*   **Method:** `GET`
*   **Path:** `/getClientById/:clientId`
*   **Description:** Retrieves details for a specific client.
*   **URL Parameters:**
    *   `clientId` (string, required): The ID of the client.
*   **Success Response (200 OK):**
    ```json
    {
      // Full client object
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `clientId`.
    *   `404 Not Found`: Client not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 4. Update a client's details

*   **Method:** `PUT`
*   **Path:** `/updateClientById/:clientId`
*   **Description:** Updates mutable fields of a client profile.
*   **URL Parameters:**
    *   `clientId` (string, required): The ID of the client to update.
*   **Request Body (JSON):**
    ```json
    {
      // Any mutable client fields, e.g.:
      "name": "string (optional)",
      "location": { "...": "..." }, // Optional
      "authorized_weekly_hours": "number (optional)"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      // Full updated client object
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `clientId` or empty update body.
    *   `404 Not Found`: Client not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

---

## Caregiver Endpoints

These endpoints manage caregiver profiles and their availability.

### 1. Get all caregivers

*   **Method:** `GET`
*   **Path:** `/getCaregivers`
*   **Description:** Retrieves a list of all caregivers.
*   **Success Response (200 OK):**
    ```json
    [
      { /* caregiver object */ },
      { /* caregiver object */ }
    ]
    ```
*   **Error Responses:**
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 2. Create a new caregiver

*   **Method:** `POST`
*   **Path:** `/createCaregiver`
*   **Description:** Creates a new caregiver profile. Availability is typically set via a separate call.
*   **Request Body (JSON):**
    ```json
    {
      "name": "string (required)",
      "skills": ["string"], // Optional
      "drives_car": "boolean (optional)",
      "max_days_per_week": "number (optional)",
      "max_hours_per_week": "number (optional)",
      "target_weekly_hours": "number (optional)",
      "employment_type": "string (optional, e.g., 'part-time')"
      // ... other caregiver fields
    }
    ```
*   **Success Response (201 Created):**
    ```json
    {
      "id": "caregiverGeneratedId",
      "name": "name_from_request",
      // ... other caregiver fields including created_by_user, createdAt, updatedAt
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `name`.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 3. Get a specific caregiver by ID

*   **Method:** `GET`
*   **Path:** `/getCaregiverById/:caregiverId`
*   **Description:** Retrieves details for a specific caregiver.
*   **URL Parameters:**
    *   `caregiverId` (string, required): The ID of the caregiver.
*   **Success Response (200 OK):**
    ```json
    {
      // Full caregiver object (excluding availability, which is a separate endpoint)
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `caregiverId`.
    *   `404 Not Found`: Caregiver not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 4. Update a caregiver's details

*   **Method:** `PUT`
*   **Path:** `/updateCaregiverById/:caregiverId`
*   **Description:** Updates mutable fields of a caregiver profile (excluding availability).
*   **URL Parameters:**
    *   `caregiverId` (string, required): The ID of the caregiver to update.
*   **Request Body (JSON):**
    ```json
    {
      // Any mutable caregiver fields, e.g.:
      "name": "string (optional)",
      "skills": ["string"], // Optional
      "drives_car": "boolean (optional)"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      // Full updated caregiver object
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `caregiverId` or empty update body.
    *   `404 Not Found`: Caregiver not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 5. Get a caregiver's availability

*   **Method:** `GET`
*   **Path:** `/getCaregiverAvailabilityById/:caregiverId`
*   **Description:** Retrieves the availability structure for a specific caregiver.
*   **URL Parameters:**
    *   `caregiverId` (string, required): The ID of the caregiver.
*   **Success Response (200 OK):**
    ```json
    {
      "availability": {
        "specific_slots": [ /* ... */ ],
        "general_rules": [ /* ... */ ],
        "time_off": [ /* ... */ ]
      }
    }
    // Returns { "availability": {} } if no availability is set.
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `caregiverId`.
    *   `404 Not Found`: Caregiver not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

### 6. Update a caregiver's availability

*   **Method:** `PUT`
*   **Path:** `/updateCaregiverAvailabilityById/:caregiverId`
*   **Description:** Updates the entire availability structure for a caregiver.
*   **URL Parameters:**
    *   `caregiverId` (string, required): The ID of the caregiver.
*   **Request Body (JSON):**
    ```json
    {
      "availability": { // The complete, new availability object
        "specific_slots": [ /* ... */ ],
        "general_rules": [ /* ... */ ],
        "time_off": [ /* ... */ ]
      }
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "availability": { /* The updated availability object */ }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing `caregiverId` or invalid/missing `availability` object in body.
    *   `404 Not Found`: Caregiver not found.
    *   `401/403 Unauthorized`.
    *   `405 Method Not Allowed`.
    *   `500 Internal Server Error`.

---
*Note: The exact URL paths might vary slightly based on Firebase Cloud Functions deployment conventions if a base path or specific naming strategy is used for exported functions.*
