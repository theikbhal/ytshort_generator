const express = require('express');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const fetch = require('node-fetch');
// const chromium = require('@sparticuz/chromium'); // Removed for local development
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// Set FFmpeg path for fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Basic check for FFmpeg availability
try {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    console.log(`FFmpeg path set to: ${ffmpegInstaller.path}`);
    // You can also run ffmpeg -version from Node.js to confirm, but this might hang in serverless if not set up correctly.
} catch (e) {
    console.error("FFmpeg is not correctly configured or found. Video generation will fail.", e);
}

const app = express();
const port = 3000;

// Configure Multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for both image and audio
    }
});

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the current directory (for index.html and generated images)
app.use(express.static(__dirname));

// Ensure necessary directories exist
const fontsDir = path.join(__dirname, 'fonts');
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output'); // Directory for temporary images and final videos
const audioDir = path.join(__dirname, 'audio'); // New directory for default audio
const templateDir = path.join(__dirname, 'template'); // New directory for HTML templates

if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir);
}
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir);
}
if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir);
}

// NOTE: With Puppeteer, fonts are generally handled by the browser itself.
// You should ensure that the Chromium instance used by Puppeteer has the necessary
// fonts installed on the system where the Node.js application is running.
// For development on Windows, if you have Noto Sans Telugu installed system-wide,
// Puppeteer should pick it up automatically. If running in a Docker container or a headless Linux server,
// you'll need to ensure the font is installed within that environment.
const defaultFontFamily = '"Noto Sans Telugu", sans-serif';

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/generate', upload.fields([
    { name: 'background_image', maxCount: 1 },
    { name: 'background_music', maxCount: 1 }
]), async (req, res) => {
    try {
        const text = req.body.text || '';
        const backgroundColor = req.body.background_color || '#000000';
        const textColor = req.body.text_color || '#ffffff';
        const fontSize = parseInt(req.body.font_size) || 60;
        const lineSpacing = parseInt(req.body.line_spacing) || 20;
        const marginTop = parseInt(req.body.margin_top) || 0;
        const marginBottom = parseInt(req.body.margin_bottom) || 0;
        const marginLeft = parseInt(req.body.margin_left) || 0;
        const marginRight = parseInt(req.body.margin_right) || 0;
        const backgroundImageSource = req.body.background_image_source || 'none';
        const backgroundImageUrl = req.body.background_image_url;
        const backgroundRepeatY = parseInt(req.body.background_repeat_y) || 1;
        const textAlign = req.body.textAlign || 'left'; // Default to left alignment
        const videoDuration = parseInt(req.body.video_duration) || 5; // Get video duration from the form

        // Hardcoded text overlay properties
        const addTextOverlay = true; // Always enabled
        const overlayPaddingTop = 20;
        const overlayPaddingBottom = 20;
        const overlayPaddingLeft = 15;
        const overlayPaddingRight = 15;

        // No audio element needed for image generation
        let audioElement = ''; // This will be an empty string for image generation

        // Handle background image
        let backgroundImageStyle = '';
        if (backgroundImageSource === 'upload' && req.files && req.files.background_image) {
            const imageBuffer = req.files.background_image[0].buffer;
            const base64Image = imageBuffer.toString('base64');
            const mimeType = req.files.background_image[0].mimetype;
            const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
            console.log('Using uploaded image, size:', imageBuffer.length, 'bytes');
            backgroundImageStyle = `background-image: url('${imageDataUrl}');`;
        } else if (backgroundImageSource === 'url' && backgroundImageUrl) {
            try {
                const response = await fetch(backgroundImageUrl);
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
                const imageBuffer = await response.buffer();
                const base64Image = imageBuffer.toString('base64');
                const mimeType = response.headers.get('content-type') || 'image/jpeg';
                const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
                console.log('Using URL image, size:', imageBuffer.length, 'bytes');
                backgroundImageStyle = `background-image: url('${imageDataUrl}');`;
            } catch (error) {
                console.error('Error fetching background image:', error);
                return res.status(400).send('Error fetching background image');
            }
        }

        // Calculate background size for repeating
        if (backgroundImageStyle && backgroundRepeatY > 1) {
            const imageHeight = 1920 / backgroundRepeatY;
            console.log('Repeating background image:', {
                totalHeight: 1920,
                repeats: backgroundRepeatY,
                segmentHeight: imageHeight
            });
            //background-size: 100% ${imageHeight}px !important;
            backgroundImageStyle += `
background-size: 1024px ${imageHeight}px !important;
                background-repeat: repeat-y !important;
                background-position: center top !important;
            `;
        } else if (backgroundImageStyle) {
            backgroundImageStyle += `
                background-size: cover !important;
                background-repeat: no-repeat !important;
                background-position: center !important;
            `;
        }

        // Construct HTML for Puppeteer
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        width: 1080px;
                        height: 1920px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background-color: ${backgroundColor};
                        ${backgroundImageStyle}
                        /* border: 2px solid red; */ /* Removed Debugging border */
                    }
                    .text-container {
                        text-align: ${textAlign};
                        max-width: 80%;
                        margin: 0 auto;
                        /* border: 2px solid blue; */ /* Removed Debugging border */
                    }
                    .text-content {
                        font-family: 'Noto Sans Telugu', sans-serif;
                        font-size: ${fontSize}px;
                        color: ${textColor};
                        line-height: ${lineSpacing};
                        margin: ${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    .text-overlay {
                        background-color: #000000; /* Always black */
                        padding: ${overlayPaddingTop}px ${overlayPaddingRight}px ${overlayPaddingBottom}px ${overlayPaddingLeft}px;
                        display: inline-block;
                        box-sizing: border-box;
                        border-radius: 10px; /* Rounded corners */
                    }
                </style>
            </head>
            <body>
                <!-- No audio element for image generation -->
                <div class="text-container">
                    <div class="text-content">
                        ${addTextOverlay ? `<span class="text-overlay">${text}</span>` : text}
                    </div>
                </div>
            </body>
            </html>
        `;
        
        console.log('Add Text Overlay enabled (forced for debug):', addTextOverlay);
        console.log('Text Overlay Padding (T,B,L,R):', overlayPaddingTop, overlayPaddingBottom, overlayPaddingLeft, overlayPaddingRight);
        console.log('Final Background Image Style:', backgroundImageStyle);
        console.log('HTML Content sent to Puppeteer:', htmlContent);

        // Save the generated HTML to a file
        const templatePath = path.join(templateDir, 'lasttemplate.html');
        fs.writeFileSync(templatePath, htmlContent);
        console.log('HTML template saved to:', templatePath);

        let browser;
        let uploadedFilePath = null;

        try {
            browser = await puppeteer.launch({
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // **IMPORTANT: Adjust this path for your system**
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            // Generate a unique filename for the image
            const imageFileName = `image_${Date.now()}.png`;
            const imageOutputPath = path.join(outputDir, imageFileName);

            await page.screenshot({
                path: imageOutputPath, // Save to file
                clip: {
                    x: 0,
                    y: 0,
                    width: 1080,
                    height: 1920,
                }
            });

            // Send the image path back to the client for video generation step
            res.json({ imagePath: `/output/${imageFileName}` });

        } catch (error) {
            console.error('Error generating image:', error);
            res.status(500).send('Error generating image');
        } finally {
            if (browser) {
                await browser.close();
            }
            if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
                // Clean up uploaded file after use
                fs.unlinkSync(uploadedFilePath);
            }
        }
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).send('Error generating image');
    }
});

// New route for video generation
app.post('/generate-video', upload.single('musicFile'), async (req, res) => {
    try {
        const imagePath = req.body.imagePath; // Image path from the image generation step
        const videoDuration = parseInt(req.body.videoDuration) || 5; // Default to 5 seconds
        const backgroundMusicSource = req.body.background_music_source || 'none';
        const backgroundMusicUrl = req.body.background_music_url;
        const backgroundMusicLocalPath = req.body.background_music_local_path; // New field for local music path
        let musicInput = null;

        console.log('Video generation request received.');
        console.log('Image Path:', imagePath);
        console.log('Video Duration:', videoDuration);
        console.log('Background Music Source:', backgroundMusicSource);

        if (backgroundMusicSource === 'upload' && req.file) {
            const musicFileName = `music_${Date.now()}_${req.file.originalname}`;
            const musicFilePath = path.join(uploadsDir, musicFileName);
            fs.writeFileSync(musicFilePath, req.file.buffer);
            musicInput = musicFilePath;
            console.log('Uploaded music saved to:', musicInput);
        } else if (backgroundMusicSource === 'url' && backgroundMusicUrl) {
            musicInput = backgroundMusicUrl;
            console.log('Using music URL:', musicInput);
        } else if (backgroundMusicSource === 'local' && backgroundMusicLocalPath) {
            // For local files, we use the path directly
            const fullLocalMusicPath = path.resolve(backgroundMusicLocalPath);
            if (!fs.existsSync(fullLocalMusicPath)) {
                console.error(`Local music file not found: ${fullLocalMusicPath}`);
                return res.status(400).send('Local background music file not found.');
            }
            musicInput = fullLocalMusicPath;
            console.log('Using local music file:', musicInput);
        }

        const outputFileName = `video_${Date.now()}.mp4`;
        const outputFilePath = path.join(outputDir, outputFileName);

        // Ensure the image path is absolute for ffmpeg
        const fullImagePath = path.join(__dirname, imagePath);
        if (!fs.existsSync(fullImagePath)) {
            return res.status(404).send('Generated image not found. Please generate an image first.');
        }

        let command = ffmpeg(fullImagePath)
            .loop(videoDuration) // Loop the image for the specified duration
            // .noAudio(); // Removed: No need to explicitly disable audio from image input

        if (musicInput) {
            console.log('Adding music input to FFmpeg:', musicInput);
            command = command.addInput(musicInput)
                .audioCodec('aac')
                .outputOptions([
                    '-map 0:v',
                    '-map 1:a' // Map audio from the second input (music file)
                ]);
        } else {
            console.log('No music input provided. Generating video without audio.');
            command = command.noAudio(); // Explicitly disable audio if no music input
        }

        command
            .output(outputFilePath)
            .on('start', function(commandLine) {
                console.log('Spawned FFmpeg with command:' + commandLine);
            })
            .on('progress', function(progress) {
                console.log('Processing: ' + progress.percent + '% done');
            })
            .on('end', function() {
                console.log('Video generation finished:', outputFilePath);
                res.json({ videoPath: `/output/${outputFileName}` });
                // Clean up uploaded music file if it was local
                if (backgroundMusicSource === 'upload' && musicInput && fs.existsSync(musicInput)) {
                    fs.unlinkSync(musicInput);
                }
                // Clean up the temporary image file after video generation
                if (fs.existsSync(fullImagePath)) {
                    fs.unlinkSync(fullImagePath);
                }
            })
            .on('error', function(err) {
                console.error('FFmpeg error:', err.message);
                res.status(500).send(`Video generation failed: ${err.message}`);
                // Clean up uploaded music file if it was local
                if (backgroundMusicSource === 'upload' && musicInput && fs.existsSync(musicInput)) {
                    fs.unlinkSync(musicInput);
                }
                // Clean up the temporary image file on error as well
                if (fs.existsSync(fullImagePath)) {
                    fs.unlinkSync(fullImagePath);
                }
            })
            .run();

    } catch (error) {
        console.error('Error in /generate-video endpoint:', error);
        res.status(500).send('Internal server error during video generation.');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});