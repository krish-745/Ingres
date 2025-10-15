from base import ChatBot
import time

start = time.perf_counter()
cb = ChatBot()
#cb.answer("What was the situation in Pune's Block_2 in 2022?")
#cb.answer("Tell me about the groundwater in Pune's Block_1 for 2021.")
#cb.answer("What was the total amount of groundwater taken out in Uttar Pradesh during 2022?")
#cb.answer("Show me the top 3 places in Maharashtra that were using water most responsibly in 2023.")
cb.answer("Did the groundwater situation in Kanpur's Block_2 get worse between 2021 and 2023?")
#cb.answer("Find me all the areas that are in trouble but haven't completely overused their water yet.")
#cb.answer("Show me the trend of groundwater extraction for Pune's Block_1 over the years.")
#cb.answer("What was the distribution of groundwater categories in Maharashtra in 2023?")
end = time.perf_counter()
print(f"Time taken: {end - start:.2f} seconds")


