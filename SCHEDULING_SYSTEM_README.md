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
