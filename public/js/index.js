document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const imageUpload = document.getElementById('imageUpload');
    const audioUrlInput = document.getElementById('audioUrl');

    uploadForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const imageFile = imageUpload.files[0];
        const audioUrl = audioUrlInput.value.trim();

        if (!imageFile) {
            alert('Please select an image file.');
            return;
        }

        // Basic validation for file size (e.g., 2MB)
        if (imageFile.size > 2 * 1024 * 1024) {
            alert('Image file size should be less than 2MB.');
            return;
        }

        // Convert image to data URL to store in sessionStorage
        const reader = new FileReader();
        reader.onload = (e) => {
            sessionStorage.setItem('uploadedImageURL', e.target.result);
            if (audioUrl) {
                sessionStorage.setItem('uploadedAudioURL', audioUrl);
            }
            window.location.href = 'chat.html'; // Navigate to chat page
        };
        reader.onerror = () => {
            alert('Error reading image file.');
        }
        reader.readAsDataURL(imageFile);
    });
}); 