const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// FakeYou API endpoints
const FAKEYOU_BASE_URL = 'https://api.fakeyou.com';
const FAKEYOU_LOGIN_URL = `${FAKEYOU_BASE_URL}/login`;
const FAKEYOU_TTS_URL = `${FAKEYOU_BASE_URL}/tts/inference`;
const FAKEYOU_JOB_URL = `${FAKEYOU_BASE_URL}/tts/job`;

// Replace these with your actual FakeYou credentials
const FAKEYOU_USERNAME = 'YOUR_FAKEYOU_USERNAME';
const FAKEYOU_PASSWORD = 'YOUR_FAKEYOU_PASSWORD';

// Store the session cookie
let sessionCookie = null;

async function login() {
    try {
        console.log('Logging in to FakeYou...');
        
        // Prepare the login payload
        const payload = {
            username_or_email: FAKEYOU_USERNAME,
            password: FAKEYOU_PASSWORD
        };

        // Make the login API call
        const response = await axios.post(FAKEYOU_LOGIN_URL, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            withCredentials: true
        });

        // Extract and store the session cookie
        if (response.headers['set-cookie']) {
            sessionCookie = response.headers['set-cookie'];
            console.log('Login successful! Session cookie obtained.');
            return true;
        } else {
            console.error('Failed to obtain session cookie');
            return false;
        }
    } catch (error) {
        console.error('Login Error:', error.response ? error.response.data : error.message);
        return false;
    }
}

async function testConvertTextToSpeech() {
    try {
        // Make sure we're logged in
        if (!sessionCookie) {
            const loginSuccess = await login();
            if (!loginSuccess) {
                console.error('Cannot proceed without login');
                return;
            }
        }

        // Test data
        const testData = {
            text: "Hello, this is a test message",
            modelName: "weight_7jk8mgwkzsycqrxmfw5q4245y"
        };

        // Prepare the request payload
        const payload = {
            tts_model_token: testData.modelName,
            inference_text: testData.text,
            uuid_idempotency_token: uuidv4()
        };

        console.log('Sending request to FakeYou API...');
        
        // Make the API call
        const response = await axios.post(FAKEYOU_TTS_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Cookie': sessionCookie
            },
            withCredentials: true
        });

        console.log('Response:', response.data);

        if (response.data.success) {
            const inferenceToken = response.data.inference_job_token;
            console.log('Inference Token:', inferenceToken);
            
            // Poll for status
            await pollUntilComplete(inferenceToken);
        }

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

async function pollUntilComplete(inferenceToken) {
    const pollInterval = 3000; // 3 seconds
    let isComplete = false;
    while (!isComplete) {
        try {
            console.log('\nChecking conversion status...');
            const response = await axios.get(`${FAKEYOU_JOB_URL}/${inferenceToken}`, {
                headers: {
                    'Cookie': sessionCookie
                },
                withCredentials: true
            });
            const data = response.data;
            console.log('Status Response:', data);
            if (data.success && data.state.status === 'complete_success' && data.state.maybe_public_bucket_wav_audio_path) {
                console.log('\n✅ Conversion complete! Audio URL:');
                console.log(data.state.maybe_public_bucket_wav_audio_path);
                isComplete = true;
            } else if (data.success && data.state.status === 'failed') {
                console.error('\n❌ Conversion failed.');
                isComplete = true;
            } else {
                // Wait and poll again
                await new Promise(res => setTimeout(res, pollInterval));
            }
        } catch (error) {
            console.error('Error:', error.response ? error.response.data : error.message);
            // Wait and try again
            await new Promise(res => setTimeout(res, pollInterval));
        }
    }
}

// Run the test
testConvertTextToSpeech(); 