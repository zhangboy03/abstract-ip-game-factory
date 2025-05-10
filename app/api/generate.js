// Placeholder for /api/generate
// Expected to receive a POST request with JSON body:
// {
//   "gameRequest": "<name of classic game>",
//   "twist": "<description of the twist>",
//   "requirements": ["<requirement1>", "<requirement2>"]
// }
//
// Should eventually process this request (likely by calling another AI or a template engine)
// and return a JSON response:
// {
//   "gameHtml": "<!DOCTYPE html>... your game code ..."
// }

const http = require('http');
const https = require('https');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Consider Haiku for faster/cheaper generation if complexity allows, or Sonnet for more complex games.
const CLAUDE_MODEL_FOR_GENERATION = "anthropic/claude-3-haiku-20240307"; // Or "anthropic/claude-3-sonnet-20240229"

const server = http.createServer(async (req, res) => {
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
            try {
                const { gameRequest, twist, imgURL, audioURL } = JSON.parse(requestBody);

                if (!gameRequest || !twist) {
                    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: 'Invalid request: gameRequest and twist are required.' }));
                    return;
                }

                let characterSpriteInstruction = "";
                if (imgURL) {
                    if (imgURL.startsWith('data:image')) {
                        characterSpriteInstruction = "The main character sprite should be the provided base64 encoded image: " + imgURL + ". Embed this directly into the HTML/JS.";
                    } else {
                        characterSpriteInstruction = "The main character sprite should be loaded from this URL: " + imgURL + ".";
                    }
                } else {
                    characterSpriteInstruction = "Use a simple placeholder (e.g., a colored square or circle) as the main character sprite.";
                }

                let soundInstruction = "";
                if (audioURL) {
                    soundInstruction = "When the player scores a point or another significant positive event occurs, play a sound from this URL: " + audioURL + ". Use HTML5 audio for this.";
                }

                const gamePrompt = 
"You are an expert HTML5 game developer. Your task is to generate a complete, single-file, playable HTML5 game.\n"
+ "The game MUST be self-contained in a single HTML file, including all HTML, CSS, and JavaScript. Do not use any external libraries or assets unless explicitly instructed.\n"
+ "The total size of the generated HTML file should ideally be under 200KB.\n\n"
+ "Game Concept:\n"
+ "1.  Classic Game to Adapt: \"" + gameRequest + "\"\n"
+ "2.  Interesting Twist: \"" + twist + "\"\n\n"
+ "Asset Integration:\n"
+ "-   Character Sprite: " + characterSpriteInstruction + "\n"
+ "-   Sound Effect: " + soundInstruction + "\n\n"
+ "Gameplay Requirements:\n"
+ "-   The game must be playable and have clear win/lose conditions or scoring.\n"
+ "-   Include basic instructions on how to play within the game\'s HTML, or make it intuitive.\n"
+ "-   Ensure the game is responsive or at least usable on common screen sizes.\n\n"
+ "Output Format:\n"
+ "Respond ONLY with the raw HTML code for the game. Do not include any other text, explanations, or markdown formatting before or after the HTML code block.\n"
+ "The response should start with <!DOCTYPE html> and end with </html>.";

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
                    let apiResponseBody = '';
                    apiRes.on('data', (chunk) => {
                        apiResponseBody += chunk;
                    });
                    apiRes.on('end', () => {
                        try {
                            if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                                const responseData = JSON.parse(apiResponseBody);
                                if (responseData.choices && responseData.choices[0] && responseData.choices[0].message && responseData.choices[0].message.content) {
                                    let gameHtml = responseData.choices[0].message.content;
                                    gameHtml = gameHtml.replace(/^```html\n?/i, '').replace(/\n?```$/, '');

                                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                                    res.end(JSON.stringify({ gameHtml: gameHtml }));
                                    console.log("Successfully generated game: " + gameRequest);
                                } else {
                                    console.error('Invalid response structure from OpenRouter:', apiResponseBody);
                                    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                                    res.end(JSON.stringify({ error: 'Failed to parse game HTML from AI response.' }));
                                }
                            } else {
                                console.error("OpenRouter API error (Status: " + apiRes.statusCode + "):", apiResponseBody);
                                res.writeHead(apiRes.statusCode || 500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                                res.end(JSON.stringify({ error: 'AI service returned an error.', details: apiResponseBody }));
                            }
                        } catch (parseError) {
                            console.error('Error parsing OpenRouter response:', parseError, apiResponseBody);
                            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                            res.end(JSON.stringify({ error: 'Failed to parse AI service response.', details: parseError.message }));
                        }
                    });
                });

                apiReq.on('error', (e) => {
                    console.error('Error making request to OpenRouter:', e);
                    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
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
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

const PORT = process.env.GENERATE_PORT || 3001;
server.listen(PORT, () => {
    console.log("Game Generation API (/api/generate) server listening on port " + PORT);
    if (!OPENROUTER_API_KEY) {
        console.warn('Warning: OPENROUTER_API_KEY is not set. API calls to OpenRouter will fail.');
    }
}); 