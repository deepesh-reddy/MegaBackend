import { app } from "./app.js";
import 'dotenv/config'
import connectDB from "./db/index.js";

const port = process.env.PORT || 8000;

connectDB()
.then(()=>{
    app.listen(port,()=>{
    console.log(`Server running on port ${port}`);
})
})
.catch((err)=>{
    console.log('MongoDB connection error',err);
})