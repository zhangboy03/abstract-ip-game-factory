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
const CLAUDE_MODEL = "anthropic/claude-3.7-sonnet"; // Updated model ID

module.exports = async (req, res) => {
    // Set CORS headers for all responses
    // This will be updated later to the specific Vercel frontend URL
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // Vercel automatically parses the body for common content types like application/json
    // For other types or manual parsing, you'd read from `req` stream.
    // The existing code reads the body manually, which is fine.
    // req.url is still the path, e.g., '/api/chat' (though for Vercel, file name implies path)

    if (req.method === 'POST') { // Vercel routes POST requests to the function
        if (!OPENROUTER_API_KEY) {
            console.error('OPENROUTER_API_KEY is not set.');
            res.status(500).json({ error: 'Server configuration error: Missing API key.' });
            return;
        }

        // The original code uses req.on('data') and req.on('end') to build up the requestBody.
        // This is okay, but for Vercel, if the client sends 'Content-Type: application/json',
        // `req.body` would typically be pre-parsed.
        // However, since the original code is robust, let's adapt it minimally first.
        // If `req.body` is available from Vercel, we can simplify later.

        let requestBody = '';
        // Vercel's `req` object is a stream.Readable, so .on('data') and .on('end') work.
        req.on('data', chunk => {
            requestBody += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { conversation, imgURL, audioURL } = JSON.parse(requestBody);

                if (!conversation || !Array.isArray(conversation)) {
                    if (!imgURL && !audioURL) {
                        res.status(400).json({ error: 'Invalid request: conversation array is required or imgURL/audioURL for initial prompt.' });
                        return;
                    }
                }

                const systemPrompt = `你是一位富有创造力且技术精湛的HTML5游戏开发专家和游戏设计师。你的核心任务是与用户交流，帮助他们将一个【用户提供的抽象IP】（必须使用用户通过imgURL提供的图片，以及可选的audioURL提供的音频）融入一款经典游戏的魔改版。
                                    【重要原则】：
                                            1. 【IP中心化】：你的所有设计和建议都必须严格围绕用户提供的IP。图片（imgURL）是核心，你要充分理解其视觉特征、风格和潜在主题，并将其作为游戏的主角或核心元素。音频（audioURL）如果提供，也应紧密结合IP的行为或关键游戏事件。
                                            2. 【禁止原创IP元素】：绝不允许你为用户提供的IP添加任何非衍生的新视觉特征，或创作全新的、与用户IP无关的角色/核心元素。你的职责是利用【用户的IP】，而不是创造新的。
                                            3. 【忠于经典，IP适配，简约至上】：你的主要目标是制作一款能让人一眼认出其原型的经典游戏的"IP定制版"。
                                            4. 【核心玩法不变】：必须最大限度地保留其【核心玩法循环】和基本规则。
                                            5. 【IP化视觉】：UI界面、色彩搭配、整体视觉风格应参考用户IP图片的风格（如像素风、卡通风等）。
                                            6. 【"轻"创新】：对核心玩法的轻微修改或与IP主题相关的趣味机制，绝不能让游戏变得复杂或不可识别。
                                            7. 【简洁实现】：机制简洁，易于理解和直接上手。

                                    用户提供的图片会以URL形式包含在消息中。你应直接理解图片内容获取灵感。如图片过于抽象，应主动询问用户的IP关键特征、想表达的感觉或主题。

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
                let userMessagesProcessed = 0;
                const isLastUserMessage = (idx, arr) => arr.filter(m => m.role === 'user').length === idx + 1;

                if (conversation && conversation.length > 0) {
                    conversation.forEach((msg, index) => {
                        if (msg.role === 'user') {
                            const userMessageContent = [];
                            let originalUserText = '';

                            if (Array.isArray(msg.content)) {
                                const textBlock = msg.content.find(c => c.type === 'text');
                                if (textBlock) originalUserText = textBlock.text;
                            } else {
                                originalUserText = msg.content; 
                            }

                            if (isLastUserMessage(userMessagesProcessed, conversation) && imgURL) {
                                userMessageContent.push({
                                    type: "image_url",
                                    image_url: { url: imgURL }
                                });
                            }
                            let textForUser = originalUserText;
                            if (isLastUserMessage(userMessagesProcessed, conversation) && audioURL) {
                                textForUser += `\n[用户提供的音频链接: ${audioURL}]`;
                            }
                            userMessageContent.push({ type: "text", text: textForUser });
                            
                            messagesForAPI.push({ role: 'user', content: userMessageContent });
                            userMessagesProcessed++;
                        } else {
                            messagesForAPI.push(msg); 
                        }
                    });
                } else if (imgURL) { 
                    const initialUserContent = [];
                    initialUserContent.push({
                        type: "image_url",
                        image_url: { url: imgURL }
                    });
                    let initialText = "你好，这是我提供的素材，请根据这些素材和我聊聊游戏创意吧！";
                    if (audioURL) {
                        initialText += `\n[用户提供的音频链接: ${audioURL}]`;
                    }
                    initialUserContent.push({ type: "text", text: initialText });
                    messagesForAPI.push({ role: 'user', content: initialUserContent });
                }

                const openRouterPayload = JSON.stringify({
                    model: CLAUDE_MODEL,
                    messages: messagesForAPI,
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
                
                // Set headers for SSE response
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                // Access-Control-Allow-Origin is already set globally at the start of the function

                const apiReq = https.request(options, (apiRes) => {
                    apiRes.on('data', (chunk) => {
                        // The existing logic for processing and writing chunks to res.write() should work
                        // as `res` in Vercel is a ServerResponse compatible stream.
                        const chunkStr = chunk.toString();
                        const eventLines = chunkStr.split('\n').filter(line => line.trim() !== '');

                        for (const line of eventLines) {
                            if (line.startsWith('data: ')) {
                                const jsonData = line.substring('data: '.length);
                                if (jsonData.trim().toLowerCase() === '[done]') {
                                    res.write('data: [DONE]\n\n');
                                    // Vercel might auto-end the response when the handler finishes.
                                    // Explicitly ending might be good if apiRes can still emit 'end' or 'error'.
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
                        if (!res.writableEnded) { // Vercel might end it automatically
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
                        res.status(500).json({ error: 'Failed to connect to AI service.' });
                    }
                });

                apiReq.write(openRouterPayload);
                apiReq.end();

            } catch (error) {
                console.error('Server error in /api/chat:', error);
                if (!res.writableEnded) { // Check if response has already been sent
                    res.status(500).json({ error: 'Internal server error.', details: error.message });
                }
            }
        }); // End of req.on('end')
    } else {
        // If not POST, Vercel's routing usually handles this, but can add a 405 if needed
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