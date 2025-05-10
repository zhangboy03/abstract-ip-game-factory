document.addEventListener('DOMContentLoaded', () => {
    const chatList = document.getElementById('chatList');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');

    const uploadedImageURL = sessionStorage.getItem('uploadedImageURL');
    const uploadedAudioURL = sessionStorage.getItem('uploadedAudioURL');

    // Stores the conversation history to send to the backend
    let conversationHistory = [];

    function appendMessage(content, sender, isSystemMessage = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'rounded-lg', 'mb-2', 'max-w-xl');
        let role;

        if (isSystemMessage) {
            messageDiv.classList.add('bg-yellow-200', 'text-yellow-800', 'text-sm', 'italic', 'self-center', 'mx-auto');
            role = 'system'; // Not strictly for AI, but for our log
        } else if (sender === 'user') {
            messageDiv.classList.add('bg-blue-500', 'text-white', 'self-end', 'ml-auto');
            role = 'user';
        } else { // AI
            messageDiv.classList.add('bg-gray-300', 'text-black', 'self-start', 'mr-auto');
            role = 'assistant';
        }
        messageDiv.textContent = content;
        chatList.appendChild(messageDiv);
        chatList.scrollTop = chatList.scrollHeight; // Scroll to bottom

        if (!isSystemMessage) {
            // Add to conversation history for backend
            // For AI messages, we add them once the full stream is complete.
            if (role === 'user') {
                conversationHistory.push({ role: role, content: content });
            }
        }
    }

    async function callGenerateApiAndRedirect(gameParams) {
        appendMessage("System: Received game parameters. Requesting game generation from /api/generate...", "system", true);
        try {
            const response = await fetch('http://localhost:3001/api/generate', { // <-- UPDATED URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gameRequest: gameParams.gameRequest,
                    twist: gameParams.twist,
                    requirements: gameParams.requirements,
                    imgURL: uploadedImageURL, // Pass along the image URL
                    audioURL: uploadedAudioURL // Pass along the audio URL
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(`HTTP error! status: ${response.status} - ${errorData.detail || 'Unknown error'}`);
            }

            const result = await response.json();
            if (result.gameHtml) {
                sessionStorage.setItem('generatedGameHTML', result.gameHtml);
                appendMessage("System: Game HTML received! Redirecting to preview...", "system", true);
                window.location.href = 'preview.html';
            } else {
                throw new Error('No gameHtml in response from /api/generate');
            }
        } catch (error) {
            console.error('Error calling /api/generate:', error);
            appendMessage(`System: Error generating game. ${error.message}. Please check console.`, "system", true);
        }
    }

    async function handleAIResponse(textStream) {
        let currentAIResponse = "";
        let aiMessageDiv = null;
        let potentialJson = "";
        let inCodeBlock = false;

        const reader = textStream.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                // Add the fully formed AI message to history
                if (currentAIResponse) {
                    conversationHistory.push({ role: 'assistant', content: currentAIResponse });
                }
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            currentAIResponse += chunk;

            if (!aiMessageDiv) {
                aiMessageDiv = document.createElement('div');
                aiMessageDiv.classList.add('p-3', 'rounded-lg', 'mb-2', 'max-w-xl', 'bg-gray-300', 'text-black', 'self-start', 'mr-auto');
                chatList.appendChild(aiMessageDiv);
            }
            // Sanitize and render. Be careful with directly setting textContent if HTML is expected in parts.
            aiMessageDiv.textContent = currentAIResponse; 
            chatList.scrollTop = chatList.scrollHeight;

            // Attempt to parse for JSON handshake block. Be robust about partial JSON.
            // Look for ```json ... ``` or just { ... }
            if (currentAIResponse.includes('{') && currentAIResponse.includes('}')) {
                // Extract potential JSON string, could be wrapped in ```json ... ```
                let extractedJson = "";
                const jsonBlockMatch = currentAIResponse.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatch && jsonBlockMatch[1]) {
                    extractedJson = jsonBlockMatch[1];
                } else {
                    // Look for the last complete JSON object if not in a markdown block
                    // This is a simple heuristic and might need to be more robust
                    const lastBrace = currentAIResponse.lastIndexOf('}');
                    if (lastBrace > -1) {
                        const firstBrace = currentAIResponse.lastIndexOf('{', lastBrace);
                        if (firstBrace > -1) {
                            extractedJson = currentAIResponse.substring(firstBrace, lastBrace + 1);
                        }
                    }
                }
                
                if (extractedJson) {
                    try {
                        const parsed = JSON.parse(extractedJson);
                        if (parsed.gameRequest && parsed.twist && parsed.requirements) {
                            // Valid handshake detected
                            // Stop further processing of this AI message, call generate API
                            await callGenerateApiAndRedirect(parsed);
                            // Prevent adding this handshake JSON to history as a typical AI message
                            currentAIResponse = ""; // Clear this as it's handled
                            return; // Exit stream processing
                        }
                    } catch (e) {
                        // Not valid JSON yet, or not the handshake
                    }
                }
            }
        }
    }

    async function sendConversationToAPI(userMessageContent = null) {
        let messagesToSend = [...conversationHistory];
        if (userMessageContent) {
             // This is a new user message, append it before sending
            // But it's already added to conversationHistory by appendMessage
        }

        // The system prompt is implicitly handled by the backend now
        // Or, if your backend expects it explicitly each time:
        // messagesToSend.unshift({ role: "system", content: "... your full system prompt ..." });

        const payload = {
            conversation: messagesToSend,
            imgURL: uploadedImageURL,       // Backend will attach this to the latest user message
            audioURL: uploadedAudioURL     // Backend will attach this too
        };
        
        try {
            const response = await fetch('http://localhost:3000/api/chat', { // <-- UPDATED URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok || !response.body) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
            }
            
            await handleAIResponse(response.body);

        } catch (error) {
            console.error('Error sending conversation to API:', error);
            appendMessage(`System: Error communicating with AI. ${error.message}. Please check console.`, "system", true);
        }
    }

    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userInput = chatInput.value.trim();
        if (!userInput) return;

        appendMessage(userInput, 'user');
        chatInput.value = ''; // Clear input
        
        await sendConversationToAPI(userInput);
    });

    // Initial interaction on page load
    function startChat() {
        if (!uploadedImageURL) {
            appendMessage('System: No character image uploaded. Please go back to the first page to upload an image.', "system", true);
            chatInput.disabled = true;
            chatForm.querySelector('button[type="submit"]').disabled = true;
            return;
        }

        // Initial message from system or first AI prompt based on uploaded content
        let initialGreeting = "Hello! I'm your game design assistant.";
        if (uploadedImageURL) initialGreeting += " I see you've uploaded an image.";
        if (uploadedAudioURL) initialGreeting += " And an audio URL.";
        initialGreeting += " What classic game are you thinking of adapting today? And what kind of twist do you have in mind? Or, if you want me to propose something, just say 'suggest a game'!";
        
        appendMessage(initialGreeting, 'assistant');
        conversationHistory.push({ role: 'assistant', content: initialGreeting });

        // The backend /api/chat now handles the main system prompt and Claude interaction.
        // We don't need to send an explicit initial prompt from here anymore if the above greeting is sufficient
        // to get the user to type something, which then triggers sendConversationToAPI.
        // If an initial AI call is still desired without user input first, you can call sendConversationToAPI() here.
        // For example: sendConversationToAPI(); to get an initial response from the AI based on the greeting.
    }

    startChat();
}); 