import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from "cors";
import testConnection from './config/db';
import router from './roster.routes';

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use("/api/v1/", router)

testConnection();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});