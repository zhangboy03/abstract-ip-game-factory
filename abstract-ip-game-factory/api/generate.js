require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const https = require('https'); // Added https for OpenRouter API calls

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Consider Haiku for faster/cheaper generation if complexity allows, or Sonnet for more complex games.
const TARGET_MODEL_FOR_GENERATION = "anthropic/claude-3.7-sonnet"; // Reverted to Claude model

module.exports = async (req, res) => {
    console.log('[GEN_API_LOG] /api/generate function invoked. Method:', req.method);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*'); // To be restricted later
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        console.log('[GEN_API_LOG] Handling OPTIONS request.');
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        console.log('[GEN_API_LOG] Handling POST request.');
        if (!OPENROUTER_API_KEY) {
            console.error('[GEN_API_ERROR] OPENROUTER_API_KEY is not set.');
            res.status(500).json({ error: 'Server configuration error: Missing API key.' });
            return;
        }
        console.log('[GEN_API_LOG] OPENROUTER_API_KEY is present.');

        // Vercel typically parses JSON request bodies automatically into req.body
        // If not, the manual parsing method below is a fallback.
        let requestBodyString = '';
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            console.log('[GEN_API_LOG] Vercel pre-parsed req.body.');
            try {
                requestBodyString = JSON.stringify(req.body);
            } catch (e) {
                console.error('[GEN_API_ERROR] Error stringifying pre-parsed req.body:', e);
                res.status(400).json({ error: 'Malformed request body.' });
                return;
            }
        } else {
            console.log('[GEN_API_LOG] Accumulating request body manually.');
            try {
                for await (const chunk of req) {
                    requestBodyString += chunk.toString();
                }
            } catch (streamError) {
                console.error("[GEN_API_ERROR] Error reading request stream:", streamError);
                res.status(500).json({ error: 'Error reading request data.' });
                return;
            }
        }
        
        console.log('[GEN_API_LOG] /api/generate received requestBody string (first 500 chars):', requestBodyString.substring(0, 500) + (requestBodyString.length > 500 ? '...' : ''));

        try {
            const parsedBody = JSON.parse(requestBodyString);
            console.log('[GEN_API_LOG] /api/generate parsedBody successfully.');

            const { gameRequest, twist, imgURLs, audioURL, requirements } = parsedBody;

            console.log('[GEN_API_LOG] Extracted parameters: gameRequest:', gameRequest, ', twist:', twist, ', imgURLs count:', imgURLs ? imgURLs.length : 0, ', audioURL present:', !!audioURL, ', requirements:', requirements);

            if (!gameRequest || !twist) {
                console.error('[GEN_API_ERROR] /api/generate: Missing gameRequest or twist.');
                res.status(400).json({ error: 'Invalid request: gameRequest and twist are required.' });
                return;
            }

            let characterSpriteInstruction = "";
            if (imgURLs && imgURLs.length > 0) {
                const primaryImgURL = imgURLs[0];
                let additionalImagesInstruction = "";
                if (imgURLs.length > 1) {
                    additionalImagesInstruction = ` The following additional image URLs are also provided: ${imgURLs.slice(1).join(", ")}. You may use these additional images creatively for other game elements (e.g., secondary characters, items, background details, or alternative sprites/animations for the main character if contextually appropriate and simple to implement) but the primary focus is the first image.`;
                }
                characterSpriteInstruction = `-   【Main Character/Element MANDATE】: The primary visual element of the game, especially the player-controlled character or the central interactive piece, MUST be created primarily using the image specified by the first imgURL: ${primaryImgURL}. Do NOT use placeholder graphics, generic shapes, or AI-generated new visuals for this core IP element. Its appearance in the game is of utmost importance.\n-   【User Images are SACROSANCT】: The game design MUST NOT instruct the player to imagine features or elements of the IP that are not visible in the provided images. The game mechanics should rely on the visual information present in those images.${additionalImagesInstruction}`;
            } else {
                characterSpriteInstruction = "-   If no imgURLs are provided: Use a simple, clearly identifiable placeholder like a colored rectangle for the player, and state this was done due to a missing image URL.";
            }

            let soundInstruction = "";
            if (audioURL) {
                soundInstruction = `-   【Audio Integration MANDATE】: If an audioURL (${audioURL}) is provided, it MUST be used for significant game events or character actions as described in the requirements. If no specific instruction for audio is in the requirements, use it for a primary positive feedback sound (e.g., scoring, item collection). Do not use generic or stock sound effects if a user audioURL is available.`;
            } else {
                soundInstruction = "-   If audioURL is not provided: It is acceptable to have no sound or use very minimal, generic HTML5 tone generations for basic feedback if absolutely necessary, but prioritize silence over unfitting stock sounds.";
            }

            let dynamicRequirementsString = "";
            if (requirements && Array.isArray(requirements) && requirements.length > 0) {
                dynamicRequirementsString = requirements.map(req => `- ${req}`).join('\n');
            }

            const gamePrompt = `You are an expert HTML5 game developer. Your task is to generate a complete, single-file, playable HTML5 game.\\nVERY IMPORTANT: Prioritize speed of generation. Aim to produce a functional, simple version of the game described below as quickly as possible, ideally within 30-45 seconds of processing time. Keep the code concise and avoid overly complex features for this first version.\\n\\nThe game MUST be self-contained in a single HTML file, including all HTML, CSS, and JavaScript. Do not use any external libraries or assets unless explicitly instructed.\\nThe total size of the generated HTML file should ideally be under 200KB.\\n\\nGame Concept:\\n1.  Classic Game to Adapt: \\\"${gameRequest}\\\"\\n2.  Interesting Twist: \\\"${twist}\\\"\\n\\nAsset Integration - CRITICAL INSTRUCTIONS:\\n${characterSpriteInstruction}\\n${soundInstruction}\\n\\nImportant Instructions for Asset URLs (Reiteration):\\n- You MUST use the exact URLs provided for the character sprite(s) (imgURLs, if used in above instructions) and sound effect (audioURL, if used in above instructions). The primary image URL for the main character/element is ${imgURLs && imgURLs.length > 0 ? imgURLs[0] : 'N/A'}. If multiple images are provided in imgURLs, use them as guided by the \"Main Character/Element MANDATE\".\\n- Do NOT derive paths, guess filenames, or assume assets are hosted elsewhere.\\n- If asset URLs are provided, use them directly. If not provided, use a placeholder (as per critical instructions above).\\n\\nSpecific Gameplay Requirements from User Discussion:\\n${dynamicRequirementsString ? dynamicRequirementsString + "\\n\\n" : " (None specified beyond the general concept)\\n\\n"}General Gameplay Requirements (ensure these are also met):\\n-   【Prioritize Classic Core】：The game MUST primarily implement the standard rules and core gameplay loop of the requested classic game: \\\"${gameRequest}\\\". This is the absolute priority.\\n-   【Integrate IP Visually】：All visual styling (CSS, colors, fonts if applicable, UI elements like score display, buttons) MUST take significant inspiration from the style, colors, and theme of the user\\'s IP image(s) (if imgURLs provided, primarily the first image). For example, if the IP is pixel art, the game UI should also be pixelated or use a retro theme. If the IP is cartoonish, the UI should be clean and use a similar color palette. The goal is an IP-themed version of the classic game.\\n-   【Implement Twist Simply】：Any \\\"Twist\\\" described (\\\"${twist}\\\") MUST be implemented as a simple, secondary layer or a light modification to the core classic mechanics. It should not fundamentally change or overshadow the classic game. If the twist is complex, implement only its simplest, most direct interpretation that fits the IP.\\n-   【Keep JavaScript Logic Clear】：The JavaScript code should be straightforward, focusing on the core classic mechanics and the simple twist. Avoid overly complex state management or unnecessary features not directly contributing to this IP-adapted classic gameplay.\\n-   The game must be playable and have clear win/lose conditions or scoring, consistent with the classic game being adapted.\\n-   Include basic instructions on how to play within the game\\'s HTML (perhaps as a small overlay that can be dismissed, or on the game page itself), or make it extremely intuitive based on the classic game.\\n-   Ensure the game is responsive or at least usable on common screen sizes.\\n\\nIn-Game Action for Manual Screenshot (Optional Feature):\\n-   Consider adding a visible button (e.g., with text \\\"Pause for Screenshot\\\") or a designated key press (e.g., the \\'P\\' key) that clearly PAUSES the game (stops all animations, player movement, timers, etc.).\\n-   When this pause action is triggered, ABSOLUTELY NO TEXT or messages (like \\\"Game Paused\\\") should be displayed over the core gameplay area. The game screen should be perfectly clear and representative of the gameplay at the moment of pausing, allowing the user to take an unobstructed screenshot. The pause state should be visually obvious through the cessation of all game activity.\\n-   This feature is solely to help the user take a manual screenshot. The button/key press should NOT send any \\\`postMessage\\\` to the parent window.\\n\\nOutput Format:\\nRespond ONLY with the raw HTML code for the game. Do not include any other text, explanations, or markdown formatting before or after the HTML code block.\\nThe response should start with <!DOCTYPE html> and end with </html>.`;

            console.log('[GEN_API_LOG] Constructed gamePrompt (first 500 chars):', gamePrompt.substring(0,500) + (gamePrompt.length > 500 ? '...' : ''));

            const messages = [
                { "role": "system", "content": "You are an expert HTML5 game developer. Your sole purpose is to generate a single HTML file containing a complete game based on the user's request. Output ONLY the HTML code." },
                { "role": "user", "content": gamePrompt }
            ];

            const openRouterPayload = JSON.stringify({
                model: TARGET_MODEL_FOR_GENERATION,
                messages: messages,
                stream: false
            });
            console.log('[GEN_API_LOG] OpenRouter payload for game generation (first 200 chars):', openRouterPayload.substring(0,200) + (openRouterPayload.length > 200 ? '...' : ''));

            const options = {
                hostname: 'openrouter.ai',
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(openRouterPayload)
                }
            };
            
            console.log("[GEN_API_LOG] Sending request to OpenRouter for game generation. Game: ", gameRequest);

            // This part needs to be promisified or use async/await with https.request if possible
            // For simplicity in Vercel, we can wrap the https.request in a Promise
            
            const httpPromise = new Promise((resolve, reject) => {
                const apiReq = https.request(options, (apiRes) => {
                    let apiResponseBody = '';
                    console.log(`[GEN_API_LOG] OpenRouter response status for game generation: ${apiRes.statusCode}`);
                    apiRes.on('data', (chunk) => {
                        apiResponseBody += chunk;
                    });
                    apiRes.on('end', () => {
                        console.log('[GEN_API_LOG] OpenRouter response for game generation ended. Full response body (first 500 chars):', apiResponseBody.substring(0,500) + (apiResponseBody.length > 500 ? '...' : ''));
                        try {
                            // CORS headers are set globally now
                            if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                                const responseData = JSON.parse(apiResponseBody);
                                console.log('[GEN_API_LOG] Parsed OpenRouter response successfully.');
                                if (responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content) {
                                    let gameHtml = responseData.choices[0].message.content;
                                    gameHtml = gameHtml.replace(/^```html\n?/i, '').replace(/\n?```$/, '');
                                    console.log("[GEN_API_LOG] Successfully extracted game HTML. Length:", gameHtml.length);
                                    resolve({ statusCode: 200, body: { gameHtml: gameHtml } });
                                } else {
                                    console.error('[GEN_API_ERROR] Invalid response structure from OpenRouter (missing expected content):', apiResponseBody);
                                    reject({ statusCode: 500, error: 'Failed to parse game HTML from AI response.', details: 'Invalid OpenRouter response structure' });
                                }
                            } else {
                                console.error("[GEN_API_ERROR] OpenRouter API error for game generation (Status: " + apiRes.statusCode + "):", apiResponseBody);
                                reject({ statusCode: apiRes.statusCode || 500, error: 'AI service returned an error during game generation.', details: apiResponseBody });
                            }
                        } catch (parseError) {
                            console.error('[GEN_API_ERROR] Error parsing OpenRouter response for game generation:', parseError, 'Raw body:', apiResponseBody);
                            reject({ statusCode: 500, error: 'Failed to parse AI service response for game generation.', details: parseError.message });
                        }
                    });
                });

                apiReq.on('error', (e) => {
                    console.error('[GEN_API_ERROR] Error making request to OpenRouter for game generation:', e);
                    reject({ statusCode: 500, error: 'Failed to connect to AI service for game generation.', details: e.message });
                });

                console.log('[GEN_API_LOG] Writing payload for game generation to OpenRouter and ending request.');
                apiReq.write(openRouterPayload);
                apiReq.end();
                console.log('[GEN_API_LOG] Game generation request to OpenRouter initiated.');
            });

            const result = await httpPromise;
            res.status(result.statusCode).json(result.body || { error: result.error, details: result.details });

        } catch (error) {
            console.error('[GEN_API_ERROR] Server error in /api/generate (outer try-catch):', error);
            if (!res.headersSent) {
                 res.status(500).json({ error: 'Internal server error during game generation.', details: error.message });
            }
        }
    } else {
        console.log('[GEN_API_LOG] Method not POST or OPTIONS for /api/generate. Sending 405.');
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        res.status(405).json({ error: `Method ${req.method} not allowed.` });
    }
};

// Removed server.listen() and associated console logs
// Ensure OPENROUTER_API_KEY is set in Vercel environment variables. 