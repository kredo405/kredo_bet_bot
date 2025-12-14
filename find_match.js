const fs = require('fs');
const path = require('path');
const { getPrediction } = require('./src/services/llm');

async function findMatchAndPredict() {
    const tempDir = '/home/kredo405/.gemini/tmp/401e09a38c60e7e20b470c88d0f709c7fe2bcd07492dde3083c103ae4ce0e0c3';
    const dataPath = path.join(tempDir, 'matches_data.json');
    
    // These would be the teams the user selects in the bot
    const homeTeam = "Nott'ham Forest";
    const awayTeam = "Tottenham";

    try {
        const matchesData = fs.readFileSync(dataPath, 'utf-8');
        const matchesJson = JSON.parse(matchesData);

        const prompt = `
You are an intelligent assistant. Your task is to find a specific football match from a large JSON object containing a list of leagues and their matches.

Find the match where the home team is "${homeTeam}" and the away team is "${awayTeam}".

The JSON data is provided below:
\
${JSON.stringify(matchesJson, null, 2)}
\

Once you have found the match, you MUST return ONLY the JSON object for that single match. Do not include any other text, explanations, or markdown formatting. Your output should be a clean JSON object.
`;

        console.log("Sending prompt to AI to find the match...");
        const result = await getPrediction(prompt);
        
        console.log("--- AI Result ---");
        console.log(result);
        console.log("-----------------");

    } catch (error) {
        console.error("An error occurred in findMatchAndPredict:", error);
    }
}

findMatchAndPredict();
