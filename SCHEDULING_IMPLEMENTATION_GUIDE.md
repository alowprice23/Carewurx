# CareWurx Scheduling System Implementation Guide

This guide provides instructions for implementing the enhanced scheduling system with caregiver availability management and client schedule staffing. The implementation integrates directly with the live Firebase database while adding critical features to address scheduling gaps.

## Components Overview

We've created several new components to enhance the scheduling system:

1. **Firebase Extensions (Backend)**
   - Direct integration with the live Firebase database
   - Extends the core Firebase service with availability management
   - Provides matching algorithms based on availability, skills, and transportation

2. **Client Schedule Staffing Component**
   - Main component for staffing existing client schedules with caregivers
   - Shows all client schedules that need caregivers assigned
   - Matches available caregivers based on skills, availability, and other criteria

3. **Availability Manager Component**
   - UI component for managing caregiver regular schedules and time off
   - Provides weekly availability patterns and time-off request handling

4. **Schedule With Availability Component**
   - Enhanced scheduling interface with availability checking
   - Shows only available caregivers and provides conflict warnings
   - Shows next available slots for caregivers

5. **Availability Service**
   - Frontend service for managing availability data
   - Connects UI components with backend Firebase extensions

## Implementation Steps

### Step 1: Backend Setup

First, integrate the Firebase extensions to enhance the backend data models with direct access to the live Firebase database:

1. Add the Firebase extensions module to your services directory:
   ```
   services/firebase-extensions.js
   ```

2. This module directly connects to your Firebase database:
   ```javascript
   const { firebaseService } = require('./firebase');
   const { Timestamp, FieldValue } = require('firebase-admin/firestore');

   class FirebaseExtensionsService {
     constructor(baseService) {
       this.firebase = baseService;
       this.db = baseService.db; // Direct access to Firestore database for real-time operations
     }
     
     // Methods...
   }
   ```

3. Use it in your application:
   ```javascript
   import { firebaseExtensions } from './services/firebase-extensions';
   
   // Then use it to directly access the database
   const result = await firebaseExtensions.extendCaregiverProfile(caregiverId, enhancedData);
   ```

### Step 2: Frontend Service Integration

Add the availability service to your frontend services:

1. Add the availability service file:
   ```
   frontend/src/services/availabilityService.js
   ```

2. Update your services index to include the new service:
   ```javascript
   // In frontend/src/services/index.js
   import availabilityService from './availabilityService';
   
   export {
     // other services...
     availabilityService
   };
   ```

### Step 3: Component Integration

Add the new UI components to your application:

1. Add the ClientScheduleStaffing component for staffing client schedules:
   ```
   frontend/src/components/ClientScheduleStaffing.jsx
   ```

2. Add the AvailabilityManager component for caregiver availability:
   ```
   frontend/src/components/AvailabilityManager.jsx
   ```

3. Add the ScheduleWithAvailability component for conflict-aware scheduling:
   ```
   frontend/src/components/ScheduleWithAvailability.jsx
   ```

4. Update your components index:
   ```javascript
   // In frontend/src/components/index.js
   import ClientScheduleStaffing from './ClientScheduleStaffing';
   import AvailabilityManager from './AvailabilityManager';
   import ScheduleWithAvailability from './ScheduleWithAvailability';
   
   export {
     // ... existing components
     ClientScheduleStaffing,
     AvailabilityManager,
     ScheduleWithAvailability
   };
   ```

### Step 4: Component Usage

The main way to use these components is to integrate them into your existing pages:

#### 1. Client Schedule Staffing Component

Use this component to staff existing client schedules with available caregivers:

```jsx
import React from 'react';
import { ClientScheduleStaffing } from '../components';

const YourStaffingPage = () => {
  return (
    <div>
      <h1>Staff Client Schedules</h1>
      
      {/* Component for staffing client schedules with caregivers */}
      <ClientScheduleStaffing />
    </div>
  );
};

export default YourStaffingPage;
```

#### 2. Availability Manager and Schedule Components

```jsx
import React from 'react';
import { ScheduleWithAvailability, AvailabilityManager } from '../components';
import { schedulerService, availabilityService } from '../services';

const YourSchedulingPage = () => {
  // Handler for saving a schedule
  const handleSaveSchedule = async (scheduleData) => {
    // Create or update the schedule using your service
    const result = await schedulerService.createSchedule(scheduleData);
    return result;
  };
  
  // Handler for saving availability settings
  const handleSaveAvailability = async (caregiverId, availabilityData) => {
    // Update caregiver availability using the service
    await availabilityService.updateCaregiverAvailability(caregiverId, availabilityData);
    return true;
  };
  
  return (
    <div>
      <h1>Schedule Management</h1>
      
      {/* For creating/editing schedules with availability checking */}
      <ScheduleWithAvailability 
        initialScheduleData={{}} // Optional initial data
        onSave={handleSaveSchedule}
        onCancel={() => console.log('Cancelled')}
      />
      
      {/* For managing caregiver availability */}
      <AvailabilityManager 
        caregiverId="some-caregiver-id"
        onSave={handleSaveAvailability}
      />
    </div>
  );
};

export default YourSchedulingPage;
```

#### 2. Using the Demo Page as a Starting Point

We've created a demo page that shows how to use these components together. You can copy or adapt this page:

```
frontend/src/pages/SchedulingDemo.jsx
```

This demo page provides a complete example of how to integrate the components, handle saving data, and manage state.

### Step 5: Data Model Extensions

For the scheduling system to work properly, you need to extend your caregiver and client data models.

#### Caregiver Profile Extensions

Add these fields to your caregiver profiles:

```javascript
// Example data to extend caregiver profiles
const caregiverExtensions = {
  // Transportation capabilities
  transportation: {
    hasCar: true,
    hasLicense: true,
    usesPublicTransport: false,
    travelRadius: 25 // miles/km
  },
  
  // Skills and certifications
  skills: ['mobility', 'medication', 'bathing'],
  certifications: [
    {
      type: 'CPR',
      issuedDate: '2023-01-15',
      expiryDate: '2025-01-15',
      verificationStatus: 'Verified'
    }
  ],
  
  // Assignment status
  assignmentStatus: 'Available', // 'Available', 'Fully Booked', 'Seeking Assignments'
  
  // Preferred working hours
  preferredWorkingHours: {
    minHoursPerWeek: 20,
    maxHoursPerWeek: 40,
    preferredShiftLength: 4
  }
};

// Use the extensions service to update a caregiver profile
await firebaseExtensions.extendCaregiverProfile(caregiverId, caregiverExtensions);
```

#### Caregiver Availability

Set up availability for caregivers:

```javascript
// Example availability data
const availabilityData = {
  // Regular weekly schedule
  regularSchedule: [
    {
      dayOfWeek: 1, // Monday (0 = Sunday, 6 = Saturday)
      startTime: '09:00',
      endTime: '17:00',
      recurrenceType: 'Weekly'
    },
    {
      dayOfWeek: 3, // Wednesday
      startTime: '09:00',
      endTime: '17:00',
      recurrenceType: 'Weekly'
    }
  ],
  
  // Time off requests
  timeOff: [
    {
      startDate: '2023-07-10',
      endDate: '2023-07-14',
      reason: 'Vacation',
      status: 'Approved'
    }
  ]
};

// Use the availability service to update a caregiver's availability
await availabilityService.updateCaregiverAvailability(caregiverId, availabilityData);
```

#### Client Profile Extensions

Add these fields to your client profiles:

```javascript
// Example data to extend client profiles
const clientExtensions = {
  // Care needs
  careNeeds: [
    {
      type: 'mobility',
      description: 'Assistance with mobility and transfers',
      priority: 5, // 1-5 scale
      requiresCertification: false
    },
    {
      type: 'medication',
      description: 'Medication management and reminders',
      priority: 4,
      requiresCertification: true
    }
  ],
  
  // Transportation requirements
  transportation: {
    onBusLine: true,
    requiresDriverCaregiver: false,
    mobilityEquipment: ['walker'],
    notes: 'Prefers to use own vehicle when possible'
  },
  
  // Service status
  serviceStatus: 'Active', // 'Active', 'Waiting for Caregiver', 'On Hold'
  
  // Preferred caregivers
  preferredCaregivers: ['caregiver-id-1', 'caregiver-id-2'],
  
  // Service hours preferences
  serviceHours: {
    hoursPerWeek: 20,
    preferredDays: [1, 3, 5], // Monday, Wednesday, Friday
    preferredTimeRanges: [
      { startTime: '09:00', endTime: '12:00' }
    ]
  }
};

// Use the extensions service to update a client profile
await firebaseExtensions.extendClientProfile(clientId, clientExtensions);
```

### Step 6: Testing the Integration

To test your integration:

1. Create or update caregiver profiles with the extended data fields
2. Set up availability for those caregivers
3. Try creating a schedule using the ScheduleWithAvailability component
4. Verify that only available caregivers are shown
5. Test the conflict detection by trying to schedule outside availability
6. Test the "Show next available slots" feature

## Matching Features

The system includes several advanced matching features:

### 1. Available Caregiver Filtering

The `getAvailableCaregivers` function finds caregivers available for a specific time slot:

```javascript
// Get caregivers available for a specific time
const availableCaregivers = await availabilityService.getAvailableCaregivers(
  '2023-07-15',  // date
  '09:00',       // start time
  '12:00',       // end time
  {
    skills: ['mobility', 'medication'], // required skills
    requiresCar: true,                  // caregiver must have a car
    nearbyOnly: true,                   // only nearby caregivers
    clientLocation: '123 Main St'       // client's location
  }
);
```

### 2. Schedule Conflict Checking

The `checkScheduleConflict` function verifies if a schedule conflicts with availability:

```javascript
// Check if a schedule conflicts with caregiver availability
const hasConflict = await availabilityService.checkScheduleConflict(
  'caregiver-id',
  '2023-07-15',  // date
  '09:00',       // start time
  '12:00'        // end time
);

if (hasConflict) {
  console.log('This schedule conflicts with caregiver availability');
}
```

### 3. Next Available Slots

The `getNextAvailableSlots` function finds the next available time slots for a caregiver:

```javascript
// Get next available slots for a caregiver
const availableSlots = await availabilityService.getNextAvailableSlots(
  'caregiver-id',
  7,   // days to look ahead
  2    // minimum duration in hours
);

console.log('Next available slots:', availableSlots);
// [
//   { date: '2023-07-15', startTime: '09:00', endTime: '12:00', duration: 3 },
//   { date: '2023-07-17', startTime: '13:00', endTime: '17:00', duration: 4 }
// ]
```

### 4. Caregiver Matching

For more advanced matching, the `findMatchingCaregivers` function scores caregivers based on multiple criteria:

```javascript
// Find matching caregivers for a client
const matches = await firebaseExtensions.findMatchingCaregivers(
  'client-id',
  { minScore: 50 }  // minimum match score (0-100)
);

console.log('Matching caregivers:', matches);
// [
//   { 
//     caregiver: {...},
//     score: 85,
//     skillsScore: 45,
//     transportScore: 20,
//     proximityScore: 10,
//     availabilityScore: 5,
//     preferencesScore: 5
//   },
//   ...
// ]
```

## Conclusion

This implementation guide provides the steps needed to integrate the enhanced scheduling system. By following these steps, you can address the scheduling gaps identified in the system while leveraging existing functionality.

For further assistance or questions, please refer to the component documentation or contact the development team.
