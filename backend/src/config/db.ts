import dotenv from 'dotenv';
import { Pool } from "pg";
dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
    try {
        const result = await pool.query("SELECT NOW()");
        console.log("Connected!");
        console.log(result.rows[0]);
    } catch (err) {
        console.error("Database connection failed:", err);
    }
}

export default testConnection;