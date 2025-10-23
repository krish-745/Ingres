// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import { cb as Chatbot } from './base.js';
import { detectLanguage, translateText } from './translationService.js';

dotenv.config();

const { Pool } = pkg;

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const chatbot = new Chatbot();

// PostgreSQL connection (Supabase)
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
});

// Test endpoint to verify DB connection
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ success: true, time: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/chat', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required.' });
    }

    try {
        // Step 1: Detect the language of the user's question
        const detectedLang = await detectLanguage(question);
        console.log('Detected language:', detectedLang);

        // Step 2: Translate question to English if not already in English
        let questionInEnglish = question;
        if (detectedLang !== 'EN') {
            questionInEnglish = await translateText(question, 'EN', detectedLang);
            console.log('Translated to English:', questionInEnglish);
        }

        // Step 3: Add language instruction to the question for the chatbot
        let enhancedQuestion = questionInEnglish;
        if (detectedLang !== 'EN') {
            const languageNames = {
                'HI': 'Hindi',
                'ES': 'Spanish',
                'FR': 'French',
                'DE': 'German',
                'ZH': 'Chinese',
                'JA': 'Japanese',
                'AR': 'Arabic',
                'PT': 'Portuguese',
                'RU': 'Russian',
                'IT': 'Italian'
            };
            const langName = languageNames[detectedLang] || detectedLang;
            enhancedQuestion = `${questionInEnglish} (Please provide the title and labels in ${langName})`;
        }

        // Step 4: Process the question through the chatbot
        const plan = await chatbot.answer(enhancedQuestion);
        console.log('Executing SQL:', plan.sql_query);
        
        // Step 5: Execute the SQL query
        const result = await pool.query(plan.sql_query);
        const data = result.rows;

        // Step 6: Translate column headers in the data if needed
        let translatedData = data;
        if (detectedLang !== 'EN' && data.length > 0) {
            const keys = Object.keys(data[0]);
            const translatedKeys = await Promise.all(
                keys.map(key => translateText(key, detectedLang, 'EN'))
            );

            translatedData = data.map(row => {
                const newRow = {};
                keys.forEach((oldKey, index) => {
                    newRow[translatedKeys[index]] = row[oldKey];
                });
                return newRow;
            });
        }

        // Step 7: Return chart data with translated title (from chatbot) and data
        res.json({
            chartType: plan.chart_type,
            title: plan.title_suggestion,
            data: translatedData,
            userLanguage: detectedLang
        });

    } catch (error) {
        console.error('Error processing chat request:', error);
        
        let errorMessage = 'Failed to get a response from the AI.';
        try {
            const detectedLang = await detectLanguage(question);
            if (detectedLang !== 'EN') {
                errorMessage = await translateText(errorMessage, detectedLang, 'EN');
            }
        } catch (translationError) {
            console.error('Error translating error message:', translationError);
        }
        
        res.status(500).json({ error: errorMessage });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
