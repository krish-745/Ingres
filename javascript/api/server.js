import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import { cb as Chatbot } from '../base.js';
import { detectLanguage, translateText } from '../translationService.js';

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const chatbot = new Chatbot();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

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
  if (!question) return res.status(400).json({ error: 'Question is required.' });

  try {
    const detectedLang = await detectLanguage(question);
    let questionInEnglish = question;
    if (detectedLang !== 'EN') questionInEnglish = await translateText(question, 'EN', detectedLang);

    let enhancedQuestion = questionInEnglish;
    if (detectedLang !== 'EN') {
      const languageNames = {
        HI: 'Hindi', ES: 'Spanish', FR: 'French', DE: 'German',
        ZH: 'Chinese', JA: 'Japanese', AR: 'Arabic', PT: 'Portuguese',
        RU: 'Russian', IT: 'Italian'
      };
      const langName = languageNames[detectedLang] || detectedLang;
      enhancedQuestion = `${questionInEnglish} (Please provide the title and labels in ${langName})`;
    }

    const plan = await chatbot.answer(enhancedQuestion);
    console.log('Executing SQL:', plan.sql_query);

    const result = await pool.query(plan.sql_query);
    const data = result.rows;

    let translatedData = data;
    if (detectedLang !== 'EN' && data.length > 0) {
      const keys = Object.keys(data[0]);
      const translatedKeys = await Promise.all(keys.map(k => translateText(k, detectedLang, 'EN')));
      translatedData = data.map(row => {
        const newRow = {};
        keys.forEach((oldKey, i) => (newRow[translatedKeys[i]] = row[oldKey]));
        return newRow;
      });
    }

    res.json({
      chartType: plan.chart_type,
      title: plan.title_suggestion,
      data: translatedData,
      userLanguage: detectedLang
    });

  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'Failed to get a response from the AI.' });
  }
});

export default app;
