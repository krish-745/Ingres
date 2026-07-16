// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';

import { cb as Chatbot } from './base.js';
import { detectLanguage, translateText } from './translationService.js';
import logger from './logger.js';

dotenv.config();

const { Pool } = pkg;
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const chatbot = new Chatbot();
await chatbot.initialize();

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
});


// ✅ Test DB Endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ success: true, time: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ✅ Main Chat Endpoint
app.post('/api/chat', async (req, res) => {
    const { question, history = [] } = req.body;
    if (!question) {
        logger.info(`Request from ${req.ip} | Missing question parameter | 400`);
        return res.status(400).json({ error: 'Question is required.' });
    }

    try {
        const detectedLang = await detectLanguage(question);
        let questionInEnglish = question;

        if (detectedLang !== 'EN') {
            questionInEnglish = await translateText(question, 'EN', detectedLang);
        }

        let enhancedQuestion = questionInEnglish;
        if (detectedLang !== 'EN') {
            enhancedQuestion = `${questionInEnglish} (Please provide the title and labels in ${detectedLang})`;
        }

        logger.info(`Incoming | Q: ${question} | Detected: ${detectedLang}`);

        const plan = await chatbot.answer(enhancedQuestion, history);
        logger.info(`Generated Plan: ${JSON.stringify(plan)}`);

        const result = await pool.query(plan.sql_query);
        let data = result.rows;

        let finalChartType = plan.chart_type || 'table';
        let finalTitle = plan.title_suggestion || '';
        let finalAnswer = plan.one_line_answer || '';

        // 🟢 Handle single_value results
        if (finalChartType === 'single_value' && data.length > 0) {
            const firstRow = data[0];
            const value = Object.values(firstRow)[0];

            if (finalAnswer.includes('[value]')) {
                finalAnswer = finalAnswer.replace('[value]', value);
            }
            if (finalTitle.includes('[value]')) {
                finalTitle = finalTitle.replace('[value]', value);
            }

            data = firstRow; // flatten
        }

        // 🟢 Translate column names if needed
        if (detectedLang !== 'EN' && Array.isArray(data) && data.length > 0) {
            const keys = Object.keys(data[0]);
            const translatedKeys = await Promise.all(
                keys.map(key => translateText(key, detectedLang, 'EN'))
            );

            data = data.map(row => {
                const newRow = {};
                keys.forEach((oldKey, index) => {
                    newRow[translatedKeys[index]] = row[oldKey];
                });
                return newRow;
            });
        }

        logger.info(`Response to ${req.ip} | 200 OK`);
        res.json({
            chartType: finalChartType,
            title: finalTitle,
            oneLineAnswer: finalAnswer, // 🟢 Include this for frontend
            data,
            userLanguage: detectedLang
        });

    } catch (error) {
        res.status(500).json({ error: `Backend Error: ${error.message}` });
    }
});


// ✅ Start Server
app.listen(port, '0.0.0.0', () => {
    logger.info(`✅ Server running at http://localhost:${port}`);
});
