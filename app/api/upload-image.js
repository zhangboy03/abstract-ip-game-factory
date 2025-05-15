require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const http = require('http');
const formidable = require('formidable');
const fs = require('fs');
const fetch = require('node-fetch'); // Use node-fetch v2 for CommonJS
const FormData = require('form-data'); // Use require for form-data

const PICGO_API_KEY = process.env.PICGO_API_KEY;
const PICGO_UPLOAD_URL = 'https://www.picgo.net/api/1/upload'; // Make sure this is correct

const server = http.createServer(async (req, res) => {
    // Set CORS headers for all responses from this proxy
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080'); // Adjust if your frontend runs on a different port
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight request for POST
    if (req.method === 'OPTIONS' && req.url === '/api/upload-image') {
        res.writeHead(204); // No Content
        res.end();
        return;
    }

    // Handle actual POST request
    if (req.method === 'POST' && req.url === '/api/upload-image') {
        if (!PICGO_API_KEY) {
            console.error('PICGO_API_KEY is not set in environment variables.');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server configuration error: Missing upload API key.' }));
            return;
        }

        // Correct initialization for formidable v3+
        const form = new formidable.IncomingForm({ keepExtensions: true });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error('Error parsing form data:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Error processing upload.', details: err.message }));
                return;
            }

            const imageFile = files.source; // Assuming the input name is 'source'

            if (!imageFile || !imageFile[0]) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "No image file provided in 'source' field." }));
                return;
            }
            
            const uploadedFile = imageFile[0];

            // Prepare FormData for PicGo API
            const picGoFormData = new FormData(); // Create FormData instance
            const fileStream = fs.createReadStream(uploadedFile.filepath);
            const fileName = uploadedFile.originalFilename;
            picGoFormData.append('source', fileStream, fileName); // Append stream with filename
            picGoFormData.append('format', 'txt');

            console.log(`[Proxy] Uploading ${uploadedFile.originalFilename} to PicGo...`);

            try {
                const picGoResponse = await fetch(PICGO_UPLOAD_URL, {
                    method: 'POST',
                    headers: {
                        'X-API-Key': PICGO_API_KEY,
                        // Content-Type is set automatically by node-fetch when body is FormData
                        ...picGoFormData.getHeaders() // Important for boundary
                    },
                    body: picGoFormData
                });

                const responseBodyText = await picGoResponse.text();

                if (picGoResponse.ok) {
                    // Check if the response body looks like a URL
                    if (responseBodyText && (responseBodyText.startsWith('http://') || responseBodyText.startsWith('https://'))) {
                        console.log('[Proxy] PicGo upload successful. URL:', responseBodyText);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ imageUrl: responseBodyText.trim() })); // Trim potential whitespace
                    } else {
                        // PicGo returned 200 OK but the body doesn't look like a URL
                        console.error('[Proxy] PicGo returned OK status but unexpected body:', responseBodyText);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Image hosting service returned unexpected response.', details: responseBodyText }));
                    }
                } else {
                    console.error('[Proxy] PicGo API Error:', picGoResponse.status, responseBodyText);
                    res.writeHead(picGoResponse.status, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Image hosting service returned an error.', details: responseBodyText }));
                }
            } catch (fetchError) {
                console.error('[Proxy] Error fetching PicGo API:', fetchError);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to connect to image hosting service.', details: fetchError.message }));
            } finally {
                 // Clean up the temporary file saved by formidable
                 fs.unlink(uploadedFile.filepath, unlinkErr => {
                    if (unlinkErr) console.error("Error deleting tmp file:", unlinkErr);
                 });
            }
        });

    } else {
        // Handle requests to other paths or methods
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

const PORT = process.env.UPLOAD_API_PORT || 3002;
server.listen(PORT, () => {
    console.log(`Image Upload Proxy Server listening on port ${PORT} for /api/upload-image`);
    if (!PICGO_API_KEY) {
        console.warn('[Warning] PICGO_API_KEY is not set. Uploads will fail.');
    }
}); 