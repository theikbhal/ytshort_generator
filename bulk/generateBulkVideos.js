const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const JOKES_FILE = path.join(__dirname, 'jokes.json');
const GENERATE_IMAGE_URL = 'http://localhost:3000/generate';
const GENERATE_VIDEO_URL = 'http://localhost:3000/generate-video';
const DEFAULT_AUDIO_PATH = 'C:\\workspace\\n8n_space\\joke_image_generation\\tryagain\\one\\audio\\Made In Andhra Student Song Thammudu Movie Pawan Kalyan Chandrabose #youtybeshorts [TubeRipper.com].mp3';
const VIDEO_DURATION_SECONDS = 30;

async function generateVideoForJoke(joke, index) {
    console.log(`Generating video for joke ${index + 1}: ${joke.title}`);

    // Step 1: Generate Image
    const imageData = new FormData();
    imageData.append('text', joke.text);
    imageData.append('background_image_source', 'url');
    imageData.append('background_image_url', joke.image_url);
    imageData.append('background_color', '#000000'); // Default background color
    imageData.append('text_color', '#FFFFFF'); // Default text color
    imageData.append('font_size', '48'); // Default font size
    imageData.append('line_spacing', '1.2'); // Default line spacing
    imageData.append('margin_top', '50'); // Default margins
    imageData.append('margin_bottom', '50');
    imageData.append('margin_left', '50');
    imageData.append('margin_right', '50');
    imageData.append('background_repeat_y', '1'); // Default repeat multiplier
    imageData.append('textAlign', 'left'); // Default text alignment
    imageData.append('addTextOverlay', 'on'); // Text overlay enabled by default

    try {
        const imageResponse = await fetch(GENERATE_IMAGE_URL, {
            method: 'POST',
            body: imageData
        });

        if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            throw new Error(`Image generation failed for joke ${index + 1}: ${errorText}`);
        }

        const imageResult = await imageResponse.json();
        const imagePath = imageResult.imagePath;
        console.log(`Image generated for joke ${index + 1}: ${imagePath}`);

        // Step 2: Generate Video
        const videoData = new FormData();
        videoData.append('imagePath', imagePath);
        videoData.append('videoDuration', VIDEO_DURATION_SECONDS.toString());
        videoData.append('background_music_source', 'local');
        videoData.append('background_music_local_path', DEFAULT_AUDIO_PATH);

        const videoResponse = await fetch(GENERATE_VIDEO_URL, {
            method: 'POST',
            body: videoData
        });

        if (!videoResponse.ok) {
            const errorText = await videoResponse.text();
            throw new Error(`Video generation failed for joke ${index + 1}: ${errorText}`);
        }

        const videoResult = await videoResponse.json();
        console.log(`Video generated for joke ${index + 1}: ${videoResult.videoPath}`);
        
        // Construct the full absolute path for local_path
        const fullVideoPath = path.join(__dirname, '..', videoResult.videoPath);
        console.log(`Full video path for joke ${index + 1}: ${fullVideoPath}`);

        return fullVideoPath;

    } catch (error) {
        console.error(`Error processing joke ${index + 1}:`, error);
        return null;
    }
}

async function main() {
    try {
        // Ensure the bulk directory exists
        const bulkDir = path.join(__dirname);
        if (!fs.existsSync(bulkDir)) {
            fs.mkdirSync(bulkDir, { recursive: true });
        }

        const jokesRaw = fs.readFileSync(JOKES_FILE, 'utf8');
        const jokes = JSON.parse(jokesRaw).jokes;

        const generatedVideos = [];
        for (let i = 0; i < jokes.length; i++) {
            const videoPath = await generateVideoForJoke(jokes[i], i);
            if (videoPath) {
                generatedVideos.push({ joke: jokes[i].title, videoPath: videoPath });
                // Update the joke object with the local path
                jokes[i].local_path = videoPath;
            }
        }

        // Write the updated jokes array back to jokes.json
        fs.writeFileSync(JOKES_FILE, JSON.stringify({ jokes: jokes }, null, 2), 'utf8');
        console.log('jokes.json updated with local video paths.');

        console.log('\n--- Bulk Video Generation Complete ---');
        console.log('Generated Videos:', generatedVideos);

    } catch (error) {
        console.error('Error during bulk video generation:', error);
    }
}

main(); 