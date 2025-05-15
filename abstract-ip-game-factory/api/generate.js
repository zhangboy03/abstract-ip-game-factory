require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Consider Haiku for faster/cheaper generation if complexity allows, or Sonnet for more complex games.
const CLAUDE_MODEL_FOR_GENERATION = "anthropic/claude-3.7-sonnet"; // Updated model ID

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*'); // To be restricted later
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        if (!OPENROUTER_API_KEY) {
            console.error('OPENROUTER_API_KEY is not set.');
            res.status(500).json({ error: 'Server configuration error: Missing API key.' });
            return;
        }

        // Vercel typically parses JSON request bodies automatically into req.body
        // If not, the manual parsing method below is a fallback.
        let requestBodyString = '';
        if (req.body) { // Check if Vercel pre-parsed the body
            // If req.body is already an object, stringify it for logging, then use it directly.
            // Or, if it's a buffer/string, use it. Assuming JSON was sent.
            try {
                requestBodyString = (typeof req.body === 'string' || req.body instanceof Buffer) ? req.body.toString() : JSON.stringify(req.body);
            } catch (e) { 
                // Fallback if stringify fails (e.g. circular structure, though unlikely for this payload)
                 console.error("Error stringifying pre-parsed req.body", e);
                 res.status(400).json({ error: 'Malformed request body.'});
                 return;
            }
        } else {
            // Fallback to manual body accumulation if req.body isn't populated by Vercel
            try {
                for await (const chunk of req) {
                    requestBodyString += chunk.toString();
                }
            } catch (streamError) {
                console.error("Error reading request stream:", streamError);
                res.status(500).json({ error: 'Error reading request data.'});
                return;
            }
        }
        
        console.log('[DEBUG] /api/generate received requestBody string:', requestBodyString);

        try {
            const parsedBody = JSON.parse(requestBodyString);
            console.log('[DEBUG] /api/generate parsedBody:', parsedBody);

            const { gameRequest, twist, imgURL, audioURL, requirements } = parsedBody;

            console.log('[DEBUG] gameRequest:', gameRequest);
            console.log('[DEBUG] twist:', twist);
            console.log('[DEBUG] audioURL:', audioURL);
            console.log('[DEBUG] requirements:', requirements);

            if (!gameRequest || !twist) {
                console.error('[ERROR] /api/generate: Missing gameRequest or twist.');
                res.status(400).json({ error: 'Invalid request: gameRequest and twist are required.' });
                return;
            }

            let characterSpriteInstruction = "";
            if (imgURL) {
                characterSpriteInstruction = `-   【Main Character/Element MANDATE】: The primary visual element of the game, especially the player-controlled character or the central interactive piece, MUST be created exclusively using the image specified by the imgURL: ${imgURL}. Do NOT use placeholder graphics, generic shapes, or AI-generated new visuals for this core IP element. Its appearance in the game is of utmost importance.\n-   【User Image is SACROSANCT】: The game design MUST NOT instruct the player to imagine features or elements of the IP that are not visible in the provided imgURL. The game mechanics should rely on the visual information present in that image.`;
            } else {
                characterSpriteInstruction = "-   If imgURL is not provided: Use a simple, clearly identifiable placeholder like a colored rectangle for the player, and state this was done due to a missing image URL.";
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

            const gamePrompt = `You are an expert HTML5 game developer. Your task is to generate a complete, single-file, playable HTML5 game.
The game MUST be self-contained in a single HTML file, including all HTML, CSS, and JavaScript. Do not use any external libraries or assets unless explicitly instructed.
The total size of the generated HTML file should ideally be under 200KB.

Game Concept:
1.  Classic Game to Adapt: "${gameRequest}"
2.  Interesting Twist: "${twist}"

Asset Integration - CRITICAL INSTRUCTIONS:
${characterSpriteInstruction}
${soundInstruction}

Important Instructions for Asset URLs (Reiteration):
- You MUST use the exact URLs provided for the character sprite (imgURL, if used in above instructions) and sound effect (audioURL, if used in above instructions).
- Do NOT derive paths, guess filenames, or assume assets are hosted elsewhere.
- If an asset URL is provided, use it directly. If not provided, use a placeholder (as per critical instructions above).

Specific Gameplay Requirements from User Discussion:
${dynamicRequirementsString ? dynamicRequirementsString + "\n\n" : " (None specified beyond the general concept)\n\n"}General Gameplay Requirements (ensure these are also met):
-   【Prioritize Classic Core】：The game MUST primarily implement the standard rules and core gameplay loop of the requested classic game: "${gameRequest}". This is the absolute priority.
-   【Integrate IP Visually】：All visual styling (CSS, colors, fonts if applicable, UI elements like score display, buttons) MUST take significant inspiration from the style, colors, and theme of the user's IP image. For example, if the IP is pixel art, the game UI should also be pixelated or use a retro theme. If the IP is cartoonish, the UI should be clean and use a similar color palette. The goal is an IP-themed version of the classic game.
-   【Implement Twist Simply】：Any "Twist" described ("${twist}") MUST be implemented as a simple, secondary layer or a light modification to the core classic mechanics. It should not fundamentally change or overshadow the classic game. If the twist is complex, implement only its simplest, most direct interpretation that fits the IP.
-   【Keep JavaScript Logic Clear】：The JavaScript code should be straightforward, focusing on the core classic mechanics and the simple twist. Avoid overly complex state management or unnecessary features not directly contributing to this IP-adapted classic gameplay.
-   The game must be playable and have clear win/lose conditions or scoring, consistent with the classic game being adapted.
-   Include basic instructions on how to play within the game's HTML (perhaps as a small overlay that can be dismissed, or on the game page itself), or make it extremely intuitive based on the classic game.
-   Ensure the game is responsive or at least usable on common screen sizes.

In-Game Action for Manual Screenshot (Optional Feature):
-   Consider adding a visible button (e.g., with text "Pause for Screenshot") or a designated key press (e.g., the 'P' key) that clearly PAUSES the game (stops all animations, player movement, timers, etc.).
-   When this pause action is triggered, ABSOLUTELY NO TEXT or messages (like "Game Paused") should be displayed over the core gameplay area. The game screen should be perfectly clear and representative of the gameplay at the moment of pausing, allowing the user to take an unobstructed screenshot. The pause state should be visually obvious through the cessation of all game activity.
-   This feature is solely to help the user take a manual screenshot. The button/key press should NOT send any \`postMessage\` to the parent window.

Output Format:
Respond ONLY with the raw HTML code for the game. Do not include any other text, explanations, or markdown formatting before or after the HTML code block.
The response should start with <!DOCTYPE html> and end with </html>.`;

            const messages = [
                { "role": "system", "content": "You are an expert HTML5 game developer. Your sole purpose is to generate a single HTML file containing a complete game based on the user\'s request. Output ONLY the HTML code." },
                { "role": "user", "content": gamePrompt }
            ];

            const openRouterPayload = JSON.stringify({
                model: CLAUDE_MODEL_FOR_GENERATION,
                messages: messages,
                stream: false
            });

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
            
            console.log("Sending request to OpenRouter for game generation: " + gameRequest);

            // This part needs to be promisified or use async/await with https.request if possible
            // For simplicity in Vercel, we can wrap the https.request in a Promise
            
            const httpPromise = new Promise((resolve, reject) => {
                const apiReq = https.request(options, (apiRes) => {
                    let apiResponseBody = '';
                    apiRes.on('data', (chunk) => {
                        apiResponseBody += chunk;
                    });
                    apiRes.on('end', () => {
                        try {
                            // CORS headers are set globally now
                            if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                                const responseData = JSON.parse(apiResponseBody);
                                if (responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content) {
                                    let gameHtml = responseData.choices[0].message.content;
                                    gameHtml = gameHtml.replace(/^```html\n?/i, '').replace(/\n?```$/, '');
                                    console.log("Successfully generated game: " + gameRequest);
                                    resolve({ statusCode: 200, body: { gameHtml: gameHtml } });
                                } else {
                                    console.error('Invalid response structure from OpenRouter:', apiResponseBody);
                                    reject({ statusCode: 500, error: 'Failed to parse game HTML from AI response.', details: 'Invalid OpenRouter response structure' });
                                }
                            } else {
                                console.error("OpenRouter API error (Status: " + apiRes.statusCode + "):", apiResponseBody);
                                reject({ statusCode: apiRes.statusCode || 500, error: 'AI service returned an error.', details: apiResponseBody });
                            }
                        } catch (parseError) {
                            console.error('Error parsing OpenRouter response:', parseError, apiResponseBody);
                            reject({ statusCode: 500, error: 'Failed to parse AI service response.', details: parseError.message });
                        }
                    });
                });

                apiReq.on('error', (e) => {
                    console.error('Error making request to OpenRouter:', e);
                    reject({ statusCode: 500, error: 'Failed to connect to AI service.', details: e.message });
                });

                apiReq.write(openRouterPayload);
                apiReq.end();
            });

            const result = await httpPromise;
            res.status(result.statusCode).json(result.body || { error: result.error, details: result.details });

        } catch (error) {
            // This catch block is for errors during requestBody parsing or other synchronous errors before the httpPromise.
            console.error('Server error in /api/generate (before OpenRouter request):', error);
            if (!res.headersSent) {
                 res.status(500).json({ error: 'Internal server error.', details: error.message });
            }
        }
    } else {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        res.status(405).json({ error: `Method ${req.method} not allowed.` });
    }
};

// Removed server.listen() and associated console logs
// Ensure OPENROUTER_API_KEY is set in Vercel environment variables. 