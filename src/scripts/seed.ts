import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User.model';
import { connectDB } from '../config/database';
import 'dotenv/config';

async function seed() {
    try {
        await connectDB();

        const email = 'demo@example.com';
        const password = 'Password123';

        // Check if user exists
        let user = await User.findOne({ email });
        if (!user) {
            console.log('Creating demo user...');
            user = await User.create({
                name: 'Demo User',
                email,
                password // The model pre-save hook will hash this
            });
            console.log(`✅ Demo user created!`);
        } else {
            console.log(`✅ Demo user already exists.`);
            // Update password just in case
            user.password = password; // pre-save hook will hash it
            await user.save();
            console.log(`✅ Demo user password reset to defaults.`);
        }

        console.log('\n--- Login Credentials ---');
        console.log(`Email:    ${email}`);
        console.log(`Password: ${password}`);
        console.log('-------------------------\n');

        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seed();
