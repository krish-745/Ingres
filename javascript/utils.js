import { Pool, Client } from "pg";
import crypto from 'crypto';
import { v5 as uuidv5 } from 'uuid';

async function run_query(pool, query)
{
    let client;
    try
    {
        client = await pool.connect();
        const res = await client.query(query);
        return res.rows;
    }
    catch(err)
    {
        console.error(err);
    }
    finally
    {
        if(client) client.release();
    }
}

async function get_questions()
{
    const conn = {
        user: 'postgres',
        host: 'localhost',
        database: 'ingres',
        password: 'adit1290',
        port: 5432,
    };
    const pool = new Pool(conn);
    const questions = await run_query(pool, 'select question, query from ingres_sample_questions;');
    return questions;
}

async function get_scehama()
{
    const conn = {
        user: 'postgres',
        host: 'localhost',
        database: 'ingres',
        password: 'adit1290',
        port: 5432,
    };
    const pool = new Pool(conn);
    const rows = await run_query(pool, 'select table_name, column_name, datatype, alts  from ingres_schema;');
    let schema = [];
    for (let i = 0; i < rows.length; i++)
    {
        schema.push(`Table Name : ${rows[i]['table_name']}, Column Name : ${rows[i]['column_name']}, Column Datatype : ${rows[i]['datatype']}, Column Alias : ${rows[i]['alts']}`);
    }
    return schema;
}

function generateId(data) {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    const dataId = uuidv5(hash, NIL_UUID);
    return dataId;
}

async function generateEmbeddings(texts) { // This function receives an array of texts
    const url = "https://api-atlas.nomic.ai/v1/embedding/text";
    const textsArray = Array.isArray(texts) ? texts : [texts];
    const validTexts = textsArray.filter(text => typeof text === 'string' && text.trim() !== '');
    const payload = {
        texts: validTexts, // Use the cleaned array
        task_type: "search_document",
        dimensionality: 768
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer nk-PuRVLR5fvvNzVTeIYcfhKCKaPlYq1U4Msfbxrb2DLAg'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("API Error Body:", errorBody);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.embeddings;

    } catch (error) {
        console.error("Failed to generate embeddings:", error);
        throw error;
    }
}

export { get_questions, generateId, generateEmbeddings ,get_scehama};