const fs = require('fs');
const path = require('path');

// Configuration
const JOKES_FILE = path.join(__dirname, 'jokes.json'); // Relative to this script's location
const YOUTUBE_BASE_URL = 'https://www.youtube.com/watch?v=';

async function main() {
    try {
        const jokesRaw = fs.readFileSync(JOKES_FILE, 'utf8');
        const jokesData = JSON.parse(jokesRaw);
        const jokes = jokesData.jokes; // Access the 'jokes' array

        let updatedCount = 0;

        for (let i = 0; i < jokes.length; i++) {
            const joke = jokes[i];
            // Assuming 'uploadedId' is the field containing the YouTube video ID
            if (joke.uploadId && !joke.youtube_url) {
                const youtubeUrl = YOUTUBE_BASE_URL + joke.uploadId;
                joke.youtube_url = youtubeUrl;
                console.log(`Added YouTube URL for joke ${i + 1} (${joke.title}): ${youtubeUrl}`);
                updatedCount++;
            } else if (joke.youtube_url) {
                console.log(`Joke ${i + 1} (${joke.title}) already has a YouTube URL.`);
            } else if (!joke.uploadedId) {
                console.log(`Joke ${i + 1} (${joke.title}) does not have an 'uploadedId' to generate a YouTube URL.`);
            }
        }

        if (updatedCount > 0) {
            // Write the updated jokes array back to jokes.json
            fs.writeFileSync(JOKES_FILE, JSON.stringify({ jokes: jokes }, null, 2), 'utf8');
            console.log(`jokes.json updated with ${updatedCount} YouTube URLs.`);
        } else {
            console.log('No new YouTube URLs to add to jokes.json.');
        }

        console.log('\n--- YouTube URL Addition Script Complete ---');

    } catch (error) {
        console.error('Error during YouTube URL addition:', error);
    }
}

main(); 