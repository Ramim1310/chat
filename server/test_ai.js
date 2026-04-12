const prisma = require('./db');
const { summarizePost } = require('./services/aiService');

async function runTest() {
    try {
        console.log("Creating test user if not exists...");
        let user = await prisma.user.findFirst();
        if (!user) {
            user = await prisma.user.create({
                data: { name: 'Test User 2', email: 'test2@example.com', password: 'asd' }
            });
        }

        console.log("Creating community...");
        let community = await prisma.community.findUnique({ where: { name: 'Gaming' } });
        if (!community) {
            community = await prisma.community.create({
                data: { name: 'Gaming', description: 'Gaming Hub', creatorId: user.id }
            });
        }

        console.log("Creating post...");
        const post = await prisma.post.create({
            data: {
                title: 'Elden Ring is amazing',
                content: 'I just beat Malenia after 500 tries. This game is incredibly hard but the reward is huge because of the satisfaction you get from the challenging combat system.',
                authorId: user.id,
                communityId: community.id
            }
        });

        console.log("Triggering AI Service...");
        await summarizePost(post.id, post.content, community.name);

        console.log("\n--- Checking Database Results ---");
        const insight = await prisma.aI_Insight.findUnique({ where: { postId: post.id } });
        console.log("AI Insight:", insight);

        const comments = await prisma.threaded_Comment.findMany({ where: { postId: post.id } });
        console.log("Comments:", comments);

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}


runTest();
