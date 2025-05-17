document.addEventListener('DOMContentLoaded', () => {
    const chatList = document.getElementById('chatList');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');

    const uploadedImageURL = sessionStorage.getItem('imgURL');
    const uploadedAudioURL = sessionStorage.getItem('audioURL');

    let conversationHistory = [];

    function appendMessage(content, sender, isSystemMessage = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'rounded-lg', 'mb-2', 'max-w-xl');
        let role;

        if (isSystemMessage) {
            messageDiv.classList.add('bg-yellow-200', 'text-yellow-800', 'text-sm', 'italic', 'self-center', 'mx-auto');
            role = 'system';
        } else if (sender === 'user') {
            messageDiv.classList.add('bg-blue-500', 'text-white', 'self-end', 'ml-auto');
            role = 'user';
        } else { // AI
            messageDiv.classList.add('bg-gray-300', 'text-black', 'self-start', 'mr-auto');
            role = 'assistant';
        }
        messageDiv.textContent = content;
        chatList.appendChild(messageDiv);
        chatList.scrollTop = chatList.scrollHeight;

        if (!isSystemMessage && role === 'user') {
            conversationHistory.push({ role: role, content: content });
        }
    }

    async function callGenerateApiAndRedirect(gameParams) {
        appendMessage("System: Received game parameters. Requesting game generation...", "system", true);
        try {
            const response = await fetch('http://localhost:3001/api/generate', { // ABSOLUTE URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gameRequest: gameParams.gameRequest,
                    twist: gameParams.twist,
                    requirements: gameParams.requirements,
                    imgURL: uploadedImageURL,
                    audioURL: uploadedAudioURL
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
            appendMessage(`System: Error generating game for memeAIgame. ${error.message}. Please check console.`, "system", true);
        }
    }

    async function handleAIResponse(textStream) {
        let accumulatedVisibleText = ""; // To store only the text for display
        let completeAIResponseForHistory = ""; // To store the full, clean AI response for history
        let aiMessageDiv = null;

        const reader = textStream.getReader();
        const decoder = new TextDecoder();
        let buffer = ""; // Buffer to handle chunks that might split an SSE message

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (completeAIResponseForHistory) {
                    conversationHistory.push({ role: 'assistant', content: completeAIResponseForHistory });
                }
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf('\n\n'); // SSE messages are separated by double newlines

            while (boundary !== -1) {
                const message = buffer.substring(0, boundary);
                buffer = buffer.substring(boundary + 2);

                if (message.startsWith('data: ')) {
                    const jsonDataString = message.substring('data: '.length);
                    if (jsonDataString.trim().toLowerCase() === '[done]') {
                        // Optional: handle [DONE] signal if your backend sends it explicitly before closing stream
                        // For now, we rely on the stream's `done` signal above.
                        // console.log("Received [DONE] signal from stream.");
                        if (completeAIResponseForHistory) { // ensure last message added to history
                             if (conversationHistory[conversationHistory.length -1]?.content !== completeAIResponseForHistory) {
                                conversationHistory.push({ role: 'assistant', content: completeAIResponseForHistory });
                             }
                        }
                        return; // Stream processing finished by [DONE]
                    }
                    try {
                        const parsedData = JSON.parse(jsonDataString);
                        if (parsedData.text) {
                            accumulatedVisibleText += parsedData.text;
                            completeAIResponseForHistory += parsedData.text;

                            if (!aiMessageDiv) {
                                aiMessageDiv = document.createElement('div');
                                aiMessageDiv.classList.add('p-3', 'rounded-lg', 'mb-2', 'max-w-xl', 'bg-gray-300', 'text-black', 'self-start', 'mr-auto');
                                chatList.appendChild(aiMessageDiv);
                            }
                            aiMessageDiv.textContent = accumulatedVisibleText; // Update with parsed text
                            chatList.scrollTop = chatList.scrollHeight;

                            // Check for game generation handshake AFTER updating visible text
                            if (accumulatedVisibleText.includes('{') && accumulatedVisibleText.includes('}')) {
                                let extractedJson = "";
                                const jsonBlockMatch = accumulatedVisibleText.match(/```json\s*([\s\S]*?)\s*```/);
                                if (jsonBlockMatch && jsonBlockMatch[1]) {
                                    extractedJson = jsonBlockMatch[1];
                                } else {
                                    const lastBrace = accumulatedVisibleText.lastIndexOf('}');
                                    if (lastBrace > -1) {
                                        const firstBrace = accumulatedVisibleText.lastIndexOf('{', lastBrace);
                                        if (firstBrace > -1 && firstBrace < lastBrace) { // ensure valid substring
                                            extractedJson = accumulatedVisibleText.substring(firstBrace, lastBrace + 1);
                                        }
                                    }
                                }
                                
                                if (extractedJson) {
                                    try {
                                        const parsedHandshake = JSON.parse(extractedJson);
                                        if (parsedHandshake.gameRequest && parsedHandshake.twist && parsedHandshake.requirements) {
                                            // Add current AI message to history before redirecting
                                            if (completeAIResponseForHistory.trim() !== extractedJson.trim()) { // Avoid adding only the handshake JSON as history
                                                conversationHistory.push({ role: 'assistant', content: completeAIResponseForHistory.replace(extractedJson, '').trim() });
                                            }
                                            await callGenerateApiAndRedirect(parsedHandshake);
                                            return; 
                                        }
                                    } catch (e) {
                                        // Not the handshake JSON or malformed
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // This might be a non-JSON part of the stream or an error within the stream
                        // console.warn('Could not parse JSON from SSE data:', jsonDataString, e);
                        // If the backend guarantees `data: ` lines are always JSON or `[DONE]`, this might indicate an issue.
                        // For now, we just log it out if needed for debugging and continue.
                    }
                }
                boundary = buffer.indexOf('\n\n'); // Look for next message boundary
            }
        }
        // Fallback: if loop finishes and there's still some unadded AI response (e.g. no [DONE] signal was received but stream ended)
        if (completeAIResponseForHistory && 
            (conversationHistory.length === 0 || conversationHistory[conversationHistory.length -1]?.content !== completeAIResponseForHistory)) {
            conversationHistory.push({ role: 'assistant', content: completeAIResponseForHistory });
        }
    }

    async function sendConversationToAPI() {
        const payload = {
            conversation: conversationHistory, // Send the current history
            imgURL: uploadedImageURL,
            audioURL: uploadedAudioURL
        };
        
        try {
            const response = await fetch('http://localhost:3000/api/chat', { // ABSOLUTE URL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok || !response.body) {
                const errorText = await response.text().catch(() => "Failed to get error details.");
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
        chatInput.value = '';
        
        await sendConversationToAPI(); // Send updated history
    });

    function startChat() {
        if (!uploadedImageURL) {
            appendMessage('System: No character image uploaded. Please go back to the first page to upload an image for memeAIgame.', "system", true);
            chatInput.disabled = true;
            chatForm.querySelector('button[type="submit"]').disabled = true;
            return;
        }

        let initialGreeting = "你好！我是你的游戏设计助手。我已经看到了你上传的图片";
        if (uploadedImageURL) {
            initialGreeting = `你好！我是你的游戏设计助手。我已经看到了你上传的图片 (<a href="${uploadedImageURL}" target="_blank" class="text-blue-600 underline">查看</a>)`;
        }
        if (uploadedAudioURL) {
            initialGreeting += ` 和音频链接 (<a href="${uploadedAudioURL}" target="_blank" class="text-blue-600 underline">播放</a>)`;
        }
        initialGreeting += "。你想改编哪款经典游戏，或者有什么天马行空的想法吗？放轻松，我们可以一起头脑风暴，我会尽量提出一些好玩的游戏方案！如果你没头绪，就说\"给我些灵感\"！";
        
        const initialMessageDiv = document.createElement('div');
        initialMessageDiv.classList.add('p-3', 'rounded-lg', 'mb-2', 'max-w-xl', 'bg-gray-300', 'text-black', 'self-start', 'mr-auto');
        initialMessageDiv.innerHTML = initialGreeting;
        chatList.appendChild(initialMessageDiv);

        conversationHistory.push({ role: 'assistant', content: initialGreeting });
    }

    startChat();
}); 