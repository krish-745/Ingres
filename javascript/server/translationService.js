// translationService.js
import dotenv from 'dotenv';
import logger from './logger.js';
dotenv.config();

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'; // Use 'https://api.deepl.com/v2/translate' for pro

/**
 * Translates text from source language to target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (e.g., 'EN', 'HI', 'ES')
 * @param {string} sourceLang - Source language code (optional, auto-detect if not provided)
 * @returns {Promise<{translatedText: string, sourceLanguage: string, targetLanguage: string}>} - Translation result
 */
export async function translateText(text, targetLang, sourceLang = null) {
    try {
        const params = {
            text: text,
            target_lang: targetLang.toUpperCase()
        };

        if (sourceLang) {
            params.source_lang = sourceLang.toUpperCase();
        }

        const response = await fetch(DEEPL_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params)
        });

        if (!response.ok) {
            logger.error(`DeepL API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            translatedText: data.translations[0].text,
            sourceLanguage: data.translations[0].detected_source_language || sourceLang || 'EN',
            targetLanguage: targetLang.toUpperCase()
        };
    } catch (error) {
        logger.error('Translation error:', error);
        return {
            translatedText: text, // Return original text if translation fails
            sourceLanguage: sourceLang || 'EN',
            targetLanguage: targetLang.toUpperCase()
        };
    }
}