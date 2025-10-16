import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { cb as Chatbot } from './base.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const chatbot = new Chatbot();

const { Pool } = pg;
const conn = {
        user: 'postgres',
        host: 'localhost',
        database: 'ingres',
        password: 'adit1290',
        port: 5432,
    };
const pool = new Pool(conn);

app.post('/api/chat', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required.' });
    }

    try {
        const plan = await chatbot.answer(question);
        console.log('Executing SQL:', plan.sql_query);
        const result = await pool.query(plan.sql_query);
        const data = result.rows;

        res.json({
            chartType: plan.chart_type,
            title: plan.title_suggestion,
            data: data, 
        });
    } catch (error) {
        console.error('Error processing chat request:', error);
        res.status(500).json({ error: 'Failed to get a response from the AI.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});