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
                const { conversation, imgURL, audioURL } = JSON.parse(requestBody);
                console.log('[CHAT_API_LOG] Request body parsed. Conversation length:', conversation ? conversation.length : 'N/A', 'imgURL present:', !!imgURL, 'audioURL present:', !!audioURL);

                // System prompt tailored for Claude, assuming image URL is passed in message content
                const systemPrompt = `你是一位富有创造力且技术精湛的HTML5游戏开发专家和游戏设计师。你的核心任务是与用户交流，帮助他们将一个【用户提供的抽象IP】（图片会以URL的形式通过消息中的 image_url 字段提供，可选的audioURL提供的音频也会在文本中注明）融入一款经典游戏的魔改版。
                                    【重要原则】：
                                            1. 【IP中心化】：你的所有设计和建议都必须严格围绕用户提供的IP。图片URL (imgURL) 指向的图片是核心，你要充分理解其视觉特征、风格和潜在主题，并将其作为游戏的主角或核心元素。音频（audioURL）如果提供，也应紧密结合IP的行为或关键游戏事件。
                                            2. 【禁止原创IP元素】：绝不允许你为用户提供的IP添加任何非衍生的新视觉特征，或创作全新的、与用户IP无关的角色/核心元素。你的职责是利用【用户的IP】，而不是创造新的。
                                            3. 【忠于经典，IP适配，简约至上】：你的主要目标是制作一款能让人一眼认出其原型的经典游戏的"IP定制版"。
                                            4. 【核心玩法不变】：必须最大限度地保留其【核心玩法循环】和基本规则。
                                            5. 【IP化视觉】：UI界面、色彩搭配、整体视觉风格应参考用户IP图片的风格（如像素风、卡通风等）。
                                            6. 【"轻"创新】：对核心玩法的轻微修改或与IP主题相关的趣味机制，绝不能让游戏变得复杂或不可识别。
                                            7. 【简洁实现】：机制简洁，易于理解和直接上手。

                                    用户提供的图片会以URL形式通过消息中的 image_url 字段提供。你应直接理解图片内容获取灵感。如图片过于抽象，或URL无法访问，应主动询问用户的IP关键特征、想表达的感觉或主题，或提示用户图片可能有问题。

【交互流程】：
1. 接收imgURL（必须）和audioURL（可选）。
2. 引导用户聊想法。
3. 第一次方案应非常简洁，例如：
   "好的，我们可以尝试制作一款IP定制版的【经典游戏名称】。您的IP将作为【主角/核心元素】，主要玩法保持原汁原味，视觉风格贴合您的IP。我们可以先基于此生成一个版本。"

4. 提问用户："您希望我们现在就生成游戏？还是一步步讨论玩法和细节？我可以引导您细化。"

5. 根据选择行动：
   a. 如果用户选择【直接生成】，或者【详细讨论】后用户表示"OK"或类似意愿确认生成：
      i.  首先，回复一句自然的确认话语，例如："好的，我们来生成游戏吧！"或者"明白了，正在为您准备游戏，请稍候..." 这句话会直接显示给用户。
      ii. 然后，【非常重要：这必须是你当前回复的最后一部分，不要有任何其他文字跟在后面】，紧接着输出一个特殊标记和JSON数据，严格按照以下格式：
          GENERATION_JSON_PAYLOAD:::{"gameRequest": "游戏类型", "twist": "游戏特性", "requirements": ["要求1", "要求2"]}
          (注意：请将示例JSON中的描述替换为实际构思好的游戏内容。GENERATION_JSON_PAYLOAD::: 和左花括号 { 之间绝不能有任何空格或换行。)
   b. 如果用户选择【详细讨论】，你则进入引导式细化设计阶段。继续提问并迭代你的设计方案，直到用户表示满意并确认生成，届时再遵循上面的5.a.i和5.a.ii步骤。

6. 【关键指令】：当AI按上述步骤5.a.ii的格式输出以 GENERATION_JSON_PAYLOAD::: 开头的数据时，客户端程序会自动识别这个标记，提取JSON用于游戏生成，并且【不会向用户显示这个标记和它后面的JSON本身】。所以，你的确认话语（第5.a.i步）就是用户看到的关于生成操作的最后信息。

请以友好、鼓励和激发创意的语气与用户交流。现在开始对话吧！`;

                const messagesForAPI = [{ "role": "system", "content": systemPrompt }];
                
                if (conversation && conversation.length > 0) {
                    // Pass along existing conversation, imgURL/audioURL will be added to the newest user message if applicable
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

                            if (imgURL) {
                                 console.log("[CHAT_API_LOG] Adding imgURL to last user message content array: ", imgURL);
                                 userMessageContent.push({ type: "image_url", image_url: { url: imgURL } });
                            }
                            if (audioURL) {
                                const textPartToUpdate = userMessageContent.find(p => p.type ==='text');
                                if (textPartToUpdate) textPartToUpdate.text += `\n[用户提供的音频链接: ${audioURL}]`;
                                else userMessageContent.unshift({ type: "text", text: `[用户提供的音频链接: ${audioURL}]`});
                            }
                            messagesForAPI.push({ role: 'user', content: userMessageContent });
                        } else {
                            messagesForAPI.push(msg); // Pass through other messages as is
                        }
                    });
                } else { // This is the first turn from the user
                    const initialUserContent = [];
                    let initialText = "你好，这是我提供的素材，请根据这些素材和我聊聊游戏创意吧！"; 
                    
                    initialUserContent.push({ type: "text", text: initialText });

                    if (imgURL) {
                        console.log("[CHAT_API_LOG] Adding imgURL to initial user message content array: ", imgURL);
                        initialUserContent.push({ type: "image_url", image_url: { url: imgURL } });
                    }
                    if (audioURL) {
                         const textPartToUpdate = initialUserContent.find(p => p.type ==='text');
                         if (textPartToUpdate) textPartToUpdate.text += `\n[用户提供的音频链接: ${audioURL}]`;
                         else initialUserContent.unshift({ type: "text", text: `[用户提供的音频链接: ${audioURL}]`}); 
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