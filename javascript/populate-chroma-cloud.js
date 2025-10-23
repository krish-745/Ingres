// populate-chroma-cloud.js
// Run this script once to populate your Chroma Cloud collections
import { VectorDB } from './vectordb.js';

async function populateChromaCloud() {
    console.log('Starting Chroma Cloud population...');
    
    const vectordb = new VectorDB();
    
    try {
        // Step 1: Clear existing collections (optional - comment out if you want to keep existing data)
        console.log('\n1. Clearing existing collections...');
        await vectordb.clear_collection('schema');
        await vectordb.clear_collection('questions');
        console.log('✓ Collections cleared');
        
        // Step 2: Populate schema collection
        console.log('\n2. Populating schema collection...');
        await vectordb.read_schema();
        console.log('✓ Schema collection populated');
        
        // Step 3: Populate questions collection
        console.log('\n3. Populating questions collection...');
        await vectordb.read_questions();
        console.log('✓ Questions collection populated');
        
        // Step 4: Test the collections
        console.log('\n4. Testing collections...');
        const schemaTest = await vectordb.query("groundwater table", "schema", 3);
        const questionsTest = await vectordb.query("how many blocks", "questions", 3);
        
        console.log('\nSchema collection test results:');
        console.log(schemaTest);
        
        console.log('\nQuestions collection test results:');
        console.log(questionsTest);
        
        console.log('\n✅ Chroma Cloud population complete!');
        
    } catch (error) {
        console.error('\n❌ Error populating Chroma Cloud:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

populateChromaCloud();