# FakeYou.js Text-to-Speech Firebase Cloud Functions

This project provides Firebase Cloud Functions that integrate with the [FakeYou.js](https://fakeyou.com/) API to deliver text-to-speech (TTS) capabilities for your app. The functions are designed for secure, scalable, and asynchronous TTS job handling, suitable for use with React Native, Node.js, or any client that can call Firebase Functions.

---

## Features

- **Authentication:** Login with your FakeYou account credentials.
- **Start TTS Jobs:** Initiate a text-to-speech job with any supported FakeYou voice model.
- **Check Job Status:** Poll for job completion and retrieve the generated audio URL.
- **Idempotency:** Each TTS request uses a unique UUID to prevent duplicate jobs.
- **Secure:** Credentials are processed securely and session is maintained.
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

5. **Deploy the functions:**
   ```bash
   firebase deploy --only functions
   ```

---

## API Overview

### 1. `loginFakeYou`

**Description:**  
Authenticates with FakeYou using username and password.

**Parameters:**
- `username` (string): Your FakeYou account username or email.
- `password` (string): Your FakeYou account password.

**Returns:**
- `success` (boolean)
- `message` (string): Confirmation message.

**Example (Client-side):**
```javascript
const loginFakeYou = firebase.functions().httpsCallable('loginFakeYou');
const result = await loginFakeYou({
    username: "your_fakeyou_email@example.com",
    password: "your_password"
});
// result.data: { success: true, message: "Login successful" }
```

### 2. `convertTextToSpeech`

**Description:**  
Starts a new TTS job on FakeYou. Requires prior authentication via `loginFakeYou`.

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

### 3. `checkConversionStatus`

**Description:**  
Checks the status of a TTS job and returns the audio URL when ready. Requires prior authentication via `loginFakeYou`.

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

- `loginFakeYou` authenticates with your FakeYou account and maintains a session.
- `convertTextToSpeech` starts a new TTS job and returns a job token.
- `checkConversionStatus` checks the job status and returns the audio URL when ready.
- Each TTS request uses a unique UUID for idempotency.
- **Polling:** The client is responsible for polling `checkConversionStatus` until the status is `"complete_success"` and the `audioUrl` is available.
- **Session Management:** The session is maintained in Firestore and in memory, ensuring it persists between function calls.

---

## Authentication Flow

1. Call `loginFakeYou` with your FakeYou account credentials.
2. Once authenticated, use `convertTextToSpeech` to start TTS jobs.
3. Use `checkConversionStatus` to monitor job progress.
4. If you encounter authentication errors, call `loginFakeYou` again to refresh the session.

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

## Complete Usage Example

```javascript
async function generateSpeech(text, modelToken) {
  try {
    // Step 1: Login to FakeYou
    const loginFakeYou = firebase.functions().httpsCallable('loginFakeYou');
    const loginResult = await loginFakeYou({
      username: "your_fakeyou_email@example.com",
      password: "your_password"
    });
    
    if (!loginResult.data.success) {
      throw new Error("Login failed");
    }
    
    // Step 2: Start TTS job
    const convertTextToSpeech = firebase.functions().httpsCallable('convertTextToSpeech');
    const conversionResult = await convertTextToSpeech({
      text: text,
      modelName: modelToken
    });
    
    if (!conversionResult.data.success) {
      throw new Error("Failed to start TTS job");
    }
    
    // Step 3: Poll for completion
    const inferenceToken = conversionResult.data.inferenceToken;
    return await pollForAudio(inferenceToken);
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function pollForAudio(inferenceToken) {
  const checkConversionStatus = firebase.functions().httpsCallable('checkConversionStatus');
  
  let attempts = 0;
  const maxAttempts = 20; // Prevent infinite loops
  
  while (attempts < maxAttempts) {
    const result = await checkConversionStatus({ inferenceToken });
    
    if (result.data.status === 'complete_success' && result.data.audioUrl) {
      // Format the full audio URL
      const fullAudioUrl = `https://storage.googleapis.com/vocodes-public${result.data.audioUrl}`;
      return fullAudioUrl;
    } else if (result.data.status === 'failed') {
      throw new Error("TTS conversion failed");
    }
    
    // Wait before next poll
    await new Promise(res => setTimeout(res, 3000));
    attempts++;
  }
  
  throw new Error("TTS conversion timed out");
}
```

---

## Error Handling

The functions will throw errors in the following cases:
- Missing required parameters
- Invalid credentials
- Session expiry
- API request failures
- Network errors

**Handle these errors appropriately in your client application.**

---

## Troubleshooting & FAQ

**Q: I get an XML error about billing when accessing the audio URL.**  
A: This is a FakeYou server-side issue (their Google Cloud billing is disabled). Wait for them to resolve it.

**Q: How do I get a model token?**  
A: Use the FakeYou website, select a voice, and inspect the network request payload for `tts_model_token`.

**Q: How often do I need to login?**  
A: Login sessions typically last for several hours. If you encounter authentication errors, simply call `loginFakeYou` again.

**Q: Can I use this with any client?**  
A: Yes! Any client that can call Firebase Functions can use this API.

---

## Contact

For questions about this integration, please contact the developer or open an issue. 