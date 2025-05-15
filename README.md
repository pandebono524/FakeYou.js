# FakeYou.js Text-to-Speech Firebase Cloud Functions

This project provides Firebase Cloud Functions that integrate with the [FakeYou.js](https://fakeyou.com/) API to deliver text-to-speech (TTS) capabilities for your app. The functions are designed for secure, scalable, and asynchronous TTS job handling, suitable for use with React Native, Node.js, or any client that can call Firebase Functions.

---

## Features

- **Start TTS Jobs:** Initiate a text-to-speech job with any supported FakeYou voice model.
- **Check Job Status:** Poll for job completion and retrieve the generated audio URL.
- **Idempotency:** Each TTS request uses a unique UUID to prevent duplicate jobs.
- **Secure:** Auth token is stored in Firebase config, not in code.
- **Robust Error Handling:** Clear error messages for all failure scenarios.

---

## Setup Instructions

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase Functions (if not already):**
   ```bash
   firebase init functions
   ```

4. **Install dependencies:**
   ```bash
   cd functions
   npm install
   ```

5. **Set up your FakeYou authentication token:**
   ```bash
   firebase functions:config:set fakeyou.auth_token="YOUR_FAKEYOU_AUTH_TOKEN"
   ```

6. **Deploy the functions:**
   ```bash
   firebase deploy --only functions
   ```

---

## API Overview

### 1. `convertTextToSpeech`

**Description:**  
Starts a new TTS job on FakeYou.

**Parameters:**
- `text` (string): The text to convert to speech.
- `modelName` (string): The FakeYou model token (voice) to use.

**Returns:**
- `success` (boolean)
- `inferenceToken` (string): Use this to check job status.
- `status` (string): Usually `"processing"`.

**Example (Client-side):**
```javascript
const convertTextToSpeech = firebase.functions().httpsCallable('convertTextToSpeech');
const result = await convertTextToSpeech({
    text: "Hello, this is a test",
    modelName: "YOUR_MODEL_TOKEN"
});
// result.data: { success: true, inferenceToken: "...", status: "processing" }
```

---

### 2. `checkConversionStatus`

**Description:**  
Checks the status of a TTS job and returns the audio URL when ready.

**Parameters:**
- `inferenceToken` (string): The job token returned by `convertTextToSpeech`.

**Returns:**
- `success` (boolean)
- `status` (string): `"pending"`, `"complete_success"`, or `"failed"`
- `audioUrl` (string|null): The audio file path or URL (when ready).

**Example (Client-side):**
```javascript
const checkConversionStatus = firebase.functions().httpsCallable('checkConversionStatus');
const result = await checkConversionStatus({ inferenceToken: "..." });
// result.data: { success: true, status: "...", audioUrl: "..." }
```

---

## How the Functions Work

- `convertTextToSpeech` starts a new TTS job and returns a job token.
- `checkConversionStatus` checks the job status and returns the audio URL when ready.
- Each TTS request uses a unique UUID for idempotency.
- **Polling:** The client is responsible for polling `checkConversionStatus` until the status is `"complete_success"` and the `audioUrl` is available.

---

## Audio URL Handling

- The `audioUrl` returned may be a **relative path** (e.g. `/media/...wav`).
- To access the audio, prepend `https://storage.googleapis.com/vocodes-public` to the path:
  ```
  https://storage.googleapis.com/vocodes-public/media/...wav
  ```
- If you get an XML error about billing, this is an issue on FakeYou's side, not your code.

---

## Status Values

- `"pending"`: The job is still processing.
- `"complete_success"`: The job is finished and the audio is ready.
- `"failed"`: The job failed (see error details).

---

## Polling Example (Client Side)

```javascript
async function pollForAudio(inferenceToken) {
  let done = false;
  while (!done) {
    const result = await checkConversionStatus({ inferenceToken });
    if (result.data.status === 'complete_success' && result.data.audioUrl) {
      // Play or download audio
      done = true;
    } else if (result.data.status === 'failed') {
      // Handle failure
      done = true;
    } else {
      await new Promise(res => setTimeout(res, 3000));
    }
  }
}
```

---

## Error Handling

The functions will throw errors in the following cases:
- Missing required parameters
- Invalid authentication token
- API request failures
- Network errors

**Handle these errors appropriately in your client application.**

---

## Troubleshooting & FAQ

**Q: I get an XML error about billing when accessing the audio URL.**  
A: This is a FakeYou server-side issue (their Google Cloud billing is disabled). Wait for them to resolve it.

**Q: How do I get a model token?**  
A: Use the FakeYou website, select a voice, and inspect the network request payload for `tts_model_token`.

**Q: Can I use this with any client?**  
A: Yes! Any client that can call Firebase Functions can use this API.

---

## Contact

For questions about this integration, please contact the developer or open an issue. 