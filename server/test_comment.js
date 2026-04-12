const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
    try {
        const user = await prisma.user.findFirst();
        const post = await prisma.post.findFirst();
        if (!user || !post) return console.log("No user or post");
        
        console.log("Using user", user.id, "post", post.id);
        const comment = await prisma.threaded_Comment.create({
            data: {
                content: "Test",
                authorId: user.id,
                postId: post.id
            },
            include: { author: { select: { name: true, image: true } } }
        });
        console.log(comment);
    } catch(e) {
        console.error(e);
    }
}
test();
