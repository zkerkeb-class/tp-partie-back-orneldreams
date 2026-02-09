import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

console.log("Attempting to connect to MongoDB...");

export const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/pokemon-db-2";
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB successfully");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
};


connectDB();