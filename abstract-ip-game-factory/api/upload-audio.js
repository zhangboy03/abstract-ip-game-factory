require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const formidable = require('formidable');
const fs = require('fs');
const { put } = require('@vercel/blob');
const path = require('path'); // Required for originalname

// Remove Cloudinary configuration as it's no longer needed
// if (!cloudinary.config().cloud_name) { ... }

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Restrict later
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            console.error('BLOB_READ_WRITE_TOKEN is not set in environment variables.');
            res.status(500).json({ error: 'Server configuration error: Missing upload API token.' });
            return;
        }

        const form = new formidable.IncomingForm({
            keepExtensions: true,
            uploadDir: '/tmp' // Vercel's temporary directory
        });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error('Error parsing form data for audio:', err);
                res.status(500).json({ error: 'Error processing audio upload.', details: err.message });
                return;
            }

            const audioFile = files.audio;

            if (!audioFile || !audioFile[0]) {
                res.status(400).json({ error: "No audio file provided in 'audio' field." });
                return;
            }

            const uploadedFile = audioFile[0];
            const tempFilePath = uploadedFile.filepath;
            const originalFileName = uploadedFile.originalFilename || 'uploaded-audio';

            console.log(`[VercelBlob] Uploading ${originalFileName} (from ${tempFilePath}) to Vercel Blob...`);

            try {
                const fileBuffer = fs.readFileSync(tempFilePath);
                // Construct a unique pathname, e.g., audio/original-filename-timestamp.ext
                const fileExtension = path.extname(originalFileName);
                const baseFileName = path.basename(originalFileName, fileExtension);
                const blobPathname = `audio/${baseFileName}-${Date.now()}${fileExtension}`;

                const blob = await put(blobPathname, fileBuffer, {
                    access: 'public',
                    contentType: uploadedFile.mimetype, // Pass the mimetype for audio files
                    token: process.env.BLOB_READ_WRITE_TOKEN
                });

                console.log('[VercelBlob] Audio upload successful. URL:', blob.url);
                res.status(200).json({ audioUrl: blob.url });

            } catch (uploadError) {
                console.error('[VercelBlob] Error uploading audio to Vercel Blob:', uploadError);
                res.status(500).json({ error: 'Failed to upload audio to hosting service.', details: uploadError.message });
            } finally {
                fs.unlink(tempFilePath, unlinkErr => {
                    if (unlinkErr) console.error("Error deleting tmp audio file:", tempFilePath, unlinkErr);
                    else console.log("Successfully deleted tmp audio file:", tempFilePath);
                });
            }
        });

    } else {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        res.status(405).json({ error: `Method ${req.method} not allowed.` });
    }
};

// Removed server.listen() and associated console logs
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET should be set in Vercel environment variables. 