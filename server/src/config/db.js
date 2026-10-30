import mongoose from 'mongoose';
import { MONGODB_URI } from './env.js';

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  if (!MONGODB_URI) {
    console.error('\n\x1b[31m[Database Configuration Error]\x1b[0m');
    console.error('MONGODB_URI is not set in environment or .env file.');
    console.error('Please configure MONGODB_URI with your MongoDB Atlas connection string, for example:');
    console.error('MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/work-tracker?retryWrites=true&w=majority\n');
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log(`Successfully connected to MongoDB Atlas database: "${mongoose.connection.name}"`);
  } catch (err) {
    console.error('\n\x1b[31m[Database Connection Failed]\x1b[0m');
    console.error(`Unable to connect to MongoDB Atlas: ${err.message}`);
    console.error('Please verify your connection string, network access, and IP whitelist in MongoDB Atlas.\n');
    process.exit(1);
  }
}

export default connectDB;

