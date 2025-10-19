import { cb } from "./base.js";
import { performance } from 'perf_hooks';

async function main()
{
    let cb1 = new cb();   
    const start = performance.now(); 
    await cb1.vectordb.read_questions();
    await cb1.vectordb.read_schema();
    //await cb1.answer("What was the situation in Pune's Block_2 in 2022?");
    //await cb1.answer("What was the total amount of groundwater taken out in Uttar Pradesh during 2022?")
    //await cb1.answer("Show me the top 3 places in Maharashtra that were using water most responsibly in 2023.")
    //await cb1.answer("Did the groundwater situation in Kanpur's Block_2 get worse between 2021 and 2023?")
    //await cb1.answer("Find me all the areas that are in trouble but haven't completely overused their water yet.")
    //await cb1.answer("Show me the trend of groundwater extraction for Pune's Block_1 over the years.")
    //await cb1.answer("What was the distribution of groundwater categories in Maharashtra in 2023?")
    const end = performance.now();
    console.log("Processing data took ${(end-start).toFixed(3)} milliseconds.");
}

main();