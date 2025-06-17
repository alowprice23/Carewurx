const firebaseService = require('../services/firebase');
const enhancedScheduler = require('../services/enhanced-scheduler');

/*
    This is a placeholder for the BaseTool class from CrewAI.
    In a real Python environment, you would import this from `crewai.tools`.
    For this Node.js implementation, we'll simulate its structure.
*/
class BaseTool {
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }

    run(args) {
        throw new Error("The 'run' method must be implemented by subclasses.");
    }
}

class GetClientDetailsTool extends BaseTool {
    constructor() {
        super('Get Client Details', 'Fetches details for a specific client by their ID.');
    }

    async run({ clientId }) {
        if (!clientId) {
            return "Error: Client ID must be provided.";
        }
        try {
            const client = await firebaseService.getClient(clientId);
            return client ? JSON.stringify(client, null, 2) : `Client with ID '${clientId}' not found.`;
        } catch (error) {
            return `Error fetching client details: ${error.message}`;
        }
    }
}

class GetAllClientsTool extends BaseTool {
    constructor() {
        super('Get All Clients', 'Fetches a list of all clients.');
    }

    async run() {
        try {
            const clients = await firebaseService.getAllClients();
            return JSON.stringify(clients, null, 2);
        } catch (error) {
            return `Error fetching all clients: ${error.message}`;
        }
    }
}

class GenerateScheduleTool extends BaseTool {
    constructor() {
        super('Generate Schedule', 'Generates a new caregiver schedule based on all clients and caregivers.');
    }

    async run() {
        try {
            const clients = await firebaseService.getAllClients();
            const schedules = [];
            
            // Create a schedule for each client
            for (const client of clients) {
                const scheduleData = {
                    date: new Date().toISOString().split('T')[0], // Today's date
                    start_time: "09:00",
                    end_time: "17:00",
                    status: "unassigned"
                };
                
                const newSchedule = await enhancedScheduler.createClientSchedule(client.id, scheduleData);
                schedules.push(newSchedule);
            }
            
            // For each schedule, find and assign the best caregiver
            const assignmentResults = [];
            for (const schedule of schedules) {
                const caregiverRecommendations = await enhancedScheduler.findBestCaregiver(schedule.id);
                
                if (caregiverRecommendations && caregiverRecommendations.length > 0) {
                    const bestCaregiver = caregiverRecommendations[0];
                    const assignmentResult = await enhancedScheduler.assignCaregiverToSchedule(
                        schedule.id, 
                        bestCaregiver.caregiver.id
                    );
                    
                    assignmentResults.push({
                        schedule_id: schedule.id,
                        client_name: schedule.client_name,
                        caregiver_name: bestCaregiver.caregiver.name,
                        score: bestCaregiver.score,
                        success: assignmentResult.success
                    });
                } else {
                    assignmentResults.push({
                        schedule_id: schedule.id,
                        client_name: schedule.client_name,
                        success: false,
                        reason: "No suitable caregivers found"
                    });
                }
            }
            
            return `Schedules generated and caregivers assigned:\n${JSON.stringify(assignmentResults, null, 2)}`;
        } catch (error) {
            return `Error generating schedule: ${error.message}`;
        }
    }
}

class FlagCaregiverForMoreHoursTool extends BaseTool {
    constructor() {
        super('Flag Caregiver For More Hours', 'Flags a caregiver as wanting more hours.');
    }

    async run({ caregiverId }) {
        if (!caregiverId) {
            return "Error: Caregiver ID must be provided.";
        }
        try {
            await firebaseService.updateCaregiver(caregiverId, { wants_more_hours: true });
            return `Caregiver ${caregiverId} has been successfully flagged as wanting more hours.`;
        } catch (error) {
            return `Error flagging caregiver: ${error.message}`;
        }
    }
}


module.exports = {
    GetClientDetailsTool,
    GetAllClientsTool,
    GenerateScheduleTool,
    FlagCaregiverForMoreHoursTool,
    // We export the simulated BaseTool for consistency, though it won't be used directly.
    BaseTool 
};
