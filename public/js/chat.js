document.addEventListener('DOMContentLoaded', () => {
    const chatList = document.getElementById('chatList');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');

    const uploadedImageURL = sessionStorage.getItem('uploadedImageURL');
    const uploadedAudioURL = sessionStorage.getItem('uploadedAudioURL');

    function appendMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('p-3', 'rounded-lg', 'mb-2', 'max-w-xl');
        if (sender === 'user') {
            messageDiv.classList.add('bg-blue-500', 'text-white', 'self-end', 'ml-auto');
        } else {
            messageDiv.classList.add('bg-gray-300', 'text-black', 'self-start', 'mr-auto');
        }
        messageDiv.textContent = content;
        chatList.appendChild(messageDiv);
        chatList.scrollTop = chatList.scrollHeight; // Scroll to bottom
    }

    // Send initial system prompt
    async function sendInitialPrompt() {
        let prompt = "You are an AI game designer. A user has provided an image";
        if (uploadedImageURL) {
            prompt += ` (image available)`;
        }
        if (uploadedAudioURL) {
            prompt += ` and an audio URL: ${uploadedAudioURL}`;
        }
        prompt += ". Your goal is to help the user choose a classic game to adapt and then discuss one or two interesting mechanics or twists. Once the user says 'OK, generate game', you will output the complete HTML, CSS, and JavaScript code for a single-file HTML5 game. Do not use any external libraries unless it's a CDN link for a well-known library like Phaser. Start by asking the user what classic game they'd like to adapt.";

        appendMessage("System: Sending initial prompt...", "system");

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt, image: uploadedImageURL })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Handle SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = "";
            let aiMessageDiv = null;

            function processStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        if (aiResponse.toLowerCase().includes('<html>')) {
                            sessionStorage.setItem('generatedGameHTML', aiResponse);
                            window.location.href = 'preview.html';
                        }
                        return;
                    }
                    const chunk = decoder.decode(value, { stream: true });
                    aiResponse += chunk;
                    if (!aiMessageDiv) {
                        aiMessageDiv = document.createElement('div');
                        aiMessageDiv.classList.add('p-3', 'rounded-lg', 'mb-2', 'max-w-xl', 'bg-gray-300', 'text-black', 'self-start', 'mr-auto');
                        chatList.appendChild(aiMessageDiv);
                    }
                    aiMessageDiv.textContent = aiResponse; // Update AI message in real-time
                    chatList.scrollTop = chatList.scrollHeight;
                    processStream(); // Continue reading the stream
                }).catch(error => {
                    console.error('Error reading stream:', error);
                    appendMessage('Error communicating with AI.', 'system');
                });
            }
            processStream();

        } catch (error) {
            console.error('Error sending initial prompt:', error);
            appendMessage('Failed to connect to AI. Please check console.', 'system');
        }
    }

    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userInput = chatInput.value.trim();
        if (!userInput) return;

        appendMessage(userInput, 'user');
        chatInput.value = ''; // Clear input

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: userInput, image: uploadedImageURL, audio: uploadedAudioURL })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = "";
            let aiMessageDiv = null;

            function processStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        if (aiResponse.toLowerCase().includes('<html>')) {
                            sessionStorage.setItem('generatedGameHTML', aiResponse);
                            window.location.href = 'preview.html';
                        }
                        return;
                    }
                    const chunk = decoder.decode(value, { stream: true });
                    aiResponse += chunk;
                    if (!aiMessageDiv) {
                        aiMessageDiv = document.createElement('div');
                        aiMessageDiv.classList.add('p-3', 'rounded-lg', 'mb-2', 'max-w-xl', 'bg-gray-300', 'text-black', 'self-start', 'mr-auto');
                        chatList.appendChild(aiMessageDiv);
                    }
                    aiMessageDiv.textContent = aiResponse; // Update AI message in real-time
                    chatList.scrollTop = chatList.scrollHeight;
                    processStream(); // Continue reading the stream
                }).catch(error => {
                    console.error('Error reading stream:', error);
                    appendMessage('Error communicating with AI.', 'system');
                });
            }
            processStream();

        } catch (error) {
            console.error('Error sending message:', error);
            appendMessage('Failed to send message. Please check console.', 'system');
        }
    });

    if (uploadedImageURL) {
        sendInitialPrompt();
    } else {
        // Handle case where user directly lands on chat.html without uploading image
        // Potentially redirect to index.html or show an error.
        appendMessage('No image uploaded. Please go back to the upload page.', 'system');
        // Optionally, disable chat input or provide a link to go back.
        chatInput.disabled = true;
        // Example: setTimeout(() => { window.location.href = 'index.html'; }, 3000);
    }
}); 