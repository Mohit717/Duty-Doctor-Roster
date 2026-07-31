import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from "cors";
import testConnection from './config/db';
import router from './roster.routes';

dotenv.config();

const app = express();
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? 'https://duty-doctor-roster-nu.vercel.app'
        : 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use("/api/v1/", router)

testConnection();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});