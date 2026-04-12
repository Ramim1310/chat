const { GoogleGenAI } = require('@google/genai');
const prisma = require('../db');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const TARGET_COMMUNITIES = ['gaming', 'anime', 'movie', 'sports'];

async function getOrCreateSystemAgent() {
    let agent = await prisma.user.findUnique({
        where: { email: 'system@agent.local' }
    });
    
    if (!agent) {
        const hashedPassword = await bcrypt.hash('system_agent_secret', 10);
        agent = await prisma.user.create({
            data: {
                name: 'System Agent',
                email: 'system@agent.local',
                password: hashedPassword,
                bio: 'Automated AI summarization agent'
            }
        });
    }
    return agent;
}

async function summarizePost(postId, content, communityName) {
    if (!communityName || !TARGET_COMMUNITIES.includes(communityName.toLowerCase())) {
        console.log(`[AI SERVICE] Post ${postId} is in '${communityName}', skipping AI summarization.`);
        return;
    }

    try {
        console.log(`[AI SERVICE] Starting AI summarization for post ${postId}...`);
        
        // Initialize Gemini
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const prompt = `Summarize the following post into a concise paragraph:\n\n${content}`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const summary = response.text;
        
        if (!summary) {
            console.warn('[AI SERVICE] No summary generated.');
            return;
        }

        // Get or Create System Agent User
        const agent = await getOrCreateSystemAgent();

        // Transaction to insert AI_Insight and Threaded_Comment
        await prisma.$transaction([
            prisma.aI_Insight.create({
                data: {
                    summary: summary,
                    postId: postId
                }
            }),
            prisma.threaded_Comment.create({
                data: {
                    content: `**TL;DR:** ${summary}`,
                    authorId: agent.id,
                    postId: postId
                }
            })
        ]);

        console.log(`[AI SERVICE] AI Insight and TL;DR comment saved successfully to post ${postId}.`);

    } catch (err) {
        console.error(`[AI SERVICE] Error summarizing post ${postId}:`, err);
    }
}

module.exports = { summarizePost };
