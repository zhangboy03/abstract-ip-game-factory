require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const formidable = require('formidable');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');

// Configure Cloudinary - this should be done once, ideally not inside the handler if it can be top-level.
// However, process.env might not be populated during Vercel's global scope initialization for all vars in some cases,
// so keeping it here for now, but it will re-run config on every invocation. Safe, but slightly less optimal.
// A better pattern is to ensure config is called once, e.g. in a separate config file or a top-level IIFE.
if (!cloudinary.config().cloud_name) { // Configure only if not already configured
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Restrict later
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'POST') {
        // Re-check Cloudinary config at invocation time to ensure env vars are loaded
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('Cloudinary credentials are not fully set in environment variables.');
            // Ensure Cloudinary is configured with whatever is available, or it might throw during form.parse if used before this check
            if (!cloudinary.config().cloud_name) {
                 try {
                    cloudinary.config({
                        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                        api_key: process.env.CLOUDINARY_API_KEY,
                        api_secret: process.env.CLOUDINARY_API_SECRET,
                        secure: true
                    });
                 } catch (configError) {
                    console.error("Error trying to re-init cloudinary config on missing env vars:", configError);
                 }
            }
            res.status(500).json({ error: 'Server configuration error: Missing audio upload service credentials.' });
            return;
        }
        
        // Ensure cloudinary is configured before parsing form data that might use it
        // (redundant if top-level config worked, but safe)
        if (!cloudinary.config().cloud_name) {
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
                secure: true
            });
        }

        const form = new formidable.IncomingForm({ 
            keepExtensions: true,
            uploadDir: '/tmp' // Use Vercel's temporary directory
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

            console.log(`[AudioProxy] Uploading ${uploadedFile.originalFilename} (from ${tempFilePath}) to Cloudinary...`);

            try {
                const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
                    resource_type: 'video', 
                    public_id: uploadedFile.originalFilename.split('.').slice(0, -1).join('_') 
                });
                
                console.log('[AudioProxy] Cloudinary upload successful. URL:', uploadResult.secure_url);
                res.status(200).json({ audioUrl: uploadResult.secure_url });

            } catch (uploadError) {
                console.error('[AudioProxy] Error uploading to Cloudinary:', uploadError);
                let errorDetails = 'Unknown error during Cloudinary upload.';
                if (uploadError instanceof Error) {
                    errorDetails = uploadError.message;
                } else if (typeof uploadError === 'string') {
                    errorDetails = uploadError;
                } else if (uploadError && typeof uploadError.message === 'string'){
                    errorDetails = uploadError.message;
                }
                res.status(500).json({ error: 'Failed to upload audio to hosting service.', details: errorDetails });
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