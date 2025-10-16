import { ChatBot } from "./base.js";
import { performance } from 'perf_hooks';

async function main()
{
    let cb = new ChatBot();   
    const start = performance.now(); 
    //await cb.answer("What was the situation in Pune's Block_2 in 2022?");
    //await cb.answer("What was the total amount of groundwater taken out in Uttar Pradesh during 2022?")
    //await cb.answer("Show me the top 3 places in Maharashtra that were using water most responsibly in 2023.")
    //await cb.answer("Did the groundwater situation in Kanpur's Block_2 get worse between 2021 and 2023?")
    //await cb.answer("Find me all the areas that are in trouble but haven't completely overused their water yet.")
    //await cb.answer("Show me the trend of groundwater extraction for Pune's Block_1 over the years.")
    await cb.answer("What was the distribution of groundwater categories in Maharashtra in 2023?")
    // await cb.vectordb.read_questions();
    // await cb.vectordb.read_schema();
    const end = performance.now();
    console.log(`Processing data took ${(end-start).toFixed(3)} milliseconds.`);
}

main();