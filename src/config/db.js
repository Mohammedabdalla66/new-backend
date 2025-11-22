// db.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export async function connectDB() {
  try {
    mongoose.set("strictQuery", true);

    // Connect
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME || "accountax",
    });

    // Logs
    console.log("======================================");
    console.log("✅ MongoDB Connected Successfully");
    console.log("📌 Host:", conn.connection.host);
    console.log("📌 Port:", conn.connection.port);
    console.log("📌 Database:", conn.connection.name);
    console.log("📌 Full URI (sanitized):", sanitizeURI(process.env.MONGO_URI));
    console.log("======================================");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

// Removes password if exists
function sanitizeURI(uri) {
    if (!uri) return "Not Provided";
    return uri.replace(/\/\/(.*?):(.*?)@/, "//****:****@");
}



