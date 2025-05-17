require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
// Removed http require, not needed for Vercel serverless
const https = require('https');

// This is a placeholder for a server-side API endpoint (e.g., using Node.js, Express, or a serverless function).
// It should handle POST requests to /api/chat.

// Expected functionality:
// 1. Receives a JSON body with `prompt`, optional `image` (data URL), and optional `audio` URL.
// 2. Retrieves OPENROUTER_API_KEY from environment variables.
// 3. Constructs a request to the Claude API via OpenRouter:
//    - Includes the user's prompt.
//    - If an image is provided, it should be formatted according to Claude's multimodal capabilities.
//    - System prompt should guide Claude to act as a game design assistant and output single-file HTML games.
// 4. Streams the response from OpenRouter back to the client (frontend).
//    - The response should be Server-Sent Events (SSE) or a similar streaming mechanism.
//    - If the AI generates HTML code, this will be streamed directly.

// Example (conceptual, actual implementation depends on server environment):
/*
const http = require('http');
const https = require('https'); // For OpenRouter API call

http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { prompt, image, audio } = JSON.parse(body);
                const openRouterApiKey = process.env.OPENROUTER_API_KEY;

                // Prepare payload for OpenRouter (Claude 3.7 Sonnet)
                const messages = [
                    {
                        role: "system",
                        content: "You are an AI game designer... (full system prompt here)"
                    },
                    {
                        role: "user",
                        content: []
                    }
                ];

                const userMessageContent = [{ type: "text", text: prompt }];
                if (image) {
                    // Assuming image is a base64 data URL e.g., data:image/jpeg;base64,xxxxxx
                    const base64Image = image.split(',')[1];
                    const imageMediaType = image.substring(image.indexOf(':') + 1, image.indexOf(';'));
                    userMessageContent.unshift({
                        type: "image_url",
                        image_url: {
                           url: `data:${imageMediaType};base64,${base64Image}`
                        }
                    });
                }
                // You might also want to inform the AI about the audio URL if provided.
                // if (audio) { userMessageContent[userMessageContent.length-1].text += `\nUser also provided audio: ${audio}`}

                messages[1].content = userMessageContent;

                const openRouterPayload = JSON.stringify({
                    model: "anthropic/claude-3.5-sonnet", // Or 3.7 when available and if that's the model ID
                    messages: messages,
                    stream: true
                });

                const options = {
                    hostname: 'openrouter.ai',
                    path: '/api/v1/chat/completions',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openRouterApiKey}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(openRouterPayload)
                    }
                };

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });

                const apiReq = https.request(options, (apiRes) => {
                    apiRes.on('data', (chunk) => {
                        // Process the chunk from OpenRouter (it's SSE format itself or raw delta)
                        // For Claude, it's usually like: "event: message_delta\ndata: {\"delta\": {\"type\": \"text_delta\", \"text\": \" actual content \"}}\n\n"
                        // You need to parse this and send the relevant part (e.g., delta.text) to your client
                        // Example: extract actual text content and send it.
                        // This part requires careful parsing of the SSE from OpenRouter.
                        // For simplicity, let's assume chunk is the direct text to stream to client for now:
                        // A more robust solution would parse the SSE structure.
                        const lines = chunk.toString().split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const dataContent = line.substring(6);
                                if (dataContent === '[DONE]') {
                                    res.write(`data: [DONE]\n\n`);
                                    break;
                                }
                                try {
                                    const parsed = JSON.parse(dataContent);
                                    if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                         res.write(`data: ${JSON.stringify({text: parsed.choices[0].delta.content})}\n\n`);
                                    }
                                } catch (e) {
                                    // Potentially ignore non-JSON data lines if any
                                }
                            }
                        }
                    });
                    apiRes.on('end', () => {
                        res.end();
                    });
                });

                apiReq.on('error', (e) => {
                    console.error('Error with OpenRouter request:', e);
                    if (!res.writableEnded) {
                         res.writeHead(500);
                         res.end('Error communicating with AI service');
                    }
                });

                apiReq.write(openRouterPayload);
                apiReq.end();

            } catch (error) {
                console.error('Server error:', error);
                if (!res.writableEnded) {
                    res.writeHead(500);
                    res.end('Internal server error');
                }
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});
*/
// Actual implementation starts here
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TARGET_MODEL = "anthropic/claude-3.7-sonnet"; // Reverted to Claude model

module.exports = async (req, res) => {
    console.log('[CHAT_API_LOG] Function invoked. Method:', req.method, 'URL:', req.url);

    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        console.log('[CHAT_API_LOG] Handling OPTIONS request.');
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        console.log('[CHAT_API_LOG] Handling POST request.');
        if (!OPENROUTER_API_KEY) {
            console.error('[CHAT_API_ERROR] OPENROUTER_API_KEY is not set.');
            res.status(500).json({ error: 'Server configuration error: Missing API key.' });
            return;
        }
        console.log('[CHAT_API_LOG] OPENROUTER_API_KEY is present.');

        let requestBody = '';
        req.on('data', chunk => {
            console.log('[CHAT_API_LOG] Receiving request body chunk.');
            requestBody += chunk.toString();
        });

        req.on('end', async () => {
            console.log('[CHAT_API_LOG] Request body fully received. Body:', requestBody.substring(0, 200) + (requestBody.length > 200 ? '...' : ''));
            try {
                const { conversation, imgURLs, audioURL } = JSON.parse(requestBody);
                console.log('[CHAT_API_LOG] Request body parsed. Conversation length:', conversation ? conversation.length : 'N/A', 'imgURLs present:', !!(imgURLs && imgURLs.length > 0), 'audioURL present:', !!audioURL);

                // System prompt tailored for Claude, assuming image URL is passed in message content
                const systemPrompt = `You are a creative and technically skilled HTML5 game development expert and game designer. Your core mission is to communicate with the user to help them integrate a [user-provided abstract IP] (images will be provided as one or more URLs via the image_url field in messages, and optional audio via audioURL will also be noted in the text) into a modified version of a classic game.
                                    [IMPORTANT PRINCIPLES]:
                                            1. [IP-CENTRIC]: All your designs and suggestions must strictly revolve around the user-provided IP. The image(s) pointed to by imgURLs are central; you must fully understand their visual features, style, and potential themes, using them as the main character or core element, or deciding how to use them based on content (e.g., sprite sheet, different angles). If an audioURL is provided, it should also be closely tied to the IP's actions or key game events.
                                            2. [NO ORIGINAL IP ELEMENTS]: You are absolutely forbidden from adding any non-derivative new visual features to the user's IP, or creating entirely new characters/core elements unrelated to the user's IP. Your role is to utilize [the user's IP], not invent new ones.
                                            3. [TRUE TO CLASSIC, IP-ADAPTED, SIMPLICITY FIRST]: Your main goal is to create an "IP-customized version" of a classic game that is instantly recognizable as its prototype.
                                            4. [CORE GAMEPLAY UNCHANGED]: The core gameplay loop and basic rules must be preserved as much as possible.
                                            5. [IP-THEMED VISUALS]: The UI, color scheme, and overall visual style should reference the style of the user's IP image(s) (e.g., pixel art, cartoonish).
                                            6. ["LIGHT" INNOVATION]: Minor modifications to core gameplay or interesting mechanics related to the IP theme must not make the game complex or unrecognizable.
                                            7. [SIMPLE IMPLEMENTATION]: Mechanics should be simple, easy to understand, and immediately playable.
                                            8. [GAME GENRE] (if the user doesn't suggest one): The game genre should be inspired by the IP's characteristics, for example:
                                                - If the IP is an animal, consider runner, platformer, puzzle types.
                                                - If the IP is food, consider matching, merging, or management types.
                                                - If the IP is a vehicle, consider racing, flying, or shooting types.
                                                - If the IP is a natural element, consider simulation, management, or puzzle types.
                                            9. [REPLY LANGUAGE]: Use the same language as the user.

                                    User-provided images will be given as one or more URLs in the image_url field of a message. You should directly understand the image content for inspiration. If images are too abstract or URLs are inaccessible, you should proactively ask about the IP's key features, intended feeling/theme, or inform the user about potential image issues.

[INTERACTION FLOW]:
1. Receive imgURLs (required, at least one) and audioURL (optional).
2. Guide the user to discuss their ideas.
3. Your first proposal should be very concise, e.g.:
   "Okay, we can try making an IP-customized version of [Classic Game Name]. Your IP will be the [main character/core element], the main gameplay will stay true to the original, and the visual style will match your IP. We can generate a version based on this first."

4. Ask the user: "Would you like us to generate the game now? Or discuss the gameplay and details step-by-step? I can guide you through refinement."

5. Act based on their choice:
   a. If the user chooses [Generate Directly], or confirms generation after [Detailed Discussion] by saying "OK" or similar:
      i.  First, reply with a natural confirmation phrase, e.g., "Alright, let's generate the game!" or "Got it, preparing your game now, please wait..." This sentence will be shown directly to the user.
      ii. Then, [VERY IMPORTANT: This must be the last part of your current reply, with no other text following it], immediately output a special marker and JSON data, strictly in the following format:
          GENERATION_JSON_PAYLOAD:::{"gameRequest": "Game Type", "twist": "Game Feature", "requirements": ["Requirement 1", "Requirement 2"]}
          (Note: Please replace the example JSON descriptions with the actual game content you've designed. There must be NO spaces or newlines between GENERATION_JSON_PAYLOAD::: and the opening curly brace {.)
   b. If the user chooses [Detailed Discussion], you enter a guided refinement design phase. Continue asking questions and iterating on your design proposal until the user is satisfied and confirms generation, at which point follow steps 5.a.i and 5.a.ii above.

6. [KEY INSTRUCTION]: When the AI outputs data starting with GENERATION_JSON_PAYLOAD::: as per step 5.a.ii, the client program will automatically recognize this marker, extract the JSON for game generation, and [WILL NOT DISPLAY THE MARKER AND THE JSON ITSELF TO THE USER]. Therefore, your confirmation phrase (step 5.a.i) is the last information the user sees regarding the generation operation.

Please communicate in a friendly, encouraging, and creativity-sparking tone. Let's start the conversation!`;

                const messagesForAPI = [{ "role": "system", "content": systemPrompt }];
                
                if (conversation && conversation.length > 0) {
                    // Pass along existing conversation, imgURLs/audioURL will be added to the newest user message if applicable
                    conversation.forEach((msg, index) => {
                        if (msg.role === 'user' && index === conversation.length - 1) { // Only modify the last user message
                            const userMessageContent = [];
                            let originalUserText = '';
                            if (Array.isArray(msg.content)) { 
                                const textPart = msg.content.find(p => p.type === 'text');
                                if (textPart) originalUserText = textPart.text;
                                // Include other non-text, non-image_url parts if any, though not expected for user
                                msg.content.forEach(part => {
                                    if (part.type !== 'text' && part.type !== 'image_url') {
                                        userMessageContent.push(part);
                                    }
                                });
                            } else {
                                originalUserText = msg.content; 
                            }

                            userMessageContent.push({ type: "text", text: originalUserText });

                            if (imgURLs && imgURLs.length > 0) {
                                 console.log("[CHAT_API_LOG] Adding imgURLs to last user message content array: ", imgURLs);
                                 imgURLs.forEach(url => {
                                    if (url) {
                                        userMessageContent.push({ type: "image_url", image_url: { url: url } });
                                    }
                                 });
                            }
                            if (audioURL) {
                                const textPartToUpdate = userMessageContent.find(p => p.type ==='text');
                                if (textPartToUpdate) textPartToUpdate.text += `\n[User provided audio link: ${audioURL}]`;
                                else userMessageContent.unshift({ type: "text", text: `[User provided audio link: ${audioURL}]`});
                            }
                            messagesForAPI.push({ role: 'user', content: userMessageContent });
                        } else {
                            messagesForAPI.push(msg); // Pass through other messages as is
                        }
                    });
                } else { // This is the first turn from the user
                    const initialUserContent = [];
                    let initialText = "Hello, these are the materials I provided, please discuss game ideas with me!"; 
                    
                    initialUserContent.push({ type: "text", text: initialText });

                    if (imgURLs && imgURLs.length > 0) {
                        console.log("[CHAT_API_LOG] Adding imgURLs to initial user message content array: ", imgURLs);
                        imgURLs.forEach(url => {
                            if (url) {
                                initialUserContent.push({ type: "image_url", image_url: { url: url } });
                            }
                        });
                    }
                    if (audioURL) {
                         const textPartToUpdate = initialUserContent.find(p => p.type ==='text');
                         if (textPartToUpdate) textPartToUpdate.text += `\n[User provided audio link: ${audioURL}]`;
                         else initialUserContent.unshift({ type: "text", text: `[User provided audio link: ${audioURL}]`}); 
                    }
                    messagesForAPI.push({ role: 'user', content: initialUserContent });
                }

                console.log('[CHAT_API_LOG] Prepared messages for OpenRouter API. Total messages:', messagesForAPI.length);
                if (messagesForAPI.length > 1 && messagesForAPI[messagesForAPI.length -1 ].content) {
                    console.log('[CHAT_API_LOG] Last message content to OpenRouter (first 200 chars):', JSON.stringify(messagesForAPI[messagesForAPI.length - 1].content).substring(0,200) + '...');
                }

                const openRouterPayload = JSON.stringify({
                    model: TARGET_MODEL,
                    messages: messagesForAPI,
                    stream: true
                });
                console.log('[CHAT_API_LOG] OpenRouter payload created (first 200 chars):', openRouterPayload.substring(0,200) + (openRouterPayload.length > 200 ? '...' : ''));

                const options = {
                    hostname: 'openrouter.ai',
                    path: '/api/v1/chat/completions',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(openRouterPayload)
                    }
                };
                
                console.log('[CHAT_API_LOG] Setting SSE headers for client response.');
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                console.log('[CHAT_API_LOG] Making request to OpenRouter...');
                const apiReq = https.request(options, (apiRes) => {
                    console.log(`[CHAT_API_LOG] OpenRouter response status: ${apiRes.statusCode}`);
                    apiRes.on('data', (chunk) => {
                        const chunkStr = chunk.toString();
                        console.log('[CHAT_API_LOG] OpenRouter data chunk received:', chunkStr);
                        const eventLines = chunkStr.split('\n').filter(line => line.trim() !== '');

                        for (const line of eventLines) {
                            if (line.startsWith('data: ')) {
                                const jsonData = line.substring('data: '.length);
                                if (jsonData.trim().toLowerCase() === '[done]') {
                                    console.log('[CHAT_API_LOG] Received [DONE] from OpenRouter stream.');
                                    res.write('data: [DONE]\n\n');
                                    return; 
                                }
                                try {
                                    const eventData = JSON.parse(jsonData);
                                    if (eventData.type === 'content_block_delta' && eventData.delta && eventData.delta.type === 'text_delta' && typeof eventData.delta.text === 'string') {
                                        console.log('[CHAT_API_LOG] Streaming text delta (content_block_delta) to client.');
                                        res.write(`data: ${JSON.stringify({ text: eventData.delta.text })}\n\n`);
                                    }
                                    else if (eventData.choices && eventData.choices[0] && eventData.choices[0].delta && typeof eventData.choices[0].delta.content === 'string') {
                                        console.log('[CHAT_API_LOG] Streaming text delta (choices.delta.content) to client.');
                                        res.write(`data: ${JSON.stringify({ text: eventData.choices[0].delta.content })}\n\n`);
                                    }
                                    else if (eventData.type === 'message_stop') {
                                        console.log('[CHAT_API_LOG] Received message_stop from OpenRouter. Sending [DONE] to client.');
                                        res.write('data: [DONE]\n\n');
                                        return; 
                                    } else {
                                        console.log('[CHAT_API_LOG] Received unknown JSON data structure from OpenRouter:', jsonData);
                                    }
                                } catch (e) {
                                    console.error('[CHAT_API_ERROR] Error parsing OpenRouter SSE data line:', jsonData, 'Error:', e);
                                }
                            } else {
                                console.log('[CHAT_API_LOG] Received non-data line from OpenRouter:', line);
                            }
                        }
                    });
                    apiRes.on('end', () => {
                        console.log('[CHAT_API_LOG] OpenRouter response stream ended.');
                        if (!res.writableEnded) {
                            console.log('[CHAT_API_LOG] Client response not ended, sending final [DONE] and ending.');
                            res.write('data: [DONE]\n\n');
                            res.end();
                        } else {
                            console.log('[CHAT_API_LOG] Client response already ended.');
                        }
                    });
                    apiRes.on('error', (e) => {
                        console.error('[CHAT_API_ERROR] Error from OpenRouter API response stream:', e);
                        if (!res.writableEnded) {
                            res.write(`data: ${JSON.stringify({ error: 'Stream error from AI service.' })}\n\n`);
                            res.write('data: [DONE]\n\n');
                            res.end();
                        }
                    });
                });

                apiReq.on('error', (e) => {
                    console.error('[CHAT_API_ERROR] Error making request to OpenRouter:', e);
                    if (!res.writableEnded) {
                        console.log('[CHAT_API_LOG] Sending error to client via SSE due to OpenRouter request error.');
                        res.write(`data: ${JSON.stringify({ error: 'Failed to connect to AI service.', details: e.message })}\n\n`);
                        res.write('data: [DONE]\n\n');
                        res.end();
                    }
                });

                console.log('[CHAT_API_LOG] Writing payload to OpenRouter request and ending request stream.');
                apiReq.write(openRouterPayload);
                apiReq.end();
                console.log('[CHAT_API_LOG] OpenRouter request initiated.');

            } catch (error) {
                console.error('[CHAT_API_ERROR] Server error in /api/chat (outer try-catch):', error);
                if (!res.writableEnded) {
                    console.log('[CHAT_API_LOG] Sending error to client via SSE due to outer catch.');
                    res.write(`data: ${JSON.stringify({ error: 'Internal server error.', details: error.message })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                } else {
                     console.log('[CHAT_API_LOG] Outer catch: Response already ended.');
                }
            }
        }); // End of req.on('end')
    } else {
        console.log('[CHAT_API_LOG] Method not POST or OPTIONS. Sending 405.');
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        res.status(405).json({ error: `Method ${req.method} not allowed.` });
    }
};

// Removed server.listen() and associated console logs
// Ensure OPENROUTER_API_KEY is set in Vercel environment variables.
// The `path` for `dotenv` might need adjustment if `.env.local` isn't at `../../.env.local` relative to `app/api/chat.js` in Vercel's build.
// It's better to rely solely on Vercel's environment variable system for API keys.
// The initial require('dotenv') can be removed if API keys are only set via Vercel UI.
// For local development, you might still use dotenv, but Vercel won't use the .env.local file from your repo directly for deployed functions.

// Note: Client-side (public/js/chat.js) may need updates to send requests in the format { conversation, imgURL, audioURL } to this endpoint. 