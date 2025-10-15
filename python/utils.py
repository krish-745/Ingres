import hashlib
import uuid
from typing import Union
import requests
import json
import psycopg2
import pandas as pd

def run_query(user:str, password:str, host:str, db:str, query:str)->pd.DataFrame:
    conn = psycopg2.connect(
        host=host,
        database=db,
        user=user,
        password=password)
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def get_questions(user:str, password:str, host:str, db:str)->list:
    conn = psycopg2.connect(
        host=host,
        database=db,
        user=user,
        password=password)
    cur = conn.cursor()
    cur.execute("""
        select question, query from ingres_sample_questions
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    sql_query = []
    for question, answer in rows:
        sql_query.append(f"Question : {question}, Query : {answer}")
    return sql_query

def get_schema(user:str, password:str, host:str, db:str)->list:
    conn = psycopg2.connect(
        host=host,
        database=db,
        user=user,
        password=password)
    cur = conn.cursor()
    cur.execute("""
        select table_name, column_name, datatype, alts  from ingres_schema
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    schema = []
    for table, column, datatype, alt in rows:
        if alt:
            schema.append(f"Table Name : {table}, Column Name : {column}, Column Datatype : {datatype}, Column Alias : {alt}")
        else:
            schema.append(f"Table Name : {table}, Column Name : {column}, Column Datatype : {datatype}")
    return schema

def generate_id(data: Union[str,bytes]) -> str:
    
    if isinstance(data, str):
        content_bytes = data.encode("utf-8")
    elif isinstance(data, bytes):
        content_bytes = data

    hash = hashlib.sha256(content_bytes)
    hash_hex = hash.hexdigest()
    data_id = str(uuid.uuid5(uuid.UUID("00000000-0000-0000-0000-000000000000"), hash_hex))
    return data_id

def generate_embeddings(data:str):
    url = "https://api-atlas.nomic.ai/v1/embedding/text"
    payload = json.dumps({
        "texts": [
           data
        ],
        "task_type": "search_document",
        "max_tokens_per_text": 8192,
        "dimensionality": 768
    })
    headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer nk-PuRVLR5fvvNzVTeIYcfhKCKaPlYq1U4Msfbxrb2DLAg'
    }
    response = requests.request("POST", url, headers=headers, data=payload)
    return json.loads(response.text)["embeddings"]