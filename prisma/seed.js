const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = "user@user.com";
    const password = "user123";
    const name = "John Doe";

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (!existingUser) {
        await prisma.user.create({
            data: { email, password: hashedPassword, name }
        });
        console.log("✅ Initial user created: user@user.com / user123");
    } else {
        console.log("⚠️ User already exists!");
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
