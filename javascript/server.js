// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import nodemailer from 'nodemailer';
import { cb as Chatbot } from './base.js';
import { detectLanguage, translateText } from './translationService.js';
import logger from './logger.js';

dotenv.config();

const { Pool } = pkg;

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const chatbot = new Chatbot();
await chatbot.initialize();

// PostgreSQL connection (Supabase / Neon)
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false },
});

// ✅ Email setup
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
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

// ✅ Main Chat Endpoint (No changes here except formatting)
app.post('/api/chat', async (req, res) => {
    const { question, history = [] } = req.body;
    if (!question) 
    {
        logger.info(`Request from ${req.ip} | Missing question paramater | Ended in 400 Bad Request.`);
        logger.info(`---------------------------------------------------------------------------------------------`);
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
        logger.info(`Request from ${req.ip} | Question: ${question} | Detected Language: ${detectedLang} | Translated Question: ${enhancedQuestion}`);
        const plan = await chatbot.answer(enhancedQuestion, history);
        logger.info(`Generated Plan: ${JSON.stringify(plan)}`);
        const result = await pool.query(plan.sql_query);
        let data = result.rows;

        if (detectedLang !== 'EN' && data.length > 0) {
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
        logger.info(`Response to ${req.ip} | Successfully processed request | Ended in 200 OK.`);
        logger.info(`---------------------------------------------------------------------------------------------`);
        res.json({
            chartType: plan.chart_type,
            title: plan.title_suggestion,
            data,
            userLanguage: detectedLang
        });

    } catch (error) {
        logger.error(`Request from ${req.ip} | Error: ${error.message} | Ended in 500 Internal Server Error.`);
        logger.info(`---------------------------------------------------------------------------------------------`);
        let msg = 'Failed to get a response from the AI.';
        res.status(500).json({ error: msg });
    }
});

// ✅ Background process checks alerts every 15 seconds
setInterval(async () => {
    try {
        const alerts = await pool.query('SELECT * FROM alerts');

        for (const alert of alerts.rows) {
            const queryResult = await pool.query(alert.condition_sql);
            const newValue = JSON.stringify(queryResult.rows);

            if (newValue !== alert.last_value) {

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: alert.user_email,
                    subject: "🔔 Your Alert Condition Was Triggered",
                    text: `Your alert condition changed.\n\nNew data:\n${newValue}`
                });

                await pool.query(
                    'UPDATE alerts SET last_value=$1 WHERE id=$2',
                    [newValue, alert.id]
                );

                console.log(`📨 Alert sent to ${alert.user_email}`);
            }
        }

    } catch (err) {
        console.error("Alert check failed:", err);
    }
}, 15000); // 15 seconds

app.post("/api/create-alert", async (req, res) => {
    const { email, sql, operator, value, message } = req.body;

    if (!email || !sql || !operator || value === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const raw_text = `${sql} ${operator} ${value}`; // optional
        await pool.query(
            `INSERT INTO alerts 
             (user_email, sql_condition, comparison_value, operator, message, raw_text)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [email, sql, value, operator, message, raw_text]
        );

        res.json({ success: true, message: "Alert created successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function checkAlerts() {
    const alerts = await pool.query("SELECT * FROM alerts");

    for (const alert of alerts.rows) {
        try {
            const result = await pool.query(alert.condition_query);
            const value = Number(result.rows[0][Object.keys(result.rows[0])[0]]);

            let conditionMet = false;
            switch (alert.operator) {
                case ">": conditionMet = value > alert.comparison_value; break;
                case "<": conditionMet = value < alert.comparison_value; break;
                case "=": conditionMet = value == alert.comparison_value; break;
                case ">=": conditionMet = value >= alert.comparison_value; break;
                case "<=": conditionMet = value <= alert.comparison_value; break;
                case "!=": conditionMet = value != alert.comparison_value; break;
            }

            if (conditionMet) {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: alert.user_email,
                    subject: "📢 Alert Triggered",
                    text: alert.message || `Alert condition met. Current value: ${value}`
                });

                await pool.query("UPDATE alerts SET last_triggered = NOW() WHERE id = $1", [alert.id]);

                console.log("✅ Alert sent to", alert.user_email);
            }

        } catch (err) {
            console.error("Error evaluating alert:", err.message);
        }
    }
}

// Run every 30 seconds
setInterval(checkAlerts, 30000);

// ✅ Start Server
app.listen(port, '0.0.0.0', () => {
    logger.info(`✅ Server running at http://localhost:${port}`);
});
