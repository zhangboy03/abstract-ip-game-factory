require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const http = require('http');
const formidable = require('formidable');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Optional: ensures https URLs
});

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS' && req.url === '/api/upload-audio') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/upload-audio') {
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('Cloudinary credentials are not fully set in environment variables.');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server configuration error: Missing audio upload service credentials.' }));
            return;
        }

        const form = new formidable.IncomingForm({ keepExtensions: true });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error('Error parsing form data for audio:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Error processing audio upload.', details: err.message }));
                return;
            }

            const audioFile = files.audio; // Expecting input name 'audio' from frontend

            if (!audioFile || !audioFile[0]) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "No audio file provided in 'audio' field." }));
                return;
            }

            const uploadedFile = audioFile[0];
            const filePath = uploadedFile.filepath;

            console.log(`[AudioProxy] Uploading ${uploadedFile.originalFilename} to Cloudinary...`);

            try {
                // For audio, we need to specify resource_type as 'video' or 'raw' for Cloudinary if not auto-detected.
                // 'video' supports more transformations if needed later for audio, but 'raw' can also work for general files.
                const uploadResult = await cloudinary.uploader.upload(filePath, {
                    resource_type: 'video', // Cloudinary treats audio as a type of video for storage/transformation
                    public_id: uploadedFile.originalFilename.split('.').slice(0, -1).join('_') // Create a public_id from filename
                });
                
                console.log('[AudioProxy] Cloudinary upload successful. URL:', uploadResult.secure_url);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ audioUrl: uploadResult.secure_url }));

            } catch (uploadError) {
                console.error('[AudioProxy] Error uploading to Cloudinary:', uploadError);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to upload audio to hosting service.', details: uploadError.message || uploadError }));
            } finally {
                fs.unlink(filePath, unlinkErr => {
                    if (unlinkErr) console.error("Error deleting tmp audio file:", unlinkErr);
                });
            }
        });

    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

const PORT = process.env.AUDIO_API_PORT || 3003;
server.listen(PORT, () => {
    console.log(`Audio Upload Proxy Server listening on port ${PORT} for /api/upload-audio`);
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('[Warning] Cloudinary credentials are not fully set. Audio uploads will fail.');
    }
}); 