const {
    GetClientDetailsTool,
    GetAllClientsTool,
    GenerateScheduleTool,
    FlagCaregiverForMoreHoursTool
} = require('./tools');

/**
 * This is a simplified simulation of a CrewAI setup in JavaScript.
 * In a real-world scenario with Python interoperability, this would involve
 * creating Agent and Task objects from the `crewai` library.
 * Here, we use a rule-based approach to select and execute the correct tool.
 */
const crewService = {
    // Instantiate all available tools
    tools: {
        getClientDetails: new GetClientDetailsTool(),
        getAllClients: new GetAllClientsTool(),
        generateSchedule: new GenerateScheduleTool(),
        flagCaregiver: new FlagCaregiverForMoreHoursTool(),
    },

    /**
     * Simulates the "kickoff" of a CrewAI task.
     * It analyzes the user's prompt and determines which tool to run.
     * @param {string} prompt - The user's message from the chat.
     * @returns {Promise<string>} The result from the executed tool.
     */
    async kickoff(prompt) {
        const lowerCasePrompt = prompt.toLowerCase();

        // Rule-based tool selection
        if (lowerCasePrompt.includes('generate schedule') || lowerCasePrompt.includes('create schedule')) {
            return this.tools.generateSchedule.run();
        }

        if (lowerCasePrompt.includes('list all clients') || lowerCasePrompt.includes('show all clients')) {
            return this.tools.getAllClients.run();
        }

        if (lowerCasePrompt.includes('flag') && lowerCasePrompt.includes('more hours')) {
            const caregiverId = this.extractId(prompt);
            return this.tools.flagCaregiver.run({ caregiverId });
        }

        if (lowerCasePrompt.includes('client details') || (lowerCasePrompt.includes('client') && this.extractId(prompt))) {
            const clientId = this.extractId(prompt);
            return this.tools.getClientDetails.run({ clientId });
        }

        // Default response if no specific tool is matched
        return "I'm not sure how to handle that request. Please try asking to 'generate schedule', 'list all clients', or ask for a specific 'client details [ID]'.";
    },

    /**
     * A simple helper to extract an ID from a prompt.
     * This is a placeholder for more sophisticated entity extraction.
     * @param {string} prompt - The user's message.
     * @returns {string|null} The extracted ID or null.
     */
    extractId(prompt) {
        const match = prompt.match(/([a-zA-Z0-9]+)$/);
        return match ? match[1] : null;
    }
};

module.exports = crewService;
