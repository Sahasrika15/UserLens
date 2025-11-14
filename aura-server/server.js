// server.js - Gemini API Proxy for Reliable Q&A
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
// Enable CORS for browser extension communication
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.json({ limit: '1mb' }));

// --- CONFIGURATION ---
// IMPORTANT: You must change your .env file to use GEMINI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';
const PORT = process.env.PORT && process.env.PORT.trim() !== '' ? Number(process.env.PORT) : 3000;

if (!GEMINI_API_KEY) {
  console.error('CRITICAL: Set GEMINI_API_KEY in your .env file to enable the chatbot.');
  process.exit(1);
}

// JSON Schema Definition to enforce the response contract (tldr, bullets, details, citations)
const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        tldr: { 
            type: "STRING", 
            description: "A short, one-sentence summary (TL;DR) of the answer." 
        },
        bullets: { 
            type: "ARRAY", 
            description: "A list of 3-5 key bullet points summarizing the main findings.", 
            items: { type: "STRING" } 
        },
        details: { 
            type: "STRING", 
            description: "A more detailed paragraph providing context and explanation." 
        },
        citations: { 
            type: "ARRAY", 
            description: "An array of citation sources used from the context. Only reference sources provided in the context blocks.", 
            items: { 
                type: "OBJECT",
                properties: {
                    heading: { type: "STRING" },
                    anchor: { type: "STRING" }
                }
            } 
        }
    },
    propertyOrdering: ["tldr", "bullets", "details", "citations"]
};


function buildContextText(sections){
  // Format the scraped page content into a clear context for the LLM
  return (sections||[]).slice(0,6).map((s,i)=>{
    const heading = s.heading||`Section ${i+1}`;
    // Limit text to 1500 chars to save tokens
    const snippet = (s.text||'').slice(0,1500).replace(/\s+/g,' ').trim();
    return `[CONTEXT_BLOCK_${i+1}]\nHEADING: ${heading}\nTEXT:\n${snippet}\nANCHOR: ${s.anchor||''}\n`;
  }).join('\n');
}

app.post('/ask', async (req, res) => {
  const { question='', sections=[], pageInfo={} } = req.body;
  const context = buildContextText(sections);

  // System instruction defines the model's role and output format.
  const systemInstruction = `You are a helpful text analysis assistant. Your task is to analyze the provided CONTEXT BLOCKS from a webpage and answer the user's QUESTION strictly based on that content. You MUST format your response as a single JSON object that conforms to the provided schema. Do not include any text outside the JSON object. The citations should reference the 'HEADING' and 'ANCHOR' of the CONTEXT BLOCKS you used.`;
  
  const userPrompt = `Page Title: ${pageInfo.title}\nPage URL: ${pageInfo.url}\n\nCONTEXT BLOCKS:\n${context}\n\nQUESTION: ${question}`;

  const payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
    }
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', response.status, errorText);
        return res.status(502).json({ 
            tldr: 'LLM Error', 
            bullets: ['API call failed.'], 
            details: `Gemini API Status ${response.status}: ${errorText.slice(0, 100)}`,
            citations: []
        });
    }

    const result = await response.json();
    const candidate = result.candidates?.[0];

    if (candidate && candidate.content?.parts?.[0]?.text) {
        let jsonText = candidate.content.parts[0].text;
        let parsedData;
        try {
            parsedData = JSON.parse(jsonText);
            // Ensure lists are arrays even if model skips elements
            parsedData.bullets = Array.isArray(parsedData.bullets) ? parsedData.bullets : [];
            parsedData.citations = Array.isArray(parsedData.citations) ? parsedData.citations : [];
        } catch (e) {
            // Handle malformed JSON response
            console.error('Failed to parse Gemini JSON response:', e, jsonText);
            parsedData = { 
                tldr: 'Parsing Error', 
                bullets: ['Could not read the LLM response. Check the server console for details.'], 
                details: jsonText.slice(0, 500), 
                citations: []
            };
        }
        return res.json(parsedData);

    } else {
        // Handle cases where candidate structure is unexpected (e.g., blocked due to safety)
        const detail = JSON.stringify(result, null, 2).slice(0, 500);
        console.warn('Unexpected Gemini response structure:', detail);
        return res.status(502).json({
            tldr: 'Model Output Failed',
            bullets: ['LLM did not return a valid answer candidate.'],
            details: detail,
            citations: []
        });
    }

  } catch (err) {
    console.error('Server error during API call', err);
    return res.status(500).json({ 
        tldr: 'Proxy Error',
        bullets: ['The proxy server encountered a network failure.'],
        details: String(err),
        citations: []
    });
  }
});

app.listen(PORT, ()=> console.log(`Gemini API proxy listening on ${PORT} — model=${MODEL_NAME}`));