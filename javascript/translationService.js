// translationService.js
import dotenv from 'dotenv';
dotenv.config();

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'; // Use 'https://api.deepl.com/v2/translate' for pro

/**
 * Detects the language of the given text
 * @param {string} text - Text to detect language for
 * @returns {Promise<string>} - Detected language code (e.g., 'HI', 'EN')
 */
export async function detectLanguage(text) {
    try {
        const response = await fetch(DEEPL_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                text: text,
                target_lang: 'EN'
            })
        });

        const data = await response.json();
        return data.translations[0].detected_source_language;
    } catch (error) {
        console.error('Language detection error:', error);
        return 'EN'; // Default to English
    }
}

/**
 * Translates text from source language to target language
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (e.g., 'EN', 'HI', 'ES')
 * @param {string} sourceLang - Source language code (optional, auto-detect if not provided)
 * @returns {Promise<string>} - Translated text
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
            throw new Error(`DeepL API error: ${response.status}`);
        }

        const data = await response.json();
        return data.translations[0].text;
    } catch (error) {
        console.error('Translation error:', error);
        return text; // Return original text if translation fails
    }
}

/**
 * Translates chart labels and title back to user's language
 * @param {object} chartData - Chart data object with title and labels
 * @param {string} targetLang - Target language code
 * @returns {Promise<object>} - Translated chart data
 */
export async function translateChartData(chartData, targetLang) {
    if (targetLang === 'EN') {
        return chartData; // No translation needed
    }

    try {
        // Translate title
        const translatedTitle = await translateText(chartData.title, targetLang, 'EN');

        // Translate column headers if data exists
        let translatedData = chartData.data;
        if (chartData.data && chartData.data.length > 0) {
            const keys = Object.keys(chartData.data[0]);
            const translatedKeys = await Promise.all(
                keys.map(key => translateText(key, targetLang, 'EN'))
            );

            // Map old keys to new translated keys
            translatedData = chartData.data.map(row => {
                const newRow = {};
                keys.forEach((oldKey, index) => {
                    newRow[translatedKeys[index]] = row[oldKey];
                });
                return newRow;
            });
        }

        return {
            ...chartData,
            title: translatedTitle,
            data: translatedData
        };
    } catch (error) {
        console.error('Chart translation error:', error);
        return chartData; // Return original if translation fails
    }
}