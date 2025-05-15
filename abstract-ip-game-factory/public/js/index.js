document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageUpload');
    const audioUrlInput = document.getElementById('audioUrlInput');
    const audioFileInput = document.getElementById('audioFileInput');
    const audioFileNameDisplay = document.getElementById('audioFileName');
    const startChatButton = document.getElementById('startChatButton');
    const uploadForm = document.getElementById('uploadForm');
    const imagePreview = document.getElementById('imagePreview');
    const previewImage = document.getElementById('previewImage');
    const previewText = document.getElementById('previewText');

    let selectedFile = null;
    let selectedAudioFile = null;

    if (!imageInput) {
        console.error("Could not find element with ID imageUpload");
        return; // Stop if the crucial input is missing
    }
    if (!audioUrlInput) {
        console.error("Could not find element with ID audioUrlInput");
    }
    if (!audioFileInput) {
        console.error("Could not find element with ID audioFileInput");
    }
    if (!startChatButton) {
        console.error("Could not find element with ID startChatButton");
        return; // Stop if the button is missing
    }
    if (!uploadForm) {
        console.error("Could not find element with ID uploadForm");
        return; // Stop if the form is missing
    }

    imageInput.addEventListener('change', (event) => {
        selectedFile = event.target.files[0];
        if (selectedFile) {
            // Display image preview (using FileReader for local preview only)
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewImage.classList.remove('hidden');
                previewText.classList.add('hidden');
                imagePreview.classList.remove('border-dashed');
            };
            reader.readAsDataURL(selectedFile);
        } else {
            previewImage.classList.add('hidden');
            previewText.classList.remove('hidden');
            imagePreview.classList.add('border-dashed');
            previewImage.src = '#';
        }
    });

    audioFileInput.addEventListener('change', (event) => {
        selectedAudioFile = event.target.files[0];
        if (selectedAudioFile) {
            audioFileNameDisplay.textContent = `Selected audio: ${selectedAudioFile.name}`;
            // Basic validation for file size (e.g., 5MB)
            if (selectedAudioFile.size > 5 * 1024 * 1024) {
                alert('Audio file size should be less than 5MB.');
                selectedAudioFile = null; // Reset selection
                audioFileInput.value = ''; // Clear the file input
                audioFileNameDisplay.textContent = '';
            }
        } else {
            selectedAudioFile = null;
            audioFileNameDisplay.textContent = '';
        }
    });

    // Use form submit event instead of button click to handle enter key etc.
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission which reloads the page

        let audioURLFromInput = audioUrlInput.value.trim();
        let finalAudioURL = audioURLFromInput; // Prioritize URL input if both are provided
        let imgURL = null;

        startChatButton.disabled = true;
        startChatButton.textContent = 'Processing...';
        startChatButton.classList.add('opacity-50');

        // --- Start Image Upload to PicGo --- 
        if (selectedFile) {
            startChatButton.textContent = 'Uploading Image...';
            const imageFormData = new FormData();
            imageFormData.append('source', selectedFile);
            // No format needed for image proxy, it handles PicGo format

            const proxyImageUploadURL = 'http://localhost:3002/api/upload-image';

            try {
                const response = await fetch(proxyImageUploadURL, {
                    method: 'POST',
                    body: imageFormData,
                });

                if (response.ok) {
                    const result = await response.json(); 
                    imgURL = result.imageUrl;
                    console.log('Image uploaded successfully via proxy:', imgURL);
                } else {
                    const errorResult = await response.json().catch(() => ({error: 'Failed to parse error from image proxy', details: response.statusText})); 
                    console.error('Image upload failed via proxy:', response.status, errorResult.error, errorResult.details);
                    alert(`Image upload failed: ${errorResult.error || 'Proxy error'}${errorResult.details ? ' (Details: ' + errorResult.details + ')' : ''}`);
                    startChatButton.disabled = false;
                    startChatButton.textContent = 'Start Chat';
                    startChatButton.classList.remove('opacity-50');
                    return; 
                }
            } catch (error) {
                console.error('Network error during image upload:', error);
                alert('Network error during image upload. Please check your connection and try again.');
                startChatButton.disabled = false;
                startChatButton.textContent = 'Start Chat';
                startChatButton.classList.remove('opacity-50');
                return; 
            }
        }
        // --- End Image Upload to PicGo ---

        // --- Start Audio Upload to Cloudinary (if no URL provided and file selected) --- 
        if (!finalAudioURL && selectedAudioFile) { 
            startChatButton.textContent = 'Uploading Audio...';
            const audioFormData = new FormData();
            audioFormData.append('audio', selectedAudioFile); // Field name must match proxy expectation

            const proxyAudioUploadURL = 'http://localhost:3003/api/upload-audio';

            try {
                const response = await fetch(proxyAudioUploadURL, {
                    method: 'POST',
                    body: audioFormData,
                });

                if (response.ok) {
                    const result = await response.json(); 
                    finalAudioURL = result.audioUrl; // Use the URL from Cloudinary
                    console.log('Audio uploaded successfully via proxy:', finalAudioURL);
                } else {
                    const errorResult = await response.json().catch(() => ({error: 'Failed to parse error from audio proxy', details: response.statusText})); 
                    console.error('Audio upload failed via proxy:', response.status, errorResult.error, errorResult.details);
                    alert(`Audio upload failed: ${errorResult.error || 'Proxy error'}${errorResult.details ? ' (Details: ' + errorResult.details + ')' : ''}`);
                    startChatButton.disabled = false;
                    startChatButton.textContent = 'Start Chat';
                    startChatButton.classList.remove('opacity-50');
                    return; 
                }
            } catch (error) {
                console.error('Network error during audio upload:', error);
                alert('Network error during audio upload. Please check your connection and try again.');
                startChatButton.disabled = false;
                startChatButton.textContent = 'Start Chat';
                startChatButton.classList.remove('opacity-50');
                return; 
            }
        }
        // --- End Audio Upload to Cloudinary ---

        // Store URLs in sessionStorage
        if (imgURL) {
            sessionStorage.setItem('imgURL', imgURL);
        }
        if (finalAudioURL) { // Use finalAudioURL which could be from input or upload
            sessionStorage.setItem('audioURL', finalAudioURL);
        }

        startChatButton.disabled = false;
        startChatButton.textContent = 'Start Chat';
        startChatButton.classList.remove('opacity-50');
        
        window.location.href = 'chat.html';
    });
}); 