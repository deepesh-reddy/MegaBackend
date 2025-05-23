import mongoose from 'mongoose'
import {
    DB_NAME
} from '../constants.js'
import 'dotenv/config'

const connectDB = async () => {
    try {
        console.log('Waiting for the database to connect, connection is in progress');

        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);

        console.log(`\n MongoDB connected ! DB host : ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log('MongoDB connection error', error);
        process.exit(1);
    }
}

export default connectDB;