from vectordb import VectorDB
from google import genai
from utils import run_query
import pandas as pd
import warnings
warnings.filterwarnings("ignore")
import json

class ChatBot():
    def __init__(self):
        self.vectordb = VectorDB("./chromadb")

    def answer(self,question:str):
        json = self.get_sql(question=question)
        obj = self.extract_json(json)
        print(json)
        sql = obj["sql_query"]
        print(f"Generated SQL:\n{sql}")
        df = run_query(user="postgres",password="adit1290",host="localhost",db="ingres",query=sql)
        print("Query Result:")
        print(df)
        return
            

    def get_prompt(self, question: str, related_schema: list, related_questions: list) -> str:
        """
        Generates a prompt that instructs the LLM to return a structured JSON object
        containing the SQL query, a suggested chart type, a title, a one-line answer,
        and a detailed explanation.
        """
        prompt = (
            "You are an expert PostgreSQL data analyst. Your task is to act as a query and visualization planner. "
            "Based on the user's question, the provided schema, and sample questions, you must generate a JSON object. "
            "Your response MUST be a single, valid JSON object and nothing else. Do not add any text or explanations outside of the JSON structure.\n\n"
            "The JSON object must have the following schema:\n"
            "{\n"
            '  "sql_query": "The generated SQL query or null in case of an error.",\n'
            '  "chart_type": "The recommended chart type or \'error\' in case of an error.",\n'
            '  "title_suggestion": "A human-readable title for the chart or an error message.",\n'
            '  "one_line_answer": "A natural language summary of the result if it is a single value, otherwise null.",\n'
            '  "explanation": "A brief explanation justifying both the query and the chosen chart type."\n'
            "}\n"
        )
        
        prompt += "\n===Formatting Examples (Sample Question and JSON Response pairs)====\n\n"
        prompt += ("Question: How has the groundwater refill changed over the years for Block_1 in Kanpur?\n"
                "JSON Response:\n"
                '{\n'
                '  "sql_query": "SELECT Year AS report_year, Recharge_mcm AS groundwater_recharge_mcm FROM groundwater_data WHERE District = \'Kanpur\' AND Block = \'Block_1\' ORDER BY Year;",\n'
                '  "chart_type": "line",\n'
                '  "title_suggestion": "Groundwater Recharge in Kanpur (Block 1) Over Time",\n'
                '  "one_line_answer": null,\n'
                '  "explanation": "The query retrieves historical groundwater recharge for a specific block. A line chart is best for visualizing trends over a continuous period like years."\n'
                '}\n\n')
        
        prompt += ("Question: What was the highest extraction percentage in 2023?\n"
                "JSON Response:\n"
                '{\n'
                '  "sql_query": "SELECT MAX(Stage_pct) AS max_extraction_percentage FROM groundwater_data WHERE Year = 2023;",\n'
                '  "chart_type": "single_value",\n'
                '  "title_suggestion": "Peak Groundwater Extraction Percentage in 2023",\n'
                '  "one_line_answer": "The highest groundwater extraction percentage recorded in 2023 was [value].",\n'
                '  "explanation": "The query finds the single maximum value for a given year. A single value display is used as there is only one data point to show."\n'
                '}\n\n')

        prompt += ("Question: Compare the average groundwater usage for different blocks in Pune during 2022.\n"
                "JSON Response:\n"
                '{\n'
                '  "sql_query": "SELECT Block, AVG(Extraction_mcm) AS average_extraction FROM groundwater_data WHERE District = \'Pune\' AND Year = 2022 GROUP BY Block;",\n'
                '  "chart_type": "bar",\n'
                '  "title_suggestion": "Average Groundwater Usage in Pune Blocks (2022)",\n'
                '  "one_line_answer": null,\n'
                '  "explanation": "The query calculates the average extraction for each block. A bar chart is ideal for comparing a numerical value across distinct categories like blocks."\n'
                '}\n\n')

        prompt += ("Question: What was the distribution of groundwater categories in Maharashtra in 2023?\n"
                "JSON Response:\n"
                '{\n'
                '  "sql_query": "SELECT Category, COUNT(*) AS number_of_blocks FROM groundwater_data WHERE State = \'Maharashtra\' AND Year = 2023 GROUP BY Category;",\n'
                '  "chart_type": "pie",\n'
                '  "title_suggestion": "Distribution of Groundwater Categories in Maharashtra (2023)",\n'
                '  "one_line_answer": null,\n'
                '  "explanation": "The query counts the number of blocks in each category. A pie chart is used to show the proportional distribution of these categories as parts of a whole."\n'
                '}\n\n')

        if related_questions:
            prompt += "\n===Contextual Examples (Use these to guide your SQL logic)====\n\n"
            for q_pair in related_questions:
                prompt += q_pair + "\n"

        prompt += "\n===Use the following schema details====\n\n"
        for column_info in related_schema:
            prompt += column_info + "\n"
            
        prompt += (
            "\n\n===Response Guidelines===\n\n"
            "1.  **JSON Structure**: Your entire output must be a single JSON object. Do not output raw text.\n"
            "2.  **`sql_query` Generation**:\n"
            "    a. If the context is sufficient, generate a valid PostgreSQL query.\n"
            "    b. Use the 'Contextual Examples' to understand user intent and guide the logic of your SQL query.\n"
            "    c. Use only the provided schema. Check for and use aliases if available.\n"
            "    d. For aggregations (`SUM`, `AVG`, `COUNT`), provide a clear alias in snake_case (e.g., `AS average_extraction`).\n"
            "    e. Add `LIMIT 100` to broad queries that don't specify a number of results (e.g., `SELECT * ...`), but not to aggregations.\n"
            "    f. If more information is needed (e.g., to know a specific district name), generate an `intermediate_sql` query like `SELECT DISTINCT District FROM groundwater_data;`.\n"
            "3.  **`chart_type` Selection**:\n"
            "    a. Analyze the query you generated and the user's question to select the best chart type.\n"
            "    b. Your choice must be one of the following strings: `'single_value'`, `'line'`, `'bar'`, `'pie'`, `'table'`.\n"
            "    c. Use `'line'` for time-series data (trends over a 'Year' column).\n"
            "    d. Use `'bar'` for comparing a numerical value across different text categories (e.g., average extraction per district).\n"
            "    e. Use `'pie'` for showing the proportion or distribution of a few categories (e.g. data grouped by 'Category').\n"
            "    f. Use `'single_value'` for queries that return a single cell (e.g., `MAX`, `MIN`, `COUNT(*)`).\n"
            "    g. Use `'table'` as the default for broad queries (`SELECT *`) or when no other chart is suitable.\n"
            "4.  **`title_suggestion` Generation**: Create a short, human-readable title that accurately describes the data in the chart.\n"
            "5.  **`one_line_answer` Generation**:\n"
            "    a. This field MUST contain a concise, natural language sentence summarizing the result.\n"
            "    b. It should ONLY be populated for `single_value` chart types. Use a placeholder like `[value]` for the actual numerical result.\n"
            "    c. For ALL OTHER chart types (`line`, `bar`, `pie`, `table`), this field MUST be `null`.\n"
            "6.  **`explanation` Generation**: Provide a brief, one-sentence explanation that justifies both the SQL query's purpose and the reason for selecting the specific chart_type.\n"
            "7.  **Error Handling**: If a query cannot be generated from the context, you must return this specific JSON:\n"
            '    `{ "sql_query": null, "chart_type": "error", "title_suggestion": "Insufficient information to generate a query.", "one_line_answer": null, "explanation": null }`\n'
        )

        prompt += f"\n\nGenerate the complete JSON response for the following question: {question}"
        return prompt


    
    def get_sql(self,question:str):
        related_schema = self.vectordb.query(data=question,collection_name="schema",n_results=10)[0]
        related_questions = self.vectordb.query(data=question,collection_name="questions",n_results=10)[0]
        prompt = self.get_prompt(question=question,related_schema=related_schema,related_questions=related_questions)
        client = genai.Client(api_key="APIKEY")
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config={
                "temperature":0 
            }
        )
        return response.text
    
    def extract_json(self,text:str)->dict:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]  
        if text.endswith("```"):
            text = text[:-3]

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON: {e}")



