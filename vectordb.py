import chromadb
import json
from utils import generate_id,get_schema,generate_embeddings,get_questions

class VectorDB:
    def __init__(self, path:str):
        self.db = chromadb.PersistentClient(path=path)


    def read_questions(self):
        try:
            questions= get_questions("postgres","adit1290","localhost", "argo_db")
            for question_data in questions:
                print(question_data)
                self.add_vector(data=question_data,collection_name="questions")
            return True
        except Exception as e:
            return {
                "error":str(e)
            },False

    def read_schema(self):
        try:
            schema= get_schema("postgres","adit1290","localhost", "argo_db")
            for column_data in schema:
                print(column_data)
                self.add_vector(data=column_data,collection_name="schema")
            return True
        except Exception as e:
            return {
                "error":str(e)
            },False

    def add_vector(self,data:str,collection_name:str)->str:
        try:
            collection = self.db.get_or_create_collection(name=collection_name)
            id = generate_id(data=data) + "-" + collection_name
            embeddings = generate_embeddings(data=data)
            collection.add(
                    documents=data,
                    embeddings=embeddings,
                    ids=id
                )
            return {
                "id":id,
                "data":data,
                "collection":collection_name,
                "embeddings":embeddings
            },True
        except Exception as e:
            return {
                "error":str(e)
            },False
        
    def query(self,data:str,collection_name:str,n_results:int)->list:
        try:
            embeddings = generate_embeddings(data=data)
            collection = self.db.get_collection(name=collection_name)
            return self.return_documents(
            collection.query(
                    query_embeddings=embeddings,
                    n_results=n_results
                )),True
        except Exception as e:
           return {
                "error":str(e)
            },False 

    def return_documents(self,results) -> list:
        if results is None:
            return []
        
        if "documents" in results:
            documents = results["documents"]

            if len(documents) == 1 and isinstance(documents[0], list):
                try:
                    documents = [json.loads(doc) for doc in documents[0]]
                except Exception as e:
                    return documents[0]
            return documents

    def clear_collection(self,collection_name:str):
        try:
            self.db.delete_collection(name=collection_name)
            return {
                "collection":collection_name
            },True
        except Exception as e:
            return {
                "error":str(e)
            },False 