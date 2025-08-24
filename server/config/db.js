import mongoose from "mongoose";

// Try different connection strings


export const connectDB = async () => {

    try {
 
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000, // Timeout after 10s
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        family: 4 // Use IPv4, skip trying IPv6
      });
      console.log("MongoDB connected successfully");
      return; // Exit if successful
    } catch (error) {
      if (i === CONNECTION_URLS.length - 1) {
        console.log("All connection attempts failed. Continuing without database connection...");
      }
    }
  
};

