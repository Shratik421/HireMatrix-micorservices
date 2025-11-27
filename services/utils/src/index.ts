import express from "express";
import dotenv from "dotenv"
import routes from "./routes/routes.js"
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import { startSendMailConsumer } from "./consumer.js";

dotenv.config();

startSendMailConsumer();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_CLOUD_API_KEY as string,
  api_secret: process.env.CLOUDINARY_CLOUD_API_SECRET as string,
});

const app = express();
app.use(cors())

app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb", extended: true }))
app.use("/api/utils", routes)



const PORT = process.env.PORT



app.listen(PORT, () => {
  console.log(`UTILS Service is running on http://localhost:${PORT}`)
})