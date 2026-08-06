// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import rateLimit from 'express-rate-limit';

import { cb as Chatbot } from './base.js';
import { translateText } from './translationService.js';
import logger from './logger.js';

dotenv.config();

const { Pool } = pkg;
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { error: 'Too many requests, please try again after 5 minutes' },
});

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


//  Test DB Endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ success: true, time: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

//  Main Chat Endpoint
app.post('/api/chat', apiLimiter, async (req, res) => {
    const { question, history = [], captcha_token } = req.body;
    
    if (!captcha_token) {
        logger.warn(`Unauthorized access attempt from ${req.ip}: Missing Captcha Token`);
        return res.status(401).json({ error: 'Unauthorized: Missing Captcha Token' });
    }

    // Verify token with Cloudflare
    const formData = new URLSearchParams();
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
    formData.append('response', captcha_token);
    formData.append('remoteip', req.ip);

    try {
        const verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });
        const verificationData = await verificationResponse.json();

        if (!verificationData.success) {
            logger.warn(`Captcha verification failed for ${req.ip}: ${JSON.stringify(verificationData['error-codes'])}`);
            return res.status(401).json({ error: 'Unauthorized: Invalid Captcha' });
        }
    } catch (err) {
        logger.error(`Error communicating with Cloudflare API: ${err.message}`);
        return res.status(500).json({ error: 'Internal server error during verification' });
    }

    if (!question) {
        logger.info(`Request from ${req.ip} | Missing question parameter | 400`);
        return res.status(400).json({ error: 'Question is required.' });
    }

    try {
        const translationResult = await translateText(question, 'EN');
        const detectedLang = translationResult.sourceLanguage;
        const questionInEnglish = translationResult.translatedText;

        let enhancedQuestion = questionInEnglish;
        if (detectedLang !== 'EN') {
            enhancedQuestion = `${questionInEnglish} (Please provide the title and labels in ${detectedLang})`;
        }

        logger.info(`Incoming | Q: ${question} | Detected: ${detectedLang}`);

        const plan = await chatbot.answer(enhancedQuestion, history);
        logger.info(`Generated Plan: ${JSON.stringify(plan)}`);

        if (plan.sql_query) {
            const queryUpper = plan.sql_query.trim().toUpperCase();
            if (!queryUpper.startsWith('SELECT')) {
                logger.warn(`Security Warning: Blocked query not starting with SELECT from ${req.ip}. Query: ${plan.sql_query}`);
                return res.status(403).json({ error: 'Security Exception: Only SELECT queries are permitted.' });
            }
            const restrictedKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
            const restrictedPattern = new RegExp(`\\b(${restrictedKeywords.join('|')})\\b`, 'i');
            if (restrictedPattern.test(plan.sql_query)) {
                logger.warn(`Security Warning: Blocked query containing restricted keyword from ${req.ip}. Query: ${plan.sql_query}`);
                return res.status(403).json({ error: 'Security Exception: Query contains restricted keyword.' });
            }
        }

        const result = await pool.query(plan.sql_query);
        let data = result.rows;

        let finalChartType = plan.chart_type || 'table';
        let finalTitle = plan.title_suggestion || '';
        let finalAnswer = plan.one_line_answer || '';

        //  Handle single_value results
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

        //  Translate column names if needed
        if (detectedLang !== 'EN' && Array.isArray(data) && data.length > 0) {
            const keys = Object.keys(data[0]);
            const translatedKeys = await Promise.all(
                keys.map(async key => {
                    const res = await translateText(key, detectedLang, 'EN');
                    return res.translatedText;
                })
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
            oneLineAnswer: finalAnswer, //  Include this for frontend
            data,
            userLanguage: detectedLang
        });

    } catch (error) {
        res.status(500).json({ error: `Backend Error: ${error.message}` });
    }
});


//  Start Server
app.listen(port, '0.0.0.0', () => {
    logger.info(` Server running at http://localhost:${port}`);
});
