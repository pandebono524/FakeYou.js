const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// FakeYou API endpoints
const FAKEYOU_BASE_URL = 'https://api.fakeyou.com';
const FAKEYOU_TTS_URL = `${FAKEYOU_BASE_URL}/tts/inference`;
const FAKEYOU_JOB_URL = `${FAKEYOU_BASE_URL}/tts/job`;

// Replace this with your actual FakeYou auth token
const FAKEYOU_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uX3Rva2VuIjoic2Vzc2lvbl85OHA5c2ZodDRiMWRnYmplc216ejV5NWoiLCJ1c2VyX3Rva2VuIjoidXNlcl8xenJxZnpzYjRzMHkxIiwidmVyc2lvbiI6IjMifQ.-uglpvWlKg7XzEP_-diG5cdU0poKX8y2NV-q_qrW_LI';

async function testConvertTextToSpeech() {
    try {
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
                'Authorization': `Bearer ${FAKEYOU_AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            }
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
                    'Authorization': `Bearer ${FAKEYOU_AUTH_TOKEN}`
                }
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