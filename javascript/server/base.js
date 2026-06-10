import { VectorDB } from './vectordb.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from './logger.js';
import { get_questions } from './utils.js';

class cb {
    constructor() {
        this.vectordb = new VectorDB();
    }

    async initialize() {
        const questionsResult = await get_questions();
        const map = new Map();
        if (questionsResult && Array.isArray(questionsResult)) {
            for (const item of questionsResult) {
                if (item.question && item.query) {
                    map.set(item.question, item.query);
                }
            }
        } else {
            logger.error("get_questions() did not return a valid array. Cannot build question map.");
        }
        this.question_map = map;
    }

    async answer(question, history = []) {
        const full_question = [...history.map(h => h.content), question].join("\n");
        const json = await this.get_sql(full_question, history);
        const obj = this.extract_json(json);
        return obj;
    }

    get_prompt(relatedSchema, relatedQuestions) {
        const question_with_query = relatedQuestions.map(questionString => {
            const sqlQuery = this.question_map.get(questionString);
            if (sqlQuery) {
                return `Question: ${questionString}\nSQL Query: ${sqlQuery}`;
            }
            logger.warn(`Question "${questionString}" found in vector DB but not in question_map.`);
            return null;
        }).filter(Boolean);
        const relatedQuestionsSection = (question_with_query && question_with_query.length > 0)
            ? `
===Contextual Examples (Use these to guide your SQL logic)====

${question_with_query.join('\n\n')}
`
            : '';

        const schemaSection = `
===Use the following schema details====

${relatedSchema.join('\n')}
`;

        return `You are an expert PostgreSQL data analyst. Your task is to act as a query and visualization planner. Based on the user's question, the provided schema, and sample questions, you must generate a JSON object. Your response MUST be a single, valid JSON object and nothing else. Do not add any text or explanations outside of the JSON structure.

The JSON object must have the following schema:
{
 "sql_query": "The generated SQL query or null in case of an error.",
 "chart_type": "The recommended chart type or 'error' in case of an error.",
 "title_suggestion": "A human-readable title for the chart or an error message.",
 "one_line_answer": "A natural language summary of the result if it is a single value, otherwise null.",
 "explanation": "A brief explanation justifying both the query and the chosen chart type."
}

===Formatting Examples (Sample Question and JSON Response pairs)====

Question: How has the groundwater refill changed over the years for Block_1 in Kanpur?
JSON Response:
{
 "sql_query": "SELECT Year AS report_year, Recharge_mcm AS groundwater_recharge_mcm FROM groundwater_assessment WHERE District = 'Kanpur' AND Block = 'Block_1' ORDER BY Year;",
 "chart_type": "line",
 "title_suggestion": "Groundwater Recharge in Kanpur (Block 1) Over Time",
 "one_line_answer": null,
 "explanation": "The query retrieves historical groundwater recharge for a specific block. A line chart is best for visualizing trends over a continuous period like years."
}

Question: What was the highest extraction percentage in 2023?
JSON Response:
{
 "sql_query": "SELECT MAX(Stage_pct) AS max_extraction_percentage FROM groundwater_assessment WHERE Year = 2023;",
 "chart_type": "single_value",
 "title_suggestion": "Peak Groundwater Extraction Percentage in 2023",
 "one_line_answer": "The highest groundwater extraction percentage recorded in 2023 was [value].",
 "explanation": "The query finds the single maximum value for a given year. A single value display is used as there is only one data point to show."
}

Question: Compare the average groundwater usage for different blocks in Pune during 2022.
JSON Response:
{
 "sql_query": "SELECT Block, AVG(Extraction_mcm) AS average_extraction FROM groundwater_assessment WHERE District = 'Pune' AND Year = 2022 GROUP BY Block;",
 "chart_type": "bar",
 "title_suggestion": "Average Groundwater Usage in Pune Blocks (2022)",
 "one_line_answer": null,
 "explanation": "The query calculates the average extraction for each block. A bar chart is ideal for comparing a numerical value across distinct categories like blocks."
}

Question: What was the distribution of groundwater categories in Maharashtra in 2023?
JSON Response:
{
 "sql_query": "SELECT Category, COUNT(*) AS number_of_blocks FROM groundwater_assessment WHERE State = 'Maharashtra' AND Year = 2023 GROUP BY Category;",
 "chart_type": "pie",
 "title_suggestion": "Distribution of Groundwater Categories in Maharashtra (2023)",
 "one_line_answer": null,
 "explanation": "The query counts the number of blocks in each category. A pie chart is used to show the proportional distribution of these categories as parts of a whole."
}
${relatedQuestionsSection}${schemaSection}

===Response Guidelines===

1. **JSON Structure**: Your entire output must be a single JSON object. Do not output raw text.
2. **\`sql_query\` Generation**:
  a. If the context is sufficient(use the chat history given above also), generate a valid PostgreSQL query.
  b. Use the 'Contextual Examples' to understand user intent and guide the logic of your SQL query.
  c. Use only the provided schema. Check for and use aliases if available.
  d. For aggregations (\`SUM\`, \`AVG\`, \`COUNT\`), provide a clear alias in snake_case (e.g., \`AS average_extraction\`).
  e. Add \`LIMIT 100\` to broad queries that don't specify a number of results (e.g., \`SELECT * ...\`), but not to aggregations.
  f. When selecting any column, you MUST provide a meaningful, human-readable alias in snake_case using the \`AS\` keyword (e.g., \`SELECT Stage_pct AS stage_percentage\`). This applies to both regular columns and aggregations.
  g. If more information is needed (e.g., to know a specific district name), generate an \`intermediate_sql\` query like \`SELECT DISTINCT District FROM groundwater_data;\`.
3. **\`chart_type\` Selection**:
  a. Analyze the query you generated and the user's question to select the best chart type.
  b. Your choice must be one of the following strings: \`'single_value'\`, \`'line'\`, \`'bar'\`, \`'pie'\`, \`'table'\`.
  c. Use \`'line'\` for time-series data (trends over a 'Year' column).
  d. Use \`'bar'\` for comparing a numerical value across different text categories (e.g., average extraction per district).
  e. Use \`'pie'\` for showing the proportion or distribution of a few categories (e.g. data grouped by 'Category').
  f. Use \`'single_value'\` for queries that return a single cell (e.g., \`MAX\`, \`MIN\`, \`COUNT(*)\`).
  g. Use \`'table'\` as the default for broad queries (\`SELECT *\`) or when no other chart is suitable.
4. **\`title_suggestion\` Generation**: Create a short, human-readable title that accurately describes the data in the chart.
5. **\`one_line_answer\` Generation**:
  a. This field MUST contain a concise, natural language sentence summarizing the result.
  b. It should ONLY be populated for \`single_value\` chart types. Use a placeholder like \`[value]\` for the actual numerical result.
  c. For ALL OTHER chart types (\`line\`, \`bar\`, \`pie\`, \`table\`), this field MUST be \`null\`.
6. **\`explanation\` Generation**: Provide a brief, one-sentence explanation that justifies both the SQL query's purpose and the reason for selecting the specific chart_type.
7. **Error Handling**: If a query cannot be generated from the context, you must return this specific JSON:
  \`{ "sql_query": null, "chart_type": "error", "title_suggestion": "Insufficient information to generate a query.", "one_line_answer": null, "explanation": null }\`


Generate the complete JSON response for the following question:`;
    }

    async get_sql(question, history = []) {
        const related_schema = await this.vectordb.query(question, "schema", this.vectordb.schema_limit);

        const related_questions = await this.vectordb.query(question, "questions", this.vectordb.questions_limit);
        const prompt = this.get_prompt(related_schema, related_questions);
        logger.info(`Generated prompt for question: ${prompt}`);
        const history_prompt = history.map(msg => ({
            role: msg.role === 'bot' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
        const contents =
            [
                { role: "user", parts: [{ text: prompt }] },
                { role: "model", parts: [{ text: "Yes, I am ready. I will follow all instructions and generate the JSON response." }] },
                ...history_prompt
            ];
        const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = client.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                temperature: 0,
            },
        });
        const chat = model.startChat({
            history: contents,
        });
        const result = await chat.sendMessage(question);
        const response = result.response;
        return response.text();
    }

    extract_json(text) {
        let processedText = text.trim();

        if (processedText.startsWith("```json")) {
            processedText = processedText.slice(7);
        }

        if (processedText.endsWith("```")) {
            processedText = processedText.slice(0, -3);
        }

        try {
            return JSON.parse(processedText);
        } catch (error) {
            logger.error(`Error decoding JSON: ${error.message}`);
            return null;
        }
    }
}

export { cb };