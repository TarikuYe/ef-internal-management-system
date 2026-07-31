import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { Client } from 'pg';

const connectionString = process.env.SUPABASE_URL?.replace('https://', 'postgresql://postgres:') + '...' // wait, SUPABASE_URL is not the connection string!
// In .env, is there a DATABASE_URL? Let's check .env again.
