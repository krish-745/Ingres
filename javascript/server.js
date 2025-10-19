import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { cb as Chatbot } from './base.js';
import { detectLanguage, translateText, translateChartData } from './translationService.js';

dotenv.config();

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
    password: 'crash',
    port: 5432,
};
const pool = new Pool(conn);

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

        // Step 3: Process the English question through the chatbot
        const plan = await chatbot.answer(questionInEnglish);
        console.log('Executing SQL:', plan.sql_query);
        
        // Step 4: Execute the SQL query
        const result = await pool.query(plan.sql_query);
        const data = result.rows;

        // Step 5: Prepare chart data in English
        let chartData = {
            chartType: plan.chart_type,
            title: plan.title_suggestion,
            data: data,
        };

        // Step 6: Translate chart data back to user's language
        if (detectedLang !== 'EN') {
            chartData = await translateChartData(chartData, detectedLang);
            console.log('Translated chart back to:', detectedLang);
        }

        // Step 7: Include detected language in response for frontend
        res.json({
            ...chartData,
            userLanguage: detectedLang
        });

    } catch (error) {
        console.error('Error processing chat request:', error);
        
        // Try to translate error message if we know the user's language
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