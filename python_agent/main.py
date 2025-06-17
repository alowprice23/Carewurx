import os
import sys
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, LLM

# Load environment variables from .env file and verify API key
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("ERROR: GROQ_API_KEY not found in environment variables!")
    print("Please make sure your .env file contains GROQ_API_KEY")
    sys.exit(1)

# Initialize Flask app
app = Flask(__name__)

# Initialize Groq LLM using CrewAI
try:
    print(f"Initializing Groq LLM with key: {GROQ_API_KEY[:5]}...")
    llm = LLM(
        model="deepseek-r1-distill-llama-70b",
        temperature=0.6,
        max_tokens=4096,
        top_p=0.95,
        stream=False,
        stop=None
    )
    print("Groq LLM initialized successfully!")
except Exception as e:
    print(f"CRITICAL ERROR initializing Groq LLM: {str(e)}")
    print("Detailed exception info:", repr(e))
    sys.exit(1)  # Exit the application if LLM can't be initialized

# Define the CrewAI agents for healthcare management
healthcare_agent = Agent(
    role='Healthcare Management Assistant',
    goal='Provide professional and helpful assistance with healthcare scheduling and client/caregiver management',
    backstory='''You are Bruce, an experienced healthcare management assistant. You help
    manage a care facility's operations, including client information, caregiver profiles,
    scheduling, and answering questions about healthcare policies. You are professional,
    helpful, and compassionate in your responses, focusing on providing clear, actionable
    information while maintaining a warm tone. You always prioritize client care needs when
    making recommendations about scheduling or caregiver assignments.''',
    llm=llm,
    verbose=True
)

@app.route('/bruce', methods=['POST'])
def handle_bruce_request():
    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({"error": "Prompt not provided"}), 400

    prompt = data['prompt']
    print(f"Received prompt: {prompt}")

    try:
        # Create a task for the healthcare agent based on the user's prompt
        task = Task(
            description=f"Respond to this healthcare-related query: {prompt}",
            expected_output="A professional, helpful, and compassionate response that provides clear information and actionable guidance.",
            agent=healthcare_agent
        )

        # Create and run the crew with just our healthcare agent
        crew = Crew(
            agents=[healthcare_agent],
            tasks=[task],
            verbose=True
        )

        # Execute the task and get the result
        result = crew.kickoff()
        print(f"Generated response: {result[:100]}...")  # Log first 100 chars
        
        return jsonify({"response": result})
    except Exception as e:
        error_message = str(e)
        print(f"Error during CrewAI execution: {error_message}")
        return jsonify({"error": error_message}), 500

if __name__ == '__main__':
    # Note: This is a development server. For production, use a proper WSGI server.
    app.run(host='0.0.0.0', port=5001)
