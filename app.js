const express = require('express');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const fetch = require('node-fetch');
const chromium = require('@sparticuz/chromium');

const app = express();
const port = 3000;

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the current directory (for index.html)
app.use(express.static(__dirname));

// Ensure necessary directories exist
const fontsDir = path.join(__dirname, 'fonts');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir);
}
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
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

app.post('/generate-image', upload.single('background_image_file'), async (req, res) => {
    let browser;
    let uploadedFilePath = null;

    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        const page = await browser.newPage();

        const text = req.body.text || '';
        const backgroundColor = req.body.background_color || '#000000';
        const textColor = req.body.text_color || '#FFFFFF';
        const textSize = parseInt(req.body.text_size) || 48;
        const lineSpacing = parseFloat(req.body.line_spacing) || 1.2;
        const marginTop = parseInt(req.body.margin_top) || 50;
        const marginBottom = parseInt(req.body.margin_bottom) || 50;
        const marginLeft = parseInt(req.body.margin_left) || 50;
        const marginRight = parseInt(req.body.margin_right) || 50;
        const addTextOverlay = req.body.add_text_overlay === 'on';
        const overlayPaddingTop = parseInt(req.body.overlay_padding_top) || 10;
        const overlayPaddingBottom = parseInt(req.body.overlay_padding_bottom) || 10;
        const overlayPaddingLeft = parseInt(req.body.overlay_padding_left) || 20;
        const overlayPaddingRight = parseInt(req.body.overlay_padding_right) || 20;
        const backgroundRepeatY = parseInt(req.body.background_repeat_y) || 1;
        console.log("Add Text Overlay received:", addTextOverlay);

        const backgroundImageChoice = req.body.background_image_choice;
        const backgroundImageUrl = req.body.background_image_url || '';

        let backgroundCss = `background-color: ${backgroundColor};`;

        if (backgroundImageChoice === 'upload' && req.file) {
            uploadedFilePath = req.file.path; // Multer saves it temporarily
            const imageBuffer = fs.readFileSync(uploadedFilePath);
            const mimeType = req.file.mimetype;
            const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
            
            backgroundCss = `background-image: url('${base64Image}');\n`;
            if (backgroundRepeatY > 1) {
                const repeatedImageHeight = imageHeight / backgroundRepeatY; // Calculate height for each repeated segment
                backgroundCss += `background-repeat: repeat-y;\n`;
                backgroundCss += `background-size: ${imageWidth}px ${repeatedImageHeight}px;\n`; // Explicit pixel size
            } else {
                backgroundCss += `background-repeat: no-repeat;\n`;
                backgroundCss += `background-size: cover;\n`;
            }
            backgroundCss += `background-position: center;\n`;
        } else if (backgroundImageChoice === 'url' && backgroundImageUrl) {
            try {
                const response = await fetch(backgroundImageUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
                }
                const imageBuffer = await response.buffer();
                const mimeType = response.headers.get('content-type');
                if (!mimeType || !mimeType.startsWith('image/')) {
                    throw new Error(`URL did not return an image: ${mimeType}`);
                }
                const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

                backgroundCss = `background-image: url('${base64Image}');\n`;
                if (backgroundRepeatY > 1) {
                    const repeatedImageHeight = imageHeight / backgroundRepeatY; // Calculate height for each repeated segment
                    backgroundCss += `background-repeat: repeat-y;\n`;
                    backgroundCss += `background-size: ${imageWidth}px ${repeatedImageHeight}px;\n`; // Explicit pixel size
                } else {
                    backgroundCss += `background-repeat: no-repeat;\n`;
                    backgroundCss += `background-size: cover;\n`;
                }
                backgroundCss += `background-position: center;\n`;
            } catch (fetchError) {
                console.warn(`Warning: Could not fetch background image from URL (${backgroundImageUrl}): ${fetchError.message}`);
                // Fallback to background color if URL image fails
                backgroundCss = `background-color: ${backgroundColor};`;
            }
        }

        const imageWidth = 1080;
        const imageHeight = 1920;

        const effectiveWidth = imageWidth - marginLeft - marginRight;
        const effectiveHeight = imageHeight - marginTop - marginBottom;

        // Create dynamic HTML content
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Image Render</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu&display=swap');

                    body {
                        width: ${imageWidth}px;
                        height: ${imageHeight}px;
                        margin: 0;
                        padding: 0;
                        ${backgroundCss}
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        overflow: hidden;
                        box-sizing: border-box;
                        font-family: ${defaultFontFamily};
                        color: ${textColor};
                        font-size: ${textSize}px;
                        line-height: ${lineSpacing};
                        text-align: center;
                    }
                    .text-container {
                        width: ${effectiveWidth}px;
                        /* Margins are applied directly to the text-container, not padding */
                        margin-top: ${marginTop}px;
                        margin-bottom: ${marginBottom}px;
                        margin-left: ${marginLeft}px;
                        margin-right: ${marginRight}px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        /* Removed height to allow content to dictate height */
                        flex-direction: column;
                        text-align: center;
                        word-wrap: break-word;
                        /* Removed overflow hidden from text-container as it's handled by inner element */
                    }
                    .text-overlay {
                        display: inline-block; /* Makes it wrap content */
                        padding: ${overlayPaddingTop}px ${overlayPaddingRight}px ${overlayPaddingBottom}px ${overlayPaddingLeft}px; /* Adjust as needed: top/bottom 10px, left/right 20px */
                        ${addTextOverlay ? 'background-color: rgba(0, 0, 0, 0.5);' : ''}
                        box-decoration-break: clone; /* Ensures background/padding applies to each line */
                    }
                </style>
            </head>
            <body>
                <div class="text-container">
                    <span class="text-overlay">
                        ${text.replace(/\n/g, '<br>')}
                    </span>
                </div>
            </body>
            </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const screenshotBuffer = await page.screenshot({
            clip: {
                x: 0,
                y: 0,
                width: imageWidth,
                height: imageHeight,
            }
        });

        res.setHeader('Content-Type', 'image/png');
        res.send(screenshotBuffer);

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
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});