import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export async function connectDB(): Promise<void> {
    let uri = process.env.MONGODB_URI;
    const isProd = process.env.NODE_ENV === 'production';

    // In production, we MUST have a valid MONGODB_URI
    if (isProd && (!uri || uri.includes('cluster.mongodb.net') || uri.includes('<user>') || uri.includes('example.com'))) {
        console.error('\n❌ FATAL: MISSING MONGODB_URI IN PRODUCTION');
        console.error('ACTION REQUIRED: Please provide a valid MONGODB_URI in your environment variables.\n');
        process.exit(1);
    }

    // fallback for local dev if no URI
    if (!uri || uri.includes('cluster.mongodb.net') || uri.includes('<user>') || uri.includes('example.com')) {
        console.log('⚠️ No real MongoDB URI detected. Attempting to spin up an in-memory database...');
        try {
            mongoServer = await MongoMemoryServer.create({
                instance: {
                    dbName: 'docsign_test'
                }
            });
            uri = mongoServer.getUri();
        } catch (err: any) {
            console.error('\n❌ FAILED TO START IN-MEMORY MONGODB');
            throw err;
        }
    }

    try {
        await mongoose.connect(uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
    } catch (err: any) {
        console.error(`❌ Mongoose connection failed: ${err.message}`);
        throw err;
    }

    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

    // Auto-seed if in-memory
    if (mongoServer) {
        console.log('🌱 Auto-seeding demo user for in-memory DB...');
        const User = mongoose.model('User');
        const email = 'demo@example.com';
        const exists = await User.findOne({ email });
        if (!exists) {
            await User.create({
                name: 'Demo User',
                email,
                password: 'Password123'
            });
            console.log('✅ Demo user seeded: demo@example.com / Password123');
        }
    }
}

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('error', err => console.error('❌ MongoDB error:', err));

const shutdown = async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);