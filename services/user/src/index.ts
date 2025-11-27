import express from "express";
import dotenv from "dotenv"
import userRoutes from "./routes/user.js"
dotenv.config();
const PORT =process.env.PORT
const app = express();

app.use(express.json())
app.use("/api/user",userRoutes);


app.listen(PORT ,()=>{
    console.log(`user service is running on the http://localhost:${PORT}`)
})