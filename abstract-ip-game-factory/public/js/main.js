document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    // Left Sidebar
    const newChatButton = document.getElementById('newChatButton');
    const gameHistoryList = document.getElementById('gameHistoryList');

    // Right Main Content - Top Bar
    const currentGameTitle = document.getElementById('currentGameTitle');

    // Right Main Content - Chat Area
    const chatMessagesContainer = document.getElementById('chatMessages');
    
    // Right Main Content - Input Area (File Previews)
    const filePreviewArea = document.getElementById('filePreviewArea');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imageThumbnailsArea = document.getElementById('imageThumbnailsArea');
    const uploadedImageName = document.getElementById('uploadedImageName');
    const removeAllImagesButton = document.getElementById('removeAllImagesButton');

    const audioPreviewContainer = document.getElementById('audioPreviewContainer');
    const uploadedAudioName = document.getElementById('uploadedAudioName');
    const removeAudioButton = document.getElementById('removeAudioButton');

    // Right Main Content - Input Area (Chat Form)
    const chatForm = document.getElementById('chatForm');
    const imageUploadInput = document.getElementById('imageUpload');
    const audioUploadInput = document.getElementById('audioUpload');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');

    // Right Main Content - Game Preview Area
    const gamePreviewAside = document.getElementById('gamePreviewAside');
    const downloadGameButton = document.getElementById('downloadGameButton');
    const gameFrame = document.getElementById('gameFrame');
    const fullscreenPlayButton = document.getElementById('fullscreenPlayButton');
    const shareGameButton = document.getElementById('shareGameButton');

    // --- State Variables ---
    let currentUploadedImageURLs = [];
    let currentUploadedAudioURL = null;
    let selectedImageFiles = [];
    let selectedAudioFile = null;
    let currentGameSessionId = null;

    // --- Utility Functions (will be expanded) ---
    function showNotification(message, type = 'info', duration = 3000) {
        console.log(`Notification (${type}):`, message);
        if (type === 'error' || type === 'info') {
            alert(message);
        }
    }

    function setLoadingState(isLoading, buttonElement, originalText = 'Send') {
        if (!buttonElement) return;
        if (isLoading) {
            buttonElement.disabled = true;
            buttonElement.textContent = 'Processing...'; // Or a spinner SVG
            buttonElement.classList.add('opacity-75', 'cursor-not-allowed');
        } else {
            buttonElement.disabled = false;
            buttonElement.textContent = originalText;
            buttonElement.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }

    // --- File Upload Logic ---
    imageUploadInput.addEventListener('change', async (event) => {
        console.log('[main.js] Image input \'change\' event fired.'); // DEBUG

        const files = event.target.files;
        if (!files || files.length === 0) {
            console.log('[main.js] No files selected or input cleared.'); // DEBUG
            if (selectedImageFiles.length > 0 && files.length === 0) {
                clearAllImageFiles();
            }
            return;
        }

        console.log(`[main.js] ${files.length} file(s) selected.`); // DEBUG
        clearAllImageFiles(); 
        selectedImageFiles = Array.from(files);

        if (selectedImageFiles.length > 0) {
            imagePreviewContainer.classList.remove('hidden');
            imagePreviewContainer.classList.add('flex');
            uploadedImageName.textContent = `${selectedImageFiles.length} image(s) selected`;
            uploadedImageName.classList.remove('hidden');

            if (!sendButton) {
                console.error('[main.js] CRITICAL: sendButton is not found in the DOM!'); 
                showNotification('Error: UI element missing, cannot proceed with upload.', 'error');
                return;
            }
            console.log('[main.js] About to call setLoadingState(true). sendButton type:', typeof sendButton, 'sendButton:', sendButton); // DEBUG
            setLoadingState(true, sendButton);
            console.log('[main.js] setLoadingState(true) called for sendButton. sendButton.disabled should be true:', sendButton.disabled); // DEBUG

            const uploadPromises = selectedImageFiles.map(async (file, index) => {
                console.log(`[main.js] Processing file ${index + 1}: ${file.name}`); // DEBUG
                const reader = new FileReader();
                const previewPromise = new Promise((resolve) => {
                    reader.onload = (e) => {
                        const thumbDiv = document.createElement('div');
                        thumbDiv.className = 'relative group w-10 h-10';
                        const img = document.createElement('img');
                        img.src = e.target.result;
                        img.alt = `Preview ${index + 1}`;
                        img.className = 'h-full w-full object-cover rounded border border-gray-300';
                        thumbDiv.appendChild(img);
                        imageThumbnailsArea.appendChild(thumbDiv);
                        resolve();
                    };
                    reader.readAsDataURL(file);
                });
                await previewPromise;
                console.log(`[main.js] Preview shown for file ${index + 1}:`, file.name); // DEBUG

                const formData = new FormData();
                formData.append('source', file);
                try {
                    console.log(`[main.js] Attempting to upload ${file.name} to /api/upload-image`); // DEBUG
                    const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData,
                    });
                    console.log(`[main.js] Fetch response status for ${file.name}:`, response.status); // DEBUG
                    if (response.ok) {
                        const result = await response.json();
                        console.log(`[main.js] Upload successful for ${file.name}, URL:`, result.imageUrl); // DEBUG
                        return result.imageUrl;
                    } else {
                        const errorResult = await response.json().catch(() => ({ error: 'Failed to parse error from image proxy' }));
                        console.error(`[main.js] Upload failed for ${file.name}. Status: ${response.status}`, errorResult); // DEBUG
                        showNotification(`Upload failed for ${file.name}: ${errorResult.error || response.statusText}`, 'error');
                        return null; 
                    }
                } catch (error) {
                    console.error(`[main.js] Network error during upload for ${file.name}:`, error); // DEBUG
                    showNotification(`Network error during upload for ${file.name}: ${error.message}`, 'error');
                    return null;
                }
            });

            try {
                console.log('[main.js] Awaiting all upload promises...'); // DEBUG
                const results = await Promise.all(uploadPromises);
                currentUploadedImageURLs = results.filter(url => url !== null);
                console.log('[main.js] All upload promises settled. Successful URLs:', currentUploadedImageURLs); // DEBUG

                if (currentUploadedImageURLs.length === 0 && selectedImageFiles.length > 0) {
                    showNotification('All image uploads failed. Please try again.', 'error');
                    clearAllImageFiles();
                } else if (currentUploadedImageURLs.length < selectedImageFiles.length) {
                    showNotification('Some images failed to upload. Only successfully uploaded images will be used.', 'info');
                }
            } catch (error) {
                console.error('[main.js] Error in Promise.all for uploads:', error); // DEBUG
                showNotification('An unexpected error occurred during batch image upload.', 'error');
                clearAllImageFiles();
            } finally {
                setLoadingState(false, sendButton);
                console.log('[main.js] setLoadingState(false) called for sendButton.'); // DEBUG
                if (currentUploadedImageURLs.length === 0) {
                    imagePreviewContainer.classList.add('hidden');
                    imagePreviewContainer.classList.remove('flex');
                    uploadedImageName.classList.add('hidden');
                }
            }
        }
    });

    audioUploadInput.addEventListener('change', async (event) => {
        selectedAudioFile = event.target.files[0];
        if (selectedAudioFile) {
            if (selectedAudioFile.size > 5 * 1024 * 1024) { // 5MB limit
                showNotification('Audio file size should be less than 5MB.', 'error');
                selectedAudioFile = null;
                audioUploadInput.value = ''; // Clear the file input
                removeAudioFile();
                return;
            }
            uploadedAudioName.textContent = selectedAudioFile.name;
            audioPreviewContainer.classList.remove('hidden');
            audioPreviewContainer.classList.add('flex');

            // Attempt to upload immediately
            const formData = new FormData();
            formData.append('audio', selectedAudioFile);

            setLoadingState(true, sendButton);

            try {
                const response = await fetch('/api/upload-audio', {
                    method: 'POST',
                    body: formData,
                });
                if (response.ok) {
                    const result = await response.json();
                    currentUploadedAudioURL = result.audioUrl;
                    console.log('Audio uploaded:', currentUploadedAudioURL);
                } else {
                    const errorResult = await response.json().catch(() => ({ error: 'Failed to parse error from audio proxy' }));
                    showNotification(`Audio upload failed: ${errorResult.error || response.statusText}`, 'error');
                    currentUploadedAudioURL = null;
                    removeAudioFile();
                }
            } catch (error) {
                showNotification(`Network error during audio upload: ${error.message}`, 'error');
                currentUploadedAudioURL = null;
                removeAudioFile();
            } finally {
                setLoadingState(false, sendButton);
            }
        } else {
            removeAudioFile();
        }
    });

    function clearAllImageFiles() {
        imageThumbnailsArea.innerHTML = '';
        uploadedImageName.textContent = '';
        uploadedImageName.classList.add('hidden');
        imagePreviewContainer.classList.add('hidden');
        imagePreviewContainer.classList.remove('flex');
        imageUploadInput.value = '';
        selectedImageFiles = [];
        currentUploadedImageURLs = [];
    }

    function removeAudioFile() {
        uploadedAudioName.textContent = '';
        audioPreviewContainer.classList.add('hidden');
        audioPreviewContainer.classList.remove('flex');
        audioUploadInput.value = '';
        selectedAudioFile = null;
        currentUploadedAudioURL = null;
    }

    removeAllImagesButton.addEventListener('click', clearAllImageFiles);
    removeAudioButton.addEventListener('click', removeAudioFile);

    // --- Chat Logic (to be implemented) ---
    let conversationHistory = [];

    function appendMessage(content, sender, isHTML = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message'); // Base class from <style>

        if (sender === 'user') {
            messageDiv.classList.add('user-message');
            conversationHistory.push({ role: 'user', content: content });
        } else if (sender === 'ai') {
            messageDiv.classList.add('ai-message');
            // AI messages are added to history by the function that processes AI response
        } else { // system messages, etc.
            messageDiv.classList.add('text-sm', 'text-gray-600', 'text-center', 'my-2', 'italic'); // Basic system message style
        }

        if (isHTML) {
            messageDiv.innerHTML = content;
        } else {
            messageDiv.textContent = content;
        }
        
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; // Auto-scroll to bottom
    }

    chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userInput = chatInput.value.trim();
        if (!userInput) return;

        if (currentUploadedImageURLs.length === 0) {
            showNotification('Please upload at least one image first to start the chat.', 'error');
            return;
        }

        appendMessage(userInput, 'user');
        chatInput.value = '';
        
        setLoadingState(true, sendButton, 'Sending...');
        await sendConversationToAPI(); // This function will be migrated next
        setLoadingState(false, sendButton, 'Send');
    });

    async function sendConversationToAPI() {
        if (currentUploadedImageURLs.length === 0) {
            appendMessage('System: Cannot send message. Image(s) are missing.', 'system');
            return;
        }

        const payload = {
            conversation: conversationHistory,
            imgURLs: currentUploadedImageURLs,
            audioURL: currentUploadedAudioURL 
        };
        
        try {
            const response = await fetch('/api/chat', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok || !response.body) {
                const errorText = await response.text().catch(() => "Failed to get error details from /api/chat.");
                throw new Error(`Chat API error! Status: ${response.status}. ${errorText}`);
            }
            
            await handleAIResponse(response.body);

        } catch (error) {
            console.error('Error sending conversation to API:', error);
            appendMessage(`System: Error communicating with AI. ${error.message}. Please try again or check console.`, 'system');
            // Ensure loading state is reset even on error before this function returns
            setLoadingState(false, sendButton, 'Send'); 
        }
    }

    async function handleAIResponse(textStream) {
        let accumulatedVisibleText = ""; 
        let completeAIResponseForHistory = ""; 
        let aiMessageDiv = null;

        const reader = textStream.getReader();
        const decoder = new TextDecoder();
        let buffer = ""; 

        // Create a new AI message div upfront for streaming
        aiMessageDiv = document.createElement('div');
        aiMessageDiv.classList.add('message', 'ai-message');
        chatMessagesContainer.appendChild(aiMessageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    if (completeAIResponseForHistory) {
                         // Check if the last message in history is already this one
                        if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length -1]?.content !== completeAIResponseForHistory || conversationHistory[conversationHistory.length -1]?.role !== 'assistant') {
                            conversationHistory.push({ role: 'assistant', content: completeAIResponseForHistory });
                        }
                    }
                    break; // Exit loop when stream is done
                }

                buffer += decoder.decode(value, { stream: true });
                let boundary = buffer.indexOf('\n\n');

                while (boundary !== -1) {
                    const message = buffer.substring(0, boundary);
                    buffer = buffer.substring(boundary + 2);

                    if (message.startsWith('data: ')) {
                        const jsonDataString = message.substring('data: '.length);
                        if (jsonDataString.trim().toLowerCase() === '[done]') {
                            if (completeAIResponseForHistory) {
                                if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length -1]?.content !== completeAIResponseForHistory || conversationHistory[conversationHistory.length -1]?.role !== 'assistant') {
                                    conversationHistory.push({ role: 'assistant', content: completeAIResponseForHistory });
                                }
                            }
                            return; // Stream processing explicitly finished by [DONE]
                        }
                        try {
                            const parsedData = JSON.parse(jsonDataString);
                            if (parsedData.text) {
                                accumulatedVisibleText += parsedData.text;
                                completeAIResponseForHistory += parsedData.text;

                                aiMessageDiv.textContent = accumulatedVisibleText; 
                                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

                                // Check for game generation handshake
                                if (accumulatedVisibleText.includes('{') && accumulatedVisibleText.includes('}')) {
                                    let extractedJson = "";
                                    const jsonBlockMatch = accumulatedVisibleText.match(/```json\s*([\s\S]*?)\s*```/);
                                    if (jsonBlockMatch && jsonBlockMatch[1]) {
                                        extractedJson = jsonBlockMatch[1];
                                    } else {
                                        const lastBrace = accumulatedVisibleText.lastIndexOf('}');
                                        if (lastBrace > -1) {
                                            const firstBrace = accumulatedVisibleText.lastIndexOf('{', lastBrace);
                                            if (firstBrace > -1 && firstBrace < lastBrace) { 
                                                extractedJson = accumulatedVisibleText.substring(firstBrace, lastBrace + 1);
                                            }
                                        }
                                    }
                                    
                                    if (extractedJson) {
                                        try {
                                            const parsedHandshake = JSON.parse(extractedJson);
                                            if (parsedHandshake.gameRequest && parsedHandshake.twist && parsedHandshake.requirements) {
                                                // Add current AI message to history *before* calling generate API
                                                // Ensure we don't add only the JSON part if it was part of a larger message
                                                const historyContent = completeAIResponseForHistory.replace(extractedJson, '').trim();
                                                if (historyContent) {
                                                     if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length -1]?.content !== historyContent || conversationHistory[conversationHistory.length -1]?.role !== 'assistant') {
                                                        conversationHistory.push({ role: 'assistant', content: historyContent });
                                                     }
                                                }
                                                await callGenerateApiAndDisplayGame(parsedHandshake);
                                                return; 
                                            }
                                        } catch (e) {
                                            // Not the handshake JSON or malformed, continue accumulating
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Could not parse JSON from SSE data:', jsonDataString, e);
                        }
                    }
                    boundary = buffer.indexOf('\n\n');
                }
            }
        } finally {
            // Ensure loading state is reset after stream is fully processed or if an error occurs mid-stream
            setLoadingState(false, sendButton, 'Send');
        }
    }

    // Placeholder for the function that calls /api/generate and displays the game
    async function callGenerateApiAndDisplayGame(gameParams) {
        appendMessage('System: Received game parameters. Requesting game generation...', 'system');
        setLoadingState(true, sendButton, 'Generating...');

        let progressInterval = null; // To store the interval ID for the fake progress

        if (gameFrame) {
            // HTML for loading message including a placeholder for the progress bar
            gameFrame.srcdoc = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; font-family:sans-serif; color:#333; background-color:#f9fafb; padding: 20px; box-sizing: border-box;">
                    <style>
                        .loader-spinner {
                            border: 5px solid #f3f3f3; /* Light grey */
                            border-top: 5px solid #3498db; /* Blue */
                            border-radius: 50%;
                            width: 50px;
                            height: 50px;
                            animation: spin 1s linear infinite;
                            margin-bottom: 15px; /* Adjusted margin */
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        .fake-progress-bar-container {
                            width: 80%;
                            max-width: 300px;
                            height: 10px;
                            background-color: #e0e0e0;
                            border-radius: 5px;
                            margin-bottom: 15px;
                            overflow: hidden;
                        }
                        .fake-progress-bar {
                            width: 0%; /* Initial width */
                            height: 100%;
                            background-color: #3498db; /* Blue */
                            border-radius: 5px;
                            transition: width 0.5s ease-out; /* Smooth transition */
                        }
                    </style>
                    <div class="loader-spinner"></div>
                    <div class="fake-progress-bar-container">
                        <div id="gameProgress" class="fake-progress-bar"></div>
                    </div>
                    <h3 style="font-size: 1.2em; margin-bottom: 10px; color: #1f2937;">Crafting Your memeAIgame!</h3>
                    <p style="font-size: 0.9em; color: #4b5563; text-align:center;">The AI is working its magic on "${gameParams.gameRequest}"<br>with the twist: "${gameParams.twist}".</p>
                    <p style="font-size: 0.8em; color: #6b7280; margin-top:10px;">This can take a moment, please wait...</p>
                </div>
            `;
            
            // Start fake progress simulation
            let currentProgress = 0;
            const estimatedTotalTimeMs = 45000; // Estimated 45 seconds for full generation
            const intervalTimeMs = 250; // Update interval
            const progressIncrement = (100 / (estimatedTotalTimeMs / intervalTimeMs)) * 0.9; // Aim for 90% over estimated time
            
            // Access the progress bar element inside the iframe after srcdoc is set
            // This requires a slight delay to ensure the iframe content is parsed
            setTimeout(() => {
                const iframeDoc = gameFrame.contentDocument || gameFrame.contentWindow.document;
                const progressBar = iframeDoc.getElementById('gameProgress');
                if (progressBar) {
                    progressInterval = setInterval(() => {
                        currentProgress += progressIncrement;
                        if (currentProgress < 95) { // Don't let it hit 100% too early
                            progressBar.style.width = currentProgress + '%';
                        } else {
                            // Stay at 95% until actual completion or error
                            progressBar.style.width = '95%'; 
                        }
                    }, intervalTimeMs);
                }
            }, 100); // Small delay for iframe DOM to be ready
        }
        if (fullscreenPlayButton) fullscreenPlayButton.classList.add('hidden');
        if (shareGameButton) shareGameButton.classList.add('hidden');

        try {
            console.log("Calling /api/generate with:", gameParams, "Img URLs:", currentUploadedImageURLs, "Audio:", currentUploadedAudioURL);
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gameRequest: gameParams.gameRequest,
                    twist: gameParams.twist,
                    requirements: gameParams.requirements,
                    imgURLs: currentUploadedImageURLs,
                    audioURL: currentUploadedAudioURL
                })
            });

            const responseText = await response.text(); // Read response as text first

            if (!response.ok) {
                let errorData = { detail: responseText, error: 'Server error' }; // Default if not JSON
                try {
                    errorData = JSON.parse(responseText); // Try to parse as JSON
                } catch (e) {
                    // If parsing fails, errorData remains as { detail: responseText, error: 'Server error' }
                    console.warn('Server error response was not valid JSON:', responseText);
                }
                const errorMessage = errorData.error || errorData.detail || 'Failed to generate game.';
                if (progressInterval) clearInterval(progressInterval); // Stop fake progress
                if (gameFrame) {
                    gameFrame.srcdoc = `
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; font-family:sans-serif; color:#c0392b; background-color:#fef2f2; padding: 20px; box-sizing: border-box; text-align: center;">
                            <h3 style="font-size: 1.2em; margin-bottom: 10px;">Oops! Game Generation Failed</h3>
                            <p style="font-size: 0.9em; margin-bottom:5px;">The AI encountered an issue while trying to create your game.</p>
                            <p style="font-size: 0.8em; color: #7f1d1d; background-color: #fee2e2; padding: 5px 10px; border-radius: 4px; display: inline-block; max-width: 90%; overflow-wrap: break-word;">Error: ${errorMessage}</p>
                            <p style="font-size: 0.8em; margin-top:15px;">You can try again, perhaps with a different classic game or a new twist! (memeAIgame)</p>
                        </div>
                    `;
                }
                throw new Error(`Game generation API error! Status: ${response.status} - ${errorMessage}`);
            }

            // If response.ok, try to parse the text as JSON
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse successful API response as JSON:', responseText, e);
                if (progressInterval) clearInterval(progressInterval); // Stop fake progress
                if (gameFrame) {
                    gameFrame.srcdoc = `
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; font-family:sans-serif; color:#c0392b; background-color:#fef2f2; padding: 20px; box-sizing: border-box; text-align: center;">
                            <h3 style="font-size: 1.2em; margin-bottom: 10px;">Oops! Invalid Response</h3>
                            <p style="font-size: 0.9em; margin-bottom:5px;">The AI responded, but the game data was not in the expected format.</p>
                             <p style="font-size: 0.8em; color: #7f1d1d; background-color: #fee2e2; padding: 5px 10px; border-radius: 4px; display: inline-block; max-width: 90%; overflow-wrap: break-word;">Details: Could not parse game data from memeAIgame.</p>
                            <p style="font-size: 0.8em; margin-top:15px;">Please try generating the game again.</p>
                        </div>
                    `;
                }
                throw new Error(`Failed to parse successful game generation response: ${e.message}. Response snippet: ${responseText.substring(0, 200)}...`);
            }

            if (result.gameHtml) {
                appendMessage("System: Game HTML received! Displaying in preview panel.", "system");
                if (progressInterval) clearInterval(progressInterval); // Stop fake progress
                // Optionally, make progress bar jump to 100% briefly before showing game
                if (gameFrame && gameFrame.contentDocument) {
                     const iframeDoc = gameFrame.contentDocument || gameFrame.contentWindow.document;
                     const progressBar = iframeDoc.getElementById('gameProgress');
                     if(progressBar) progressBar.style.width = '100%';
                }
                // Short delay to show 100% before replacing srcdoc, or remove if direct load is preferred
                // setTimeout(() => {
                //    if (gameFrame) gameFrame.srcdoc = result.gameHtml;    
                // }, 100); 
                if (gameFrame) gameFrame.srcdoc = result.gameHtml; // Load game directly

                lastGeneratedGameHTML = result.gameHtml;
                fullscreenPlayButton.classList.remove('hidden');
                shareGameButton.classList.remove('hidden');
                
                const gameDataForStorage = {
                    imgURLs: currentUploadedImageURLs,
                    imageName: selectedImageFiles.length > 0 ? `${selectedImageFiles.length} image(s)` : (currentUploadedImageURLs.length > 0 ? `${currentUploadedImageURLs.length} uploaded image(s)` : null),
                    audioURL: currentUploadedAudioURL,
                    audioName: selectedAudioFile ? selectedAudioFile.name : (currentUploadedAudioURL ? 'Uploaded Audio' : null),
                    gameParams: gameParams, 
                    gameHTML: lastGeneratedGameHTML,
                    conversationHistory: [...conversationHistory],
                    characterNameFromParams: gameParams.characterName, 
                    gameTypeFromParams: gameParams.gameRequest
                };

                if (currentGameSessionId === null) { // This is a brand new game
                    const newGameId = Date.now();
                    currentGameSessionId = newGameId; // Set active session

                    const gameDataForTitle = {
                        characterName: gameParams.characterName, 
                        gameType: gameParams.gameRequest 
                    };
                    const suggestedTitle = `${gameDataForTitle.characterName || 'My IP'} in ${gameDataForTitle.gameType || 'Classic Game'}`;
                    const gameTitle = prompt(`Enter a name for this new game:`, suggestedTitle) || suggestedTitle;
                    
                    currentGameTitle.textContent = gameTitle; // Update main title

                    saveGameToHistory({
                        id: newGameId,
                        title: gameTitle,
                        ...gameDataForStorage
                    });
                } else { // This is an iteration of an existing game
                    // Get the existing title for the notification, and to keep it consistent
                    const history = getGameHistory();
                    const existingGame = history.find(g => g.id === currentGameSessionId);
                    const existingTitle = existingGame ? existingGame.title : 'Untitled Game';
                    
                    currentGameTitle.textContent = existingTitle; // Ensure main title reflects iterated game

                    updateGameInHistory(currentGameSessionId, {
                        // id and title are preserved by updateGameInHistory from original
                        ...gameDataForStorage
                    });
                    chatInput.placeholder = "Tell me how to modify the game further."; // Update placeholder after successful game generation
                }
            } else {
                if (progressInterval) clearInterval(progressInterval); // Stop fake progress
                if (gameFrame) {
                    gameFrame.srcdoc = `
                        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; font-family:sans-serif; color:#c0392b; background-color:#fef2f2; padding: 20px; box-sizing: border-box; text-align: center;">
                            <h3 style="font-size: 1.2em; margin-bottom: 10px;">Oops! Generation Incomplete</h3>
                            <p style="font-size: 0.9em; margin-bottom:5px;">The AI responded, but the game code seems to be missing from memeAIgame.</p>
                            <p style="font-size: 0.8em; margin-top:15px;">Please try generating the game again.</p>
                        </div>
                    `;
                }
                throw new Error('No gameHtml in response from /api/generate. Full response: ' + JSON.stringify(result));
            }
        } catch (error) {
            console.error('Error calling /api/generate:', error); 
            if (progressInterval) clearInterval(progressInterval); // Stop fake progress
            appendMessage(`System: Error generating game. ${error.message}. Please check console.`, 'system');
            // Ensure error is also shown in gameFrame if not already set by specific error handlers above
            if (gameFrame && !gameFrame.srcdoc.includes('Oops!')) { // Avoid overwriting more specific error messages
                 gameFrame.srcdoc = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; font-family:sans-serif; color:#c0392b; background-color:#fef2f2; padding: 20px; box-sizing: border-box; text-align: center;">
                        <h3 style="font-size: 1.2em; margin-bottom: 10px;">An Error Occurred</h3>
                        <p style="font-size: 0.9em; margin-bottom:5px;">Could not generate the game due to a client-side or network issue (memeAIgame).</p>
                        <p style="font-size: 0.8em; color: #7f1d1d; background-color: #fee2e2; padding: 5px 10px; border-radius: 4px; display: inline-block;">Details: ${error.message}</p>
                        <p style="font-size: 0.8em; margin-top:15px;">Please check your connection and try again.</p>
                    </div>
                `;
            }
        } finally {
            setLoadingState(false, sendButton, 'Send');
        }
    }

    // --- Game Preview Logic & Download ---
    let lastGeneratedGameHTML = null; // Store the last generated game HTML for download

    fullscreenPlayButton.addEventListener('click', () => {
        if (!lastGeneratedGameHTML) {
            showNotification('No game content available to play fullscreen. Please generate a game first.', 'error');
            return;
        }
        try {
            const gameWindow = window.open('', '_blank');
            if (gameWindow) {
                gameWindow.document.write(lastGeneratedGameHTML);
                gameWindow.document.close();
            } else {
                showNotification('Could not open a new window. Please check your browser pop-up settings.', 'error');
            }
        } catch (e) {
            showNotification('Error trying to open game in a new window.', 'error');
            console.error("Error opening fullscreen window:", e);
        }
    });

    // --- Game History Logic (to be implemented) ---
    const MAX_HISTORY_ITEMS = 10; // Limit the number of items in history

    newChatButton.addEventListener('click', () => {
        initializeChat(); // This already clears state and sets up for a new session
        // loadAndDisplayGameHistory(); // history list is already persistent unless we want to re-render it
    });

    function getGameHistory() {
        const history = localStorage.getItem('memeAIgameHistory');
        return history ? JSON.parse(history) : [];
    }

    function saveGameToHistory(gameData) {
        let history = getGameHistory();
        // Add new game to the beginning
        history.unshift(gameData);
        // Limit history size
        if (history.length > MAX_HISTORY_ITEMS) {
            history = history.slice(0, MAX_HISTORY_ITEMS);
        }
        localStorage.setItem('memeAIgameHistory', JSON.stringify(history));
        renderGameHistoryList(); // Update the displayed list
    }

    function updateGameInHistory(gameId, updatedContents) {
        let history = getGameHistory();
        const gameIndex = history.findIndex(game => game.id === gameId);

        if (gameIndex !== -1) {
            // Preserve original ID and Title, update the rest
            const originalGame = history[gameIndex];
            history[gameIndex] = {
                ...originalGame, // Keeps id, title, and any other old fields not in updatedContents
                ...updatedContents // Overwrites with new gameHTML, gameParams, conversationHistory, etc.
            };
            localStorage.setItem('memeAIgameHistory', JSON.stringify(history));
            renderGameHistoryList(); // Re-render to reflect potential (though maybe not visible if title same)
            showNotification(`Game "${originalGame.title}" updated.`, 'info');
        } else {
            console.warn('Attempted to update a game not found in history:', gameId);
            // Fallback to saving as a new game if update target not found? Or just error?
            // For now, just log a warning. If this happens, it indicates a logic flaw.
        }
    }

    function renderGameHistoryList() {
        const history = getGameHistory();
        gameHistoryList.innerHTML = ''; // Clear existing list

        if (history.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No games saved yet.';
            li.className = 'p-2 text-xs text-gray-500 italic';
            gameHistoryList.appendChild(li);
            return;
        }

        history.forEach(game => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-2 rounded-md hover:bg-gray-700 group cursor-pointer transition duration-150 text-sm'; // Added flex, items-center, group
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'truncate'; // Ensure long titles don't break layout
            titleSpan.textContent = game.title || `Game - ${new Date(game.id).toLocaleTimeString()}`;
            titleSpan.title = game.title || `Game - ${new Date(game.id).toLocaleTimeString()}`;
            titleSpan.addEventListener('click', () => {
                restoreGameFromHistory(game.id);
            });

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;'; // Simple 'x' icon
            deleteButton.className = 'ml-2 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity px-1 rounded'; // Initially hidden, shows on li hover
            deleteButton.title = 'Delete game';
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent li click event from firing
                if (confirm(`Are you sure you want to delete "${game.title || 'this game'}"?`)) {
                    deleteGameFromHistory(game.id);
                }
            });

            li.appendChild(titleSpan);
            li.appendChild(deleteButton);
            gameHistoryList.appendChild(li);
        });
    }

    function deleteGameFromHistory(gameIdToDelete) {
        let history = getGameHistory();
        history = history.filter(game => game.id !== gameIdToDelete);
        localStorage.setItem('memeAIgameHistory', JSON.stringify(history));
        renderGameHistoryList(); // Re-render the list

        // Optional: Check if the deleted game was the currently loaded one
        // For simplicity now, we don't automatically load another game or clear the view,
        // but this could be added (e.g., if currentGameTitle matches the deleted game title)
        // For now, the user can click another history item or "New Game".
        // If we want to clear the view if the active game is deleted:
        // const currentTitleText = currentGameTitle.textContent;
        // const deletedGame = getGameHistory().find(g => g.id === gameIdToDelete); // Should be undefined now
        // const originallyLoadedGame = getGameHistory().find(g => g.title === currentTitleText); // This check is flawed if titles aren't unique
        // A better way would be to store current loaded game ID if restoring from history.
        // For now, let's keep it simple. If a more complex behavior is needed, we can refine.
        showNotification('Game deleted from history.', 'info');
    }

    function restoreGameFromHistory(gameId) {
        const history = getGameHistory();
        const gameData = history.find(game => game.id === gameId);

        if (!gameData) {
            showNotification('Could not find game in history.', 'error');
            return;
        }

        // 1. Reset current chat UI and state (similar to initializeChat but without clearing history list itself)
        chatMessagesContainer.innerHTML = '';
        clearAllImageFiles();
        removeAudioFile();
        
        // Set the active game session ID
        currentGameSessionId = gameData.id;

        // 2. Restore game assets
        currentUploadedImageURLs = gameData.imgURLs || [];
        currentUploadedAudioURL = gameData.audioURL || null;
        lastGeneratedGameHTML = gameData.gameHTML || null;

        // 3. Update UI for assets
        if (currentUploadedImageURLs.length > 0) {
            imagePreviewContainer.classList.remove('hidden');
            imagePreviewContainer.classList.add('flex');
            uploadedImageName.textContent = gameData.imageName || `${currentUploadedImageURLs.length} image(s)`;
            uploadedImageName.classList.remove('hidden');

            currentUploadedImageURLs.forEach((url, index) => {
                const thumbDiv = document.createElement('div');
                thumbDiv.className = 'relative group w-10 h-10';
                const img = document.createElement('img');
                img.src = url;
                img.alt = `Preview ${index + 1}`;
                img.className = 'h-full w-full object-cover rounded border border-gray-300';
                thumbDiv.appendChild(img);
                imageThumbnailsArea.appendChild(thumbDiv);
            });
        }
        if (currentUploadedAudioURL) {
            uploadedAudioName.textContent = gameData.audioName || 'Saved Audio'; 
            audioPreviewContainer.classList.remove('hidden');
            audioPreviewContainer.classList.add('flex');
        }

        // 4. Display game in iframe
        if (lastGeneratedGameHTML) {
            gameFrame.srcdoc = lastGeneratedGameHTML;
            fullscreenPlayButton.classList.remove('hidden');
            shareGameButton.classList.remove('hidden');
        } else {
            gameFrame.srcdoc = "<div class='flex items-center justify-center h-full text-gray-500'>No game HTML found for this memeAIgame history item.</div>";
            fullscreenPlayButton.classList.add('hidden');
            shareGameButton.classList.add('hidden');
        }

        // 5. Restore conversation history
        conversationHistory = gameData.conversationHistory || [];
        conversationHistory.forEach(message => {
            // appendMessage needs to handle not re-adding to its own history array if called this way
            // For now, let's make a simpler version for re-rendering
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', message.role === 'user' ? 'user-message' : 'ai-message');
            if (message.role === 'system') { // Adjust if system messages have distinct styling in history
                 messageDiv.classList.add('text-sm', 'text-gray-600', 'text-center', 'my-2', 'italic');
            }
            // Handle potential HTML in stored messages (especially initial AI greeting)
            // For simplicity, assuming content is text or simple HTML that's safe to innerHTML
            if (message.content.includes('<') && message.content.includes('>')) { 
                 messageDiv.innerHTML = message.content;
            } else {
                 messageDiv.textContent = message.content;
            }
            chatMessagesContainer.appendChild(messageDiv);
        });
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

        // 6. Update title
        currentGameTitle.textContent = gameData.title || 'Restored memeAIgame Session';

        // 7. Ready for further interaction
        chatInput.value = '';
        chatInput.focus();
        showNotification(`Restored game: ${currentGameTitle.textContent}`, 'info');
    }

    function loadAndDisplayGameHistory() {
        renderGameHistoryList();
    }

    // --- Initial Setup & Chat Initialization ---
    function initializeChat() {
        // Clear existing messages
        chatMessagesContainer.innerHTML = ''; 
        // Clear previous file selections and URLs
        clearAllImageFiles();
        removeAudioFile();
        // Clear game preview and hide download button
        gameFrame.srcdoc = "<div class='flex items-center justify-center h-full text-gray-500'>Your memeAIgame preview will appear here once generated.</div>";
        fullscreenPlayButton.classList.add('hidden');
        shareGameButton.classList.add('hidden');
        
        currentGameTitle.textContent = 'New memeAIgame Session'; // Reset title
        conversationHistory = []; // Reset history for this session
        currentGameSessionId = null; // Crucial: New game means no active session ID

        const initialGreetingParts = [
            "Want to turn your boss into a brick in Breakout? Your partner into the head of a pixelated snake? Or your cat into the hero of a wacky adventure?",
            "Upload a picture — whether it's your boss, friend, partner, pet, or a totally abstract meme — and add a sound they might make.",
            "Then tell us: what kind of game do you want to play? Something silly? Stress-relieving? Weirdly romantic?",
            "We'll remix a classic game to match your idea — and your character becomes the star.",
            "Need some inspiration? How about:\n- A 'Whack-a-Boss' game?\n- A 'Pixel Hopper' adventure starring your partner or pet?\n- Your own version of 'Brick Breaker' or 'Snake' featuring your unique IP?\nOr suggest any classic game you love!"
        ];
        
        initialGreetingParts.forEach(part => {
            appendMessage(part, 'ai', false); // isHTML = false as newlines should be handled by textContent with proper CSS (e.g., white-space: pre-line)
            conversationHistory.push({ role: 'assistant', content: part });
        });

        chatInput.value = '';
        chatInput.placeholder = "Type your message..."; // Reset to default placeholder
        chatInput.focus();
    }

    // --- Initial Call ---
    initializeChat(); 
    loadAndDisplayGameHistory(); // Load history on initial load
    console.log('main.js loaded. UI initialized and chat started.');

    // --- New Event Listener for Share Game Button ---
    shareGameButton.addEventListener('click', async () => {
        if (!lastGeneratedGameHTML) {
            showNotification('No game content available to share. Please generate a game first.', 'error');
            return;
        }

        // 1. Download HTML
        try {
            const blob = new Blob([lastGeneratedGameHTML], { type: 'text/html' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = (currentGameTitle.textContent || 'game').replace(/[^a-z0-9_\-]/gi, '_') + '.html';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            showNotification(
                'Game HTML downloaded! To share an image:\n1. Play the game fullscreen.\n2. Reach an exciting moment.\n3. Use your computer\'s screenshot tool (e.g., Windows: Win+Shift+S, Mac: Cmd+Shift+4) to capture it!\n(Tip: The game might have a "Capture Moment" button that pauses for easier screenshotting.)',
                'info',
                10000 // Longer duration for this detailed message
            );
        } catch (e) {
            showNotification('Error downloading HTML file.', 'error');
            console.error("Error downloading HTML:", e);
        }

        // Screenshot functionality is now primarily handled by in-game button and postMessage
        // So, we remove the direct html2canvas call from this button.
    });

    // Remove or comment out the message listener and its handler
    /*
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CAPTURE_GAME_SCREEN') {
            handleInGameScreenshotRequest(event.data.gameData); 
        }
    });

    async function handleInGameScreenshotRequest(gameDataFromIframe) {
        if (!gameFrame.contentWindow || !lastGeneratedGameHTML) {
            showNotification('Cannot capture screenshot: Game preview is not active or content is missing.', 'error');
            return;
        }
        showNotification('Screenshot requested from game! Generating...', 'info');
        setLoadingState(true, shareGameButton, 'Capturing...');
        try {
            if (gameFrame.contentWindow && gameFrame.contentWindow.document && gameFrame.contentWindow.document.documentElement) { 
                const canvas = await html2canvas(gameFrame.contentWindow.document.documentElement, {
                    useCORS: true, 
                    logging: true, 
                    scale: 1.0 
                });
                const screenshotLink = document.createElement('a');
                screenshotLink.href = canvas.toDataURL('image/png');
                screenshotLink.download = (currentGameTitle.textContent || 'game_capture').replace(/[^a-z0-9_\-]/gi, '_') + '.png';
                document.body.appendChild(screenshotLink);
                screenshotLink.click();
                document.body.removeChild(screenshotLink);
                showNotification('Screenshot downloaded! Game HTML also recommended for sharing.', 'info');
            } else {
                showNotification('Could not access game content for screenshot.', 'error');
            }
        } catch (e) {
            showNotification('Error generating screenshot from game.', 'error');
            console.error("Error with html2canvas during in-game request:", e);
        } finally {
            setLoadingState(false, shareGameButton, 'Share Game');
        }
    }
    */

}); 