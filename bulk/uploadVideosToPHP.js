const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch'); // You might need to install node-fetch if you haven't already

// Configuration
const JOKES_FILE = path.join(__dirname, 'jokes.json'); // Relative to this script's location
const PHP_UPLOAD_URL = 'http://tawhid.in/tiny/videos/1000videos/day2/upload.php'; // Your deployed PHP upload script URL

async function uploadVideoToPHP(videoPath, jokeTitle) {
    console.log(`Attempting to upload video for: ${jokeTitle}`);

    if (!fs.existsSync(videoPath)) {
        console.error(`Error: Video file not found at ${videoPath}`);
        return null;
    }

    const form = new FormData();
    // The field name 'videoFile' must match what your upload.php script expects ($_FILES['videoFile'])
    form.append('videoFile', fs.createReadStream(videoPath), path.basename(videoPath));

    try {
        const response = await fetch(PHP_UPLOAD_URL, {
            method: 'POST',
            body: form,
            // When using form-data, the 'Content-Type' header with boundary is automatically set.
            // Do NOT manually set 'Content-Type': 'multipart/form-data' as it will cause issues.
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`PHP upload failed for ${jokeTitle}: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
            console.log(`Successfully uploaded video for ${jokeTitle}: ${result.videoPath}`);
            return result.videoPath;
        } else {
            throw new Error(`PHP upload returned error for ${jokeTitle}: ${result.message}`);
        }

    } catch (error) {
        console.error(`Error uploading video for ${jokeTitle}:`, error);
        return null;
    }
}

async function main() {
    try {
        const jokesRaw = fs.readFileSync(JOKES_FILE, 'utf8');
        const jokesData = JSON.parse(jokesRaw);
        const jokes = jokesData.jokes; // Access the 'jokes' array

        const updatedJokes = [];

        for (let i = 0; i < jokes.length; i++) {
            const joke = jokes[i];
            if (joke.local_path && !joke.php_server_path) { // Only upload if local_path exists and php_server_path doesn't
                const phpPath = await uploadVideoToPHP(joke.local_path, joke.title);
                if (phpPath) {
                    joke.php_server_path = phpPath;
                }
            } else if (joke.php_server_path) {
                console.log(`Video for ${joke.title} already has a PHP server path: ${joke.php_server_path}`);
            }
            updatedJokes.push(joke);
        }

        // Write the updated jokes array back to jokes.json
        fs.writeFileSync(JOKES_FILE, JSON.stringify({ jokes: updatedJokes }, null, 2), 'utf8');
        console.log('jokes.json updated with PHP server paths.');

        console.log('\n--- Bulk Video Upload to PHP Server Complete ---');

    } catch (error) {
        console.error('Error during bulk video upload to PHP server:', error);
    }
}

main(); 