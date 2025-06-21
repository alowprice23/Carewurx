# Carewurx Scheduling System Guide

This guide explains how the scheduling system works and how to use it effectively after the recent fixes.

## Overview

The Carewurx scheduling system consists of several integrated components:

1. **Client Profile Form** - Create and edit clients with recurring and one-time schedules
2. **Client Schedule Staffing** - View schedules that need caregivers assigned and match with available caregivers
3. **Availability Manager** - Set and manage caregiver availability patterns
4. **Schedule With Availability** - Create new appointments with conflict detection

## Fixed Issues

The following issues have been resolved:

1. **Client Schedule Disappearance**: Previously, schedules created in the Client Profile Form weren't appearing in the Staff Client Schedules component. This has been fixed by ensuring all schedules are properly saved to the database with the correct fields.

2. **Recurring vs. Single Date Schedules**: The system now properly handles both recurring schedules (e.g., "Every Monday") and single-date schedules (e.g., "June 21st only"). Both types are visible in the Client Schedule Staffing component.

3. **Schedule Refresh**: Added a "Refresh Schedules" button to the Client Schedule Staffing component to ensure you can see newly created schedules without reloading the page.

4. **Schedule Status Tracking**: Schedules now properly maintain their status (Needs Assignment, Assigned, etc.) throughout the system.

## How to Use the System

### Creating Client Schedules

1. Navigate to the Client Profile Form
2. Fill in the basic client information
3. Switch to the "Schedule Requirements" tab
4. You can add two types of schedules:
   - **Recurring Schedules**: Regular patterns like "Every Monday, 9am-12pm"
   - **Single Date Schedules**: One-time appointments for specific dates

Both types of schedules will be initially created with the status "Needs Assignment", meaning they need a caregiver assigned to them.

### Assigning Caregivers to Schedules

1. Navigate to the "Staff Client Schedules" section
2. You'll see all client schedules that need caregivers assigned
3. Click on a schedule to select it
4. The right panel will show available caregivers with match scores based on skills
5. Click "Assign" to assign a caregiver to the selected schedule

### Viewing Assigned Schedules

1. In the "Staff Client Schedules" section, check the "Show assigned schedules" box
2. This will display both unassigned and assigned schedules
3. Assigned schedules are marked with a green "Assigned" badge

### Editing Client Schedules

1. Navigate to the Client Profile Form
2. Select the client whose schedules you want to edit
3. Go to the "Schedule Requirements" tab
4. You'll see all existing recurring and single-date schedules
5. Make your changes and save the form

## Implementation Details

### Schedule Data Structure

Each schedule contains the following key fields:

- `client_id`: The ID of the client
- `caregiver_id`: The ID of the assigned caregiver (empty if unassigned)
- `isRecurring`: Boolean indicating if this is a recurring schedule
- `status`: Current status (Needs Assignment, Assigned, Completed, etc.)

For recurring schedules:
- `dayOfWeek`: Day of week (0-6, where 0 is Sunday)
- `recurrenceType`: Pattern (weekly, biweekly, monthly)
- `startDate`: Date when this recurring pattern begins

For single-date schedules:
- `date`: The specific date for this schedule

Both types include:
- `startTime`: Start time in HH:MM format
- `endTime`: End time in HH:MM format
- `careNeeds`: Array of care need types required for this appointment

### Database Collections

The scheduling system uses the following Firestore collections:

- `clients`: Client profiles
- `caregivers`: Caregiver profiles
- `schedules`: All schedule entries (both recurring and single-date)
- `caregiver_availability`: Caregiver availability patterns

## Troubleshooting

If schedules are not appearing in the Staff Client Schedules component:

1. Make sure you've completed the client profile with schedules and saved it
2. Click the "Refresh Schedules" button in the Staff Client Schedules component
3. Verify the schedule was saved correctly by editing the client again and checking the Schedule Requirements tab

If available caregivers aren't showing up for a schedule:

1. Make sure caregivers have been created with appropriate skills
2. Verify caregiver availability has been set up using the Availability Manager
3. Check that the caregiver's regular schedule includes the day of week and time range needed

## Caregiver Availability Data Model (Advanced)

The `caregiver_availability` Firestore collection stores availability for each caregiver. The document ID is the `caregiverId`. Within each document, the `availability` field holds the structured data defining when a caregiver is available. This structure supports both specific recurring slots and general availability rules.

**Structure of the `availability` field:**

```json
{
  "specific_slots": [
    { "day": "Monday", "start": "09:00", "end": "12:00" },
    { "day": "Wednesday", "start": "14:00", "end": "17:00" }
  ],
  "general_rules": [
    {
      "id": "rule1_workdays",
      "type": "weekly_recurring",
      "days_of_week": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "start_time": "09:00",
      "end_time": "17:00",
      "effective_start_date": "2024-01-01",
      "effective_end_date": null,
      "time_zone": "America/New_York",
      "exceptions": [
        { "date": "2024-07-04", "reason": "Holiday - Full Day" },
        { "date": "2024-08-15", "start_time": "13:00", "end_time": "17:00", "reason": "Personal Appointment" }
      ]
    },
    {
      "id": "rule2_saturday",
      "type": "weekly_recurring",
      "days_of_week": ["Saturday"],
      "start_time": "10:00",
      "end_time": "14:00",
      "effective_start_date": "2024-01-01",
      "effective_end_date": null
    }
  ],
  "time_off": [
    {
      "id": "pto_summer_2024",
      "start_datetime": "2024-07-20T00:00:00Z",
      "end_datetime": "2024-07-28T23:59:59Z",
      "reason": "Summer Vacation"
    }
  ]
}
```

**Field Descriptions:**

*   **`specific_slots`** (Array):
    *   Defines fixed, recurring time slots for a caregiver. This is useful for caregivers with very regular, pre-defined commitments.
    *   Each object contains:
        *   `day`: (String) Day of the week (e.g., "Monday", "Tuesday").
        *   `start`: (String) Start time in HH:MM format.
        *   `end`: (String) End time in HH:MM format.

*   **`general_rules`** (Array):
    *   Defines broader blocks of availability.
    *   Each rule object contains:
        *   `id`: (String) A unique identifier for the rule (e.g., "workdays_std", "saturday_am").
        *   `type`: (String) Type of rule. Currently, `"weekly_recurring"` is supported.
        *   `days_of_week`: (Array of Strings) Days this rule applies to (e.g., `["Monday", "Friday"]`).
        *   `start_time`: (String) General start time for these days (HH:MM).
        *   `end_time`: (String) General end time for these days (HH:MM).
        *   `effective_start_date`: (String - YYYY-MM-DD, Optional) Date when this rule becomes active.
        *   `effective_end_date`: (String - YYYY-MM-DD, Optional) Date when this rule is no longer active. If `null`, the rule does not expire.
        *   `time_zone`: (String, Optional but Recommended) IANA time zone name (e.g., "America/New_York", "Europe/London"). Helps clarify times if system spans multiple zones.
        *   `exceptions`: (Array of Objects, Optional) Specific dates or times when the caregiver is *not* available, overriding this general rule.
            *   Each exception object:
                *   `date`: (String - YYYY-MM-DD) The date of the exception.
                *   `start_time`: (String - HH:MM, Optional) If the exception is for part of the day.
                *   `end_time`: (String - HH:MM, Optional) If the exception is for part of the day.
                *   `reason`: (String, Optional) Reason for the exception.

*   **`time_off`** (Array):
    *   Defines explicit periods when the caregiver is completely unavailable (e.g., vacation, sick leave). This takes precedence over any other availability rules.
    *   Each object contains:
        *   `id`: (String) A unique identifier for the time off period.
        *   `start_datetime`: (String - ISO 8601 Timestamp, e.g., "2024-12-20T00:00:00Z") The start date and time of the time off.
        *   `end_datetime`: (String - ISO 8601 Timestamp, e.g., "2024-12-28T23:59:59Z") The end date and time of the time off.
        *   `reason`: (String, Optional) Reason for the time off.

**Precedence for Availability Checks:**

When determining if a caregiver is available for a specific date and time, the system checks in the following order:
1.  **Time Off (`time_off`):** If the requested time falls within a `time_off` period, the caregiver is UNAVAILABLE.
2.  **Specific Slots (`specific_slots`):** If the requested time matches a defined specific slot, the caregiver is AVAILABLE.
3.  **General Rules (`general_rules`):** If the requested time falls within an active general rule (and is not overridden by one of its exceptions), the caregiver is AVAILABLE.
4.  If none of the above conditions make the caregiver available, they are considered UNAVAILABLE for the requested time.

This model allows for flexible definition of caregiver availability, accommodating both highly structured schedules and more general availability patterns.

## Client Profile Fields for Optimization

For the scheduling optimization system to work effectively, client profiles (stored in the `clients` collection) should ideally contain the following fields, in addition to standard contact and care information:

*   **`name`** (String): Client's name.
*   **`location`** (Object): Client's address, geocoordinates.
    *   Example: `{ "address": "123 Main St, Anytown, USA", "latitude": 34.0522, "longitude": -118.2437 }`
*   **`required_skills`** (Array of Strings): Specific skills needed for this client (e.g., `["Dementia Care", "Medication Reminder"]`).
*   **`preferences`** (Object, Optional): Client preferences.
    *   `preferred_caregivers` (Array of Strings): List of caregiver IDs the client prefers.
    *   `blocked_caregivers` (Array of Strings): List of caregiver IDs the client wishes to avoid.
*   **`authorized_weekly_hours`** (Number): Total number of care hours authorized for the client per week. This is a key input for 100% coverage goal.
*   **`bus_line_access`** (Boolean): `true` if the client's location is easily accessible via public transportation, `false` otherwise.
*   **`required_shift_details_notes`** (String, Optional): Textual notes describing specific, non-negotiable shift structures or patterns if they cannot be easily broken down from `authorized_weekly_hours`. E.g., "Needs 2-hour morning shift daily (approx 8-10 AM) and 1-hour evening check-in (approx 6-7 PM)". The optimization algorithm will primarily work off `authorized_weekly_hours` and try to create efficient schedules; these notes can guide human review or agent suggestions if specific pre-defined shifts are not already in the `schedules` collection as 'unassigned'.
*   **`status`** (String): Current status of the client, e.g., `'active_needs_assessment'`, `'active_receiving_care'`, `'inactive'`, `'pending_start'`. Used to identify clients who are currently candidates for scheduling.
*   **`additional_notes`** (String, Optional): Any other relevant notes for scheduling or care.

## Caregiver Profile Fields for Optimization

Caregiver profiles (stored in the `caregivers` collection) should contain the following fields relevant to optimization, in addition to their personal and professional details:

*   **`name`** (String): Caregiver's name.
*   **`location`** (Object, Optional): Caregiver's home base location, for travel calculations.
    *   Example: `{ "address": "456 Oak Ave, Anytown, USA", "latitude": 34.0522, "longitude": -118.2437 }`
*   **`skills`** (Array of Strings): Skills the caregiver possesses (e.g., `["Companionship", "Hoyer Lift Certified"]`).
*   **`availability`**: (Object) Detailed availability structure, stored in the `caregiver_availability/{caregiverId}` document. (See "Caregiver Availability Data Model" section above).
*   **`drives_car`** (Boolean): `true` if the caregiver has a car and is willing to use it for work, `false` otherwise.
*   **`max_days_per_week`** (Number): Maximum number of days this caregiver is willing to work per week (e.g., 5).
*   **`max_hours_per_week`** (Number): Absolute maximum number of hours this caregiver can work per week (e.g., 40 or 45).
*   **`target_weekly_hours`** (Number, Optional): The caregiver's preferred or target number of weekly hours. Used to identify opportunities to increase hours if they are below this target.
*   **`employment_type`** (String): E.g., `'part-time'` (<=24 hours/week), `'full-time'` (>24 and <=45 hours/week), `'contractor'`.
*   **`can_work_simultaneous_clients_nearby`** (Boolean, Default: `false`): Indicates if the caregiver is willing and able to cover two clients simultaneously under very strict conditions (last resort for coverage, clients very close).
*   **`max_simultaneous_travel_miles`** (Number, Default: 5): If `can_work_simultaneous_clients_nearby` is true, this is the maximum permissible distance in miles between the two clients.
*   **`preferences`** (Object, Optional): Caregiver preferences.
    *   `preferred_client_tags` (Array of Strings): E.g., `["non-smoker", "pets_ok"]`.
    *   `max_travel_time_per_shift_minutes` (Number, Optional): Maximum travel time they are willing to spend for a single shift.
*   **`status`** (String): E.g., `'active'`, `'on_leave'`, `'inactive'`.
