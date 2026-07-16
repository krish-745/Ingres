import fs from 'fs';
import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env' });
const { Pool } = pkg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
});

// CSV parser that handles quoted strings
function parseCSVRow(str) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '"') {
            inQuotes = !inQuotes;
        } else if (str[i] === ',' && !inQuotes) {
            result.push(cur);
            cur = '';
        } else {
            cur += str[i];
        }
    }
    result.push(cur);
    return result;
}

async function setup() {
    try {
        console.log("Creating meta tables...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ingres_schema (
                table_name TEXT,
                column_name TEXT,
                datatype TEXT,
                alts TEXT
            );
            CREATE TABLE IF NOT EXISTS ingres_sample_questions (
                question TEXT,
                query TEXT
            );
            TRUNCATE TABLE ingres_schema;
            TRUNCATE TABLE ingres_sample_questions;
        `);
        
        console.log("Reading schema.csv...");
        const schemaCsv = fs.readFileSync('../data/schema.csv', 'utf8').trim().split('\n').slice(1);
        for (let row of schemaCsv) {
            const [table, col, type, alts] = parseCSVRow(row.trim());
            if (table && col) {
                await pool.query('INSERT INTO ingres_schema (table_name, column_name, datatype, alts) VALUES ($1, $2, $3, $4)', [table, col, type, alts]);
            }
        }

        console.log("Reading sample_questions.csv...");
        const questionsCsv = fs.readFileSync('../data/sample_questions.csv', 'utf8').trim().split('\n').slice(1);
        for (let row of questionsCsv) {
            if (!row.trim()) continue;
            const cols = parseCSVRow(row.trim());
            if (cols.length >= 2) {
                const question = cols[0];
                const query = cols.slice(1).join(',').replace(/^"|"$/g, '');
                await pool.query('INSERT INTO ingres_sample_questions (question, query) VALUES ($1, $2)', [question, query]);
            }
        }
        
        console.log("Successfully imported meta tables!");
    } catch (e) {
        console.error("Error setting up meta tables:", e);
    } finally {
        await pool.end();
    }
}

setup();
