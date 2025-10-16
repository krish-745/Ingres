import { ChromaClient } from "chromadb";
import { get_questions,generateId,generateEmbeddings,get_scehama } from './utils.js';

const myNomicEmbeddingFunction = {
    generate: async function (texts) {
        return await generateEmbeddings(texts);
    }
};

class VectorDB 
{
    constructor()
    {
        this.db = new ChromaClient();
    }

    async read_questions()
    {
        const questions = await get_questions();
        for (let i = 0; i < questions.length; i++)
        {
            console.log(questions[i]);
            await this.add_vector(`Question : ${questions[i]['question']}, Query : ${questions[i]['query']}` ,"questions");
        }
    }

    async read_schema()
    {
        const schema = await get_scehama();
        for (let i = 0; i < schema.length; i++)
        {
            console.log(schema[i]);
            await this.add_vector(schema[i],"schema");
        }
    }

    async add_vector(data,collection_name)
    {
        const collection = await this.db.getOrCreateCollection({
            name: collection_name,
            embeddingFunction: myNomicEmbeddingFunction,
        });
        await collection.add({
            documents: [data],
            ids: [generateId(data)],
        });
    }

    async query(data, collection_name, n_results)
    {
        const embeddings = generateEmbeddings(data);
        const collection = await this.db.getCollection({ name: collection_name,embeddingFunction: myNomicEmbeddingFunction });
        const results = await collection.query({
                queryTexts: [data],
                nResults: n_results,
        });
        const documents = this.return_documents(results);
        return documents;
    }

    return_documents(results) {
    if (!results || !results.documents) {
        return [];
    }

    let documents = results.documents;
    if (documents.length === 1 && Array.isArray(documents[0])) {
        return documents[0];
    }
    return documents;
}

    async clear_collection(collection_name)
    {
        try {
            await this.db.deleteCollection({ name: collection_name });
            return true;
        } catch (e) {
            return { error: e.message, success: false };
        }
    }
}

export { VectorDB };