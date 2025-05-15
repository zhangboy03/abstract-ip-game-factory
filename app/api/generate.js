require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const http = require('http');
const https = require('https');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Consider Haiku for faster/cheaper generation if complexity allows, or Sonnet for more complex games.
const CLAUDE_MODEL_FOR_GENERATION = "anthropic/claude-3.7-sonnet"; // Updated model ID

const server = http.createServer(async (req, res) => {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080'); // Or '*' for less restrictive
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS' && req.url === '/api/generate') {
        res.writeHead(204); // No Content
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
        if (!OPENROUTER_API_KEY) {
            console.error('OPENROUTER_API_KEY is not set.');
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Server configuration error: Missing API key.' }));
            return;
        }

        let requestBody = '';
        req.on('data', chunk => {
            requestBody += chunk.toString();
        });

        req.on('end', async () => {
            console.log('[DEBUG] /api/generate received raw requestBody:', requestBody);
            try {
                const parsedBody = JSON.parse(requestBody);
                console.log('[DEBUG] /api/generate parsedBody:', parsedBody);

                const { gameRequest, twist, imgURL, audioURL, requirements } = parsedBody;

                console.log('[DEBUG] gameRequest:', gameRequest);
                console.log('[DEBUG] twist:', twist);
                // console.log('[DEBUG] imgURL:', imgURL); // Avoid logging potentially very long base64 string
                console.log('[DEBUG] audioURL:', audioURL);
                console.log('[DEBUG] requirements:', requirements);

                if (!gameRequest || !twist) {
                    console.error('[ERROR] /api/generate: Missing gameRequest or twist.');
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request: gameRequest and twist are required.' }));
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

                const apiReq = https.request(options, (apiRes) => {
                    let apiResponseBody = ''; // Accumulate the full response
                    apiRes.on('data', (chunk) => {
                        apiResponseBody += chunk;
                    });
                    apiRes.on('end', () => {
                        try {
                            // Ensure correct headers for JSON response to client
                            res.setHeader('Content-Type', 'application/json'); 
                            res.setHeader('Access-Control-Allow-Origin', '*'); // Keep CORS for client

                            if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                                const responseData = JSON.parse(apiResponseBody);
                                if (responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content) {
                                    let gameHtml = responseData.choices[0].message.content;
                                    // Remove potential markdown code block fences if AI adds them
                                    gameHtml = gameHtml.replace(/^```html\n?/i, '').replace(/\n?```$/, '');

                                    res.writeHead(200); // Headers already set
                                    res.end(JSON.stringify({ gameHtml: gameHtml }));
                                    console.log("Successfully generated game: " + gameRequest);
                                } else {
                                    console.error('Invalid response structure from OpenRouter:', apiResponseBody);
                                    res.writeHead(500);
                                    res.end(JSON.stringify({ error: 'Failed to parse game HTML from AI response.', details: 'Invalid OpenRouter response structure' }));
                                }
                            } else {
                                console.error("OpenRouter API error (Status: " + apiRes.statusCode + "):", apiResponseBody);
                                res.writeHead(apiRes.statusCode || 500);
                                res.end(JSON.stringify({ error: 'AI service returned an error.', details: apiResponseBody }));
                            }
                        } catch (parseError) {
                            console.error('Error parsing OpenRouter response or during placeholder replacement:', parseError, apiResponseBody);
                            res.setHeader('Content-Type', 'application/json'); // Ensure header for error
                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: 'Failed to parse AI service response or process generated HTML.', details: parseError.message }));
                        }
                    });
                });

                apiReq.on('error', (e) => {
                    console.error('Error making request to OpenRouter:', e);
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Failed to connect to AI service.', details: e.message }));
                });

                apiReq.write(openRouterPayload);
                apiReq.end();

            } catch (error) {
                console.error('Server error in /api/generate:', error);
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Internal server error.', details: error.message }));
            }
        });
    } else {
        // If not OPTIONS or POST to /api/generate, send 404 or a more specific error
        if (req.url !== '/api/generate') { // Only send 404 if the path is wrong
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found' }));
        } else { // Path is /api/generate but method is not POST or OPTIONS
            res.writeHead(405, { 'Content-Type': 'application/json' }); // Method Not Allowed
            res.end(JSON.stringify({ error: `Method ${req.method} not allowed for /api/generate` }));
        }
    }
});

const PORT = process.env.GENERATE_PORT || 3001;
server.listen(PORT, () => {
    console.log("Game Generation API (/api/generate) server listening on port " + PORT);
    if (!OPENROUTER_API_KEY) {
        console.warn('Warning: OPENROUTER_API_KEY is not set. API calls to OpenRouter will fail.');
    }
}); 