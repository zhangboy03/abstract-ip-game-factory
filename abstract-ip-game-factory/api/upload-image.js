require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const formidable = require('formidable');
const fs = require('fs');
const fetch = require('node-fetch'); // Use node-fetch v2 for CommonJS
const FormData = require('form-data'); // Use require for form-data

const PICGO_API_KEY = process.env.PICGO_API_KEY;
const PICGO_UPLOAD_URL = 'https://www.picgo.net/api/1/upload'; // Make sure this is correct

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Restrict later
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        if (!PICGO_API_KEY) {
            console.error('PICGO_API_KEY is not set in environment variables.');
            res.status(500).json({ error: 'Server configuration error: Missing upload API key.' });
            return;
        }

        // formidable needs the raw req object to parse form data.
        // Vercel provides this req object.
        const form = new formidable.IncomingForm({ 
            keepExtensions: true,
            uploadDir: '/tmp' // Explicitly use /tmp for Vercel's temporary storage
        });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error('Error parsing form data:', err);
                res.status(500).json({ error: 'Error processing upload.', details: err.message });
                return;
            }

            const imageFile = files.source; 

            if (!imageFile || !imageFile[0]) {
                res.status(400).json({ error: "No image file provided in 'source' field." });
                return;
            }
            
            const uploadedFile = imageFile[0];
            const tempFilePath = uploadedFile.filepath; // Path to the file in /tmp

            const picGoFormData = new FormData();
            const fileStream = fs.createReadStream(tempFilePath);
            const fileName = uploadedFile.originalFilename;
            picGoFormData.append('source', fileStream, fileName); 
            picGoFormData.append('format', 'txt');

            console.log(`[Proxy] Uploading ${uploadedFile.originalFilename} (from ${tempFilePath}) to PicGo...`);

            try {
                const picGoResponse = await fetch(PICGO_UPLOAD_URL, {
                    method: 'POST',
                    headers: {
                        'X-API-Key': PICGO_API_KEY,
                        ...picGoFormData.getHeaders()
                    },
                    body: picGoFormData
                });

                const responseBodyText = await picGoResponse.text();

                if (picGoResponse.ok) {
                    if (responseBodyText && (responseBodyText.startsWith('http://') || responseBodyText.startsWith('https://'))) {
                        console.log('[Proxy] PicGo upload successful. URL:', responseBodyText);
                        res.status(200).json({ imageUrl: responseBodyText.trim() });
                    } else {
                        console.error('[Proxy] PicGo returned OK status but unexpected body:', responseBodyText);
                        res.status(500).json({ error: 'Image hosting service returned unexpected response.', details: responseBodyText });
                    }
                } else {
                    console.error('[Proxy] PicGo API Error:', picGoResponse.status, responseBodyText);
                    res.status(picGoResponse.status || 500).json({ error: 'Image hosting service returned an error.', details: responseBodyText });
                }
            } catch (fetchError) {
                console.error('[Proxy] Error fetching PicGo API:', fetchError);
                res.status(500).json({ error: 'Failed to connect to image hosting service.', details: fetchError.message });
            } finally {
                 fs.unlink(tempFilePath, unlinkErr => {
                    if (unlinkErr) console.error("Error deleting tmp file:", tempFilePath, unlinkErr);
                    else console.log("Successfully deleted tmp file:", tempFilePath);
                 });
            }
        });
    } else {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        res.status(405).json({ error: `Method ${req.method} not allowed.` });
    }
};

// Removed server.listen() and associated console logs
// PICGO_API_KEY should be set in Vercel environment variables. 