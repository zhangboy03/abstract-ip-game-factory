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
}).listen(3000, () => {
    console.log('Server listening on port 3000 for /api/chat');
});
*/
// Actual implementation starts here
const http = require('http');
const https = require('https');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CLAUDE_MODEL = "anthropic/claude-3-sonnet"; // User specified model

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
        if (!OPENROUTER_API_KEY) {
            console.error('OPENROUTER_API_KEY is not set.');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server configuration error: Missing API key.' }));
            return;
        }

        let requestBody = '';
        req.on('data', chunk => {
            requestBody += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { conversation, imgURL, audioURL } = JSON.parse(requestBody);

                if (!conversation || !Array.isArray(conversation)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request: conversation array is required.' }));
                    return;
                }

                const messages = [{ "role": "system", "content": "You are an expert HTML5 game developer..." }];
                messages.push(...conversation);

                // Find the last user message to augment with imgURL and audioURL
                let lastUserMessageIndex = -1;
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].role === 'user') {
                        lastUserMessageIndex = i;
                        break;
                    }
                }

                if (lastUserMessageIndex !== -1) {
                    let userMessage = messages[lastUserMessageIndex];
                    let contentForClaude = [];

                    // Handle existing content (string or array)
                    if (Array.isArray(userMessage.content)) {
                        contentForClaude.push(...userMessage.content);
                    } else if (typeof userMessage.content === 'string') {
                        contentForClaude.push({ type: 'text', text: userMessage.content });
                    }

                    if (imgURL) {
                        const imageParts = imgURL.match(/^data:(image\/\w+);base64,(.+)$/);
                        if (imageParts && imageParts.length === 3) {
                            const imageMediaType = imageParts[1];
                            const base64ImageData = imageParts[2];
                            contentForClaude.unshift({
                                type: "image_url",
                                image_url: {
                                    url: `data:${imageMediaType};base64,${base64ImageData}`
                                }
                            });
                        } else {
                            console.warn("Invalid imgURL format received:", imgURL);
                            const textPart = contentForClaude.find(p => p.type === 'text') || { type: 'text', text: '' };
                            textPart.text += "\n[System Note: User provided an image, but its format was not recognized by the server.]";
                            if (!contentForClaude.find(p => p.type === 'text')) contentForClaude.push(textPart);
                        }
                    }

                    if (audioURL) {
                        const audioText = `\n[System Note: User also provided an audio URL: ${audioURL}. Remember to advise the user on how to integrate this using HTML5 audio capabilities, as external audio files cannot be directly embedded unless they are data URLs.]`;
                        let textPart = contentForClaude.find(p => p.type === 'text');
                        if (textPart) {
                            textPart.text += audioText;
                        } else {
                            contentForClaude.push({ type: 'text', text: audioText.trim() });
                        }
                    }
                    userMessage.content = contentForClaude.length > 0 ? contentForClaude : "";
                } else if (imgURL || audioURL) {
                     console.warn("imgURL or audioURL provided, but no user message in conversation to attach to. Client might need adjustment.");
                }


                const openRouterPayload = JSON.stringify({
                    model: CLAUDE_MODEL,
                    messages: messages,
                    stream: true
                });

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

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                });

                const apiReq = https.request(options, (apiRes) => {
                    apiRes.on('data', (chunk) => {
                        const chunkStr = chunk.toString();
                        const eventLines = chunkStr.split('\n').filter(line => line.trim() !== '');

                        for (const line of eventLines) {
                            if (line.startsWith('data: ')) {
                                const jsonData = line.substring('data: '.length);
                                if (jsonData.trim().toLowerCase() === '[done]') {
                                    res.write('data: [DONE]\n\n');
                                    return;
                                }
                                try {
                                    const eventData = JSON.parse(jsonData);
                                    if (eventData.type === 'content_block_delta' && eventData.delta && eventData.delta.type === 'text_delta' && typeof eventData.delta.text === 'string') {
                                        res.write(`data: ${JSON.stringify({ text: eventData.delta.text })}\n\n`);
                                    }
                                    else if (eventData.choices && eventData.choices[0] && eventData.choices[0].delta && typeof eventData.choices[0].delta.content === 'string') {
                                        res.write(`data: ${JSON.stringify({ text: eventData.choices[0].delta.content })}\n\n`);
                                    }
                                    else if (eventData.type === 'message_stop') {
                                        res.write('data: [DONE]\n\n');
                                        return; 
                                    }
                                } catch (e) {
                                    console.error('Error parsing OpenRouter SSE data line:', jsonData, e);
                                }
                            }
                        }
                    });
                    apiRes.on('end', () => {
                        if (!res.writableEnded) {
                            res.write('data: [DONE]\n\n');
                            res.end();
                        }
                    });
                    apiRes.on('error', (e) => {
                        console.error('Error from OpenRouter API response stream:', e);
                        if (!res.writableEnded) {
                            res.write(`data: ${JSON.stringify({ error: 'Stream error from AI service.' })}\n\n`);
                            res.write('data: [DONE]\n\n');
                            res.end();
                        }
                    });
                });

                apiReq.on('error', (e) => {
                    console.error('Error making request to OpenRouter:', e);
                    if (!res.writableEnded) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to connect to AI service.' }));
                    }
                });

                apiReq.write(openRouterPayload);
                apiReq.end();

            } catch (error) {
                console.error('Server error in /api/chat:', error);
                if (!res.writableEnded) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Internal server error.' }));
                }
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server listening on port " + PORT + " for /api/chat");
    console.log("Ensure OPENROUTER_API_KEY environment variable is set.");
    if (!OPENROUTER_API_KEY) {
        console.warn('Warning: OPENROUTER_API_KEY is not set. API calls will fail.');
    }
    console.log("Note: Client-side (public/js/chat.js) may need updates to send requests in the format { conversation, imgURL, audioURL } to this endpoint.")
}); 