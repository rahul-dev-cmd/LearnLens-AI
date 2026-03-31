LearnLens AI
AI-Powered Chrome Extension for Intelligent Learning

LearnLens AI is a browser extension that uses Large Language Models to transform how users consume digital content. By generating instant summaries and interactive quizzes from YouTube videos, web articles, and PDFs, it turns passive browsing into active learning.

This project was built and submitted for the Airia AI Agent Hackathon. 

Features

Multi-Source Summarization: Instantly extract key takeaways from YouTube lectures, web articles, and uploaded PDF documents directly in the browser. 


AI Quiz Generation: Automatically creates retention-focused Q&A sets (Multiple Choice and Short Answer) from any consumed content to reinforce learning. 


High-Speed Inference: Integrated with the Groq API (Llama3-8b) for near-instant processing and structured educational insights. 


Seamless Integration: Built using Chrome Manifest V3, utilizing content scripts for deep integration with web pages. 

 Tech Stack

Language: JavaScript 


AI / LLM: Groq API (Llama3-8b-8192) 


Browser APIs: Chrome Extension API (Manifest V3) 


PDF Processing: PDF.js 


Logic: Structured Prompt Engineering for educational data extraction 

 Project Structure

manifest.json: Configuration for Chrome Manifest V3. 


content_scripts/: Scripts that interact with and extract data from web pages and YouTube. 

popup/: The user interface for the extension.

background.js: Handles API calls and long-running tasks.


scripts/pdf.js: Integration for reading and processing local/web PDF files. 

 Installation & Setup
Clone the Repository:

Bash
git clone https://github.com/rahul-dev-cmd/LearnLens-AI
cd LearnLens-AI
Load the Extension:

Open Chrome and navigate to chrome://extensions/.

Enable Developer mode (top right toggle).

Click Load unpacked and select the root folder of this project.

Configure API Key:

Open the extension popup.

Enter your Groq API Key in the settings/setup field to enable AI features. 

📝 Hackathon Submission
This project represents my first complete GitHub project with a full Git workflow. It was developed end-to-end—from ideation to final submission—for the Airia AI Agent Hackathon.
