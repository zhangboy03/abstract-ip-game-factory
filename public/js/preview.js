document.addEventListener('DOMContentLoaded', () => {
    const gameFrame = document.getElementById('gameFrame');
    const downloadHtmlButton = document.getElementById('downloadHtmlButton');
    const copyLinkButton = document.getElementById('copyLinkButton');

    const gameHTML = sessionStorage.getItem('generatedGameHTML');
    // TODO: Implement fetching from Supabase if not in sessionStorage / or if a link is visited directly

    if (gameHTML) {
        gameFrame.srcdoc = gameHTML;
    } else {
        gameFrame.srcdoc = "<p class='p-4 text-center text-gray-500'>No game content found. Please generate a game first. Go back to chat and request game generation.</p>";
        downloadHtmlButton.disabled = true;
        copyLinkButton.disabled = true;
    }

    downloadHtmlButton.addEventListener('click', () => {
        if (!gameHTML) {
            alert('No game content to download.');
            return;
        }
        const blob = new Blob([gameHTML], { type: 'text/html' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'index.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    });

    copyLinkButton.addEventListener('click', () => {
        if (!gameHTML) {
            alert('No game content to share.');
            return;
        }
        // Placeholder for actual Supabase upload and link generation
        alert('To get a shareable link, the game would first be uploaded (e.g., to Supabase). This functionality is a placeholder.');
        // Example of future clipboard functionality:
        // const shareableLink = '...link from Supabase...';
        // navigator.clipboard.writeText(shareableLink).then(() => {
        //     alert('Link copied to clipboard! (Placeholder)');
        // }).catch(err => {
        //     alert('Failed to copy link. (Placeholder)');
        // });
    });

    // Optional: Logic to load game from URL parameter if Supabase is used for sharing
    // const urlParams = new URLSearchParams(window.location.search);
    // const gameId = urlParams.get('gameId');
    // if (gameId && !gameHTML) { // Only if not already loaded from sessionStorage
    //    console.log("Attempting to load game with ID from URL parameter:", gameId); 
    //    gameFrame.srcdoc = `<p class='p-4 text-center text-gray-500'>Loading game ${gameId} from server (feature not implemented)...</p>`;
    //    // Actual fetch from Supabase would go here:
    //    // fetchGameFromSupabase(gameId).then(html => { gameFrame.srcdoc = html; sessionStorage.setItem('generatedGameHTML', html); downloadHtmlButton.disabled = false; copyLinkButton.disabled = false; }).catch(err => ...);
    // }
}); 