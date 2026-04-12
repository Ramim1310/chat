const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
    try {
        console.log("Starting tests...");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        console.log("AI Init successful");

        const prompt = `Search for the most recent updates about "gaming". Provide 3 bullet points.`;
        console.log("Generating content...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        console.log("RESPONSE:", response.text);
    } catch (e) {
        console.error("ERROR:", e);
    }
}
test();
