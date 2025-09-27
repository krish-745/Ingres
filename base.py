import re
from vectordb import VectorDB
from google import genai
from utils import run_query
import matplotlib.pyplot as plt
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

class ChatBot():
    def __init__(self):
        self.vectordb = VectorDB("./chromadb")

    def answer(self,question:str):
        sql = self.get_sql(question=question)
        print(f"Generated SQL:\n{sql}")
        df = run_query(user="postgres",password="adit1290",host="localhost",db="argo_db",query=sql)
        type_ = self.classify_sql_output(sql=sql)
        if (type_== "text"):
            print(self.format_answer(question=question,rows=df.to_string(),sql=sql))
        else:
            print("Query Result:")
            print(df)
            return

    def get_prompt(self,question:str,related_schema:list, related_questions:list)->str:
        prompt = f"You are a PostgreSQL expert. Please help to generate a SQL query to answer the question. Your response should ONLY be based on the sample questions and given schema. Follow the response guidelines and format instructions."
        prompt += "\n===Sample Question and SQL pairs====\n\n"
        for q in related_questions:
            prompt += q + "\n"
        prompt += "\n===Use the following schema details====\n\n"
        for columns in related_schema:
            prompt += columns + "\n"
        prompt += (
            "\n\n===Response Guidelines===\n\n"
            "1. If the provided context is sufficient, please generate a valid SQL query without any explanations for the question. \n"
            "2. If the provided context is almost sufficient but requires knowledge of a specific string in a particular column, please generate an intermediate SQL query to find the distinct strings in that column. Prepend the query with a comment saying intermediate_sql \n"
            "3. If the provided context is insufficient, please explain why it can't be generated. \n"
            "4. Use only the columns provided in the schema, nothing else. Check for column aliases also. \n"
            "5. Please use relevant table(s).\n"
            "6. If the question has been asked and answered before, please repeat the answer exactly as it was given before. \n"
            "7. Use the sample questions given for context. If the question matches any sample question or is similar then use the correspondingn sample query."
            "8. If the question requests a large dataset (e.g., all records, list all measurements) and does not specify a number of results, add LIMIT 100 at the end of the query. \n"
            "9. If the query is an aggregation (COUNT, AVG, SUM, MIN, MAX, GROUP BY), DO NOT add a LIMIT clause unless the user explicitly asks for it. \n"
            "10. If the user explicitly specifies a number of rows (e.g., show me 50 results), respect that and ignore the default LIMIT rule. \n"
            f"11. Ensure that the output SQL is executable, and free of syntax errors. \n"
        )
        prompt += f"\n\nGenerate SQL Query for the following question : {question}"
        return prompt

    def classify_sql_output(self,sql: str) -> str:
        sql = sql.lower()
        if any(func in sql for func in ["avg(", "max(", "min(", "count(", "sum("]):
            if "group by" not in sql:
                return "text"

        if "group by date(" in sql or "group by time" in sql:
            return "chart:line"

        if "group by" in sql:
            if any(cat in sql for cat in ["platform_number", "data_center", "project_name", "wmo_inst_type"]):
                if "count(" in sql:
                    return "chart:pie"
                return "chart:bar"
        return "table"

    def extract_sql_from_text(self,text:str)->str:
        sqls = re.findall(r"\bCREATE\s+TABLE\b.*?\bAS\b.*?;", text, re.DOTALL | re.IGNORECASE)
        if sqls:
            sql = sqls[-1]
            return sql
        sqls = re.findall(r"\bWITH\b .*?;", text, re.DOTALL | re.IGNORECASE)
        if sqls:
            sql = sqls[-1]
            return sql
        sqls = re.findall(r"\bSELECT\b .*?;", text, re.DOTALL | re.IGNORECASE)
        if sqls:
            sql = sqls[-1]
            return sql
        sqls = re.findall(r"```sql\s*\n(.*?)```", text, re.DOTALL | re.IGNORECASE)
        if sqls:
            sql = sqls[-1].strip()
            return sql
        sqls = re.findall(r"```(.*?)```", text, re.DOTALL | re.IGNORECASE)
        if sqls:
            sql = sqls[-1].strip()
            return sql
        return text
    
    def get_sql(self,question:str):
        related_schema = self.vectordb.query(data=question,collection_name="schema",n_results=10)[0]
        related_questions = self.vectordb.query(data=question,collection_name="questions",n_results=10)[0]
        prompt = self.get_prompt(question=question,related_schema=related_schema,related_questions=related_questions)
        client = genai.Client(api_key="AIzaSyAlsL-bFLcLk87bVrdwSBIk3G4aCtawdlo")
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config={
                "temperature":0 
            }
        )
        return self.extract_sql_from_text(response.text)
    
    def format_answer(self,question:str,rows:list,sql:str)->str:
        if not rows:
            return "No results found."
        db_results = "Here are the results:\n"
        for row in rows:
            db_results += str(row) + "\n"
        prompt = f"""
You are a helpful assistant that converts SQL query results into clear natural language answers.

Inputs:
- User question: {question}
- SQL query executed: {sql}
- SQL result: {db_results}

Rules:
1. If the SQL result is empty → respond "No data is available for your query." Never make up your own data.
2. If single numeric value, give a concise sentence.
3. If multiple columns, summarize and explain columns in plain English.
4. If the SQL query includes conditions or assumptions not explicitly asked in the user’s question (e.g., restricting to surface pressure pres < 10 when the question just asked “temperature”), explicitly mention this in the answer:
“Note: The query assumed surface-level measurements (pressure < 10 dbar), even though this was not explicitly requested.”
"""

        client = genai.Client(api_key="AIzaSyAlsL-bFLcLk87bVrdwSBIk3G4aCtawdlo")
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config={
                "temperature":0 
            }
        )
        return response.text


