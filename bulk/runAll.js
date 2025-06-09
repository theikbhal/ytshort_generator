const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Function to run a script and wait for completion
function runScript(scriptPath) {
    return new Promise((resolve, reject) => {
        console.log(`Running script: ${scriptPath}`);
        exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${scriptPath}:`, error);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`stderr from ${scriptPath}:`, stderr);
            }
            console.log(`stdout from ${scriptPath}:`, stdout);
            resolve();
        });
    });
}

// Function to upload JSON file
async function uploadJsonFile() {
    try {
        const jsonPath = path.join(__dirname, 'jokes.json');
        const jsonData = fs.readFileSync(jsonPath, 'utf8');
        
        // Create filename with datetime
        const now = new Date();
        const dateTimeStr = now.toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .replace('Z', '');
        const filename = `jokes_youtube_url_${dateTimeStr}.json`;

        const uploadUrl = `https://tawhid.in/tiny/videos/1000videos/day2/upload_json.php?filename=${filename}`;
        
        console.log('Uploading JSON file to:', uploadUrl);
        
        const response = await axios.post(uploadUrl, jsonData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Upload response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error uploading JSON file:', error.message);
        throw error;
    }
}

// Main function to run all operations in sequence
async function runAll() {
    try {
        // 1. Run generateBulkVideos.js
        console.log('Step 1: Generating bulk videos...');
        await runScript(path.join(__dirname, 'generateBulkVideos.js'));
        
        // 2. Run uploadVideosToPHP.js
        console.log('Step 2: Uploading videos to PHP server...');
        await runScript(path.join(__dirname, 'uploadVideosToPHP.js'));
        
        // 3. Upload jokes.json
        console.log('Step 3: Uploading jokes.json...');
        await uploadJsonFile();
        
        console.log('All operations completed successfully!');
    } catch (error) {
        console.error('Error in runAll:', error);
        process.exit(1);
    }
}

// Run the main function
runAll(); 