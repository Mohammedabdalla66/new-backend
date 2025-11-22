import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { connectDB } from '../config/db.js';

dotenv.config();

async function createAdmin() {
  try {
    await connectDB();
    console.log('✅ Connected to database');

    const adminEmail = 'admin@admin.com';
    const adminPassword = 'admin@admin1';
    const adminName = 'Admin User';

    // Check if admin already exists
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      // Update existing admin to ensure correct role and status
      admin.role = 'admin';
      admin.status = 'active';
      admin.password = adminPassword; // This will be hashed by the pre-save hook
      await admin.save();
      console.log('✅ Admin user updated:', {
        email: admin.email,
        role: admin.role,
        status: admin.status
      });
    } else {
      // Create new admin
      admin = await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        status: 'active',
        verified: true
      });
      console.log('✅ Admin user created:', {
        email: admin.email,
        role: admin.role,
        status: admin.status
      });
    }

    console.log('\n✅ Admin user is ready!');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Role:', admin.role);
    console.log('Status:', admin.status);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();

