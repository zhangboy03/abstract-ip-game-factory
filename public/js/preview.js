document.addEventListener('DOMContentLoaded', () => {
    const gameFrame = document.getElementById('gameFrame');
    const downloadHtmlButton = document.getElementById('downloadHtmlButton');
    const copyLinkButton = document.getElementById('copyLinkButton');

    const gameHTML = sessionStorage.getItem('generatedGameHTML');
    // TODO: Implement fetching from Supabase if not in sessionStorage / or if a link is visited directly

    if (gameHTML) {
        gameFrame.srcdoc = gameHTML;
    } else {
        gameFrame.srcdoc = "<p class='p-4 text-center text-gray-500'>No game content found. Please generate a game first.</p>";
        downloadHtmlButton.disabled = true;
        copyLinkButton.disabled = true;
    }

    downloadHtmlButton.addEventListener('click', () => {
        if (!gameHTML) return;
        const blob = new Blob([gameHTML], { type: 'text/html' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'game.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    });

    copyLinkButton.addEventListener('click', () => {
        // This button is a placeholder for when Supabase integration is added.
        // For now, it will indicate that the game needs to be uploaded first.
        if (!gameHTML) {
            alert('No game content to share.');
            return;
        }

        // Placeholder: Simulate Supabase upload and link generation
        alert('To get a shareable link, the game would first be uploaded to a backend (e.g., Supabase). This functionality is not yet implemented in the scaffold.');
        
        // If Supabase is integrated, you would:
        // 1. Upload gameHTML to Supabase.
        // 2. Get a unique ID or slug for the game.
        // 3. Construct a shareable URL (e.g., yourdomain.com/preview.html?gameId=UNIQUE_ID).
        // 4. Copy this URL to the clipboard.
        // navigator.clipboard.writeText(shareableLink).then(() => {
        //     alert('Link copied to clipboard!');
        // }).catch(err => {
        //     alert('Failed to copy link.');
        // });
    });

    // Optional: Logic to load game from URL parameter if Supabase is used
    // const urlParams = new URLSearchParams(window.location.search);
    // const gameId = urlParams.get('gameId');
    // if (gameId) {
    //    // Fetch gameHTML from Supabase using gameId and update gameFrame.srcdoc
    //    // supabase.from('games').select('game_code').eq('id', gameId).single().then(({data, error}) => { ... });
    //    console.log("Attempting to load game with ID:", gameId); 
    //    gameFrame.srcdoc = `<p class='p-4 text-center text-gray-500'>Loading game ${gameId} from server...</p>`;
    // }
}); 