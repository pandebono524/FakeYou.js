# FakeYou.js Text-to-Speech API Wrapper

A Node.js wrapper for the FakeYou Text-to-Speech API that simplifies voice generation and handles the new CDN URL changes from November 2024.

## Features

- **Simple API**: Easy-to-use methods for finding voice models and generating speech
- **CDN Support**: Automatically handles FakeYou's new CDN URLs
- **Retries**: Built-in retry mechanism for handling API failures
- **Caching**: Stores models to reduce API calls
- **Download Support**: Easy file saving with proper error handling
- **Authentication**: Simple login process

## Installation

```bash
npm install fakeyou.ts fs https path
```

## Quick Start

```javascript
const FakeYouTTS = require('./index.js');

async function quickDemo() {
  // Create a client
  const tts = new FakeYouTTS({
    username: "your_username",
    password: "your_password"
  });
  
  try {
    // Generate speech and save to file
    await tts.sayToFile(
      "Mario", // Voice name to search for
      "It's a me, Mario!", // Text to speak
      "./mario_speech.wav" // Output file
    );
    console.log("Audio generated successfully!");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

quickDemo();
```

## API Reference

### Constructor

```javascript
const tts = new FakeYouTTS({
  username: "your_username", // FakeYou credentials
  password: "your_password",
  retries: 3,               // Number of retries for failed API calls
  retryDelay: 1000,         // Milliseconds between retries
  timeout: 30000,           // Timeout for operations
  cacheDir: "./cache"       // Directory for caching
});
```

### Methods

#### `login(username, password)`

Authenticate with FakeYou API.

```javascript
await tts.login("your_username", "your_password");
```

#### `findModels(searchTerm)`

Search for voice models matching the search term.

```javascript
const models = await tts.findModels("Homer Simpson");
console.log(`Found ${models.length} models`);
```

#### `getModel(modelToken)`

Get a specific model by its token ID.

```javascript
const model = await tts.getModel("weight_2c7vq4s9n7x8t9nf11k6ssb93");
```

#### `findModelByName(name)`

Find a model by name (uses partial matching).

```javascript
const model = await tts.findModelByName("Mario");
if (model) {
  console.log(`Found model: ${model.title} (${model.token})`);
}
```

#### `generateTTS(model, text)`

Generate TTS using a model and text.

```javascript
const model = await tts.findModelByName("Mario");
const inference = await tts.generateTTS(model, "It's a me, Mario!");
```

#### `getAudioUrl(inference)`

Get the CDN URL for an inference result.

```javascript
const url = tts.getAudioUrl(inference);
console.log(`Audio URL: ${url}`);
```

#### `downloadTTS(inference, outputPath)`

Download TTS result to a file.

```javascript
await tts.downloadTTS(inference, "./output.wav");
```

#### `sayToFile(modelNameOrToken, text, outputPath)`

Generate and download TTS in one step.

```javascript
// Can use model name
await tts.sayToFile("Mario", "Hello world!", "./mario_hello.wav");

// Or model token
await tts.sayToFile("weight_2c7vq4s9n7x8t9nf11k6ssb93", "Hello world!", "./mario_hello.wav");
```

## Error Handling

All methods that make API calls can throw errors. It's recommended to use try-catch blocks:

```javascript
try {
  await tts.sayToFile("Mario", "Hello world!", "./output.wav");
} catch (error) {
  console.error("TTS generation failed:", error.message);
  
  // Check last error for details
  if (tts.lastError) {
    console.error("Detailed error:", tts.lastError);
  }
}
```

## CDN URL Changes

As of November 2024, FakeYou moved from Google Storage to their own CDN. This wrapper automatically handles this change by:

1. Checking for the `publicBucketWavAudioPath` property
2. Using the new CDN URL format: `https://cdn-2.fakeyou.com/media/...`
3. Providing a fallback for older API responses

## Examples

### Find and List Available Models

```javascript
const FakeYouTTS = require('./index.js');

async function listModels() {
  const tts = new FakeYouTTS({
    username: "your_username",
    password: "your_password"
  });
  
  await tts.login();
  
  // Search for a specific character
  const models = await tts.findModels("mario");
  
  // Print the first 5 results
  models.slice(0, 5).forEach((model, i) => {
    console.log(`[${i}] ${model.title} | ${model.token}`);
  });
}

listModels();
```

### Generate Speech from Multiple Voices

```javascript
const FakeYouTTS = require('./index.js');

async function multiVoiceDemo() {
  const tts = new FakeYouTTS({
    username: "your_username",
    password: "your_password"
  });
  
  // Create an output directory
  const fs = require('fs');
  if (!fs.existsSync('./voices')) {
    fs.mkdirSync('./voices');
  }
  
  // Generate speech with different voices
  const voices = ["Mario", "Homer Simpson", "Donald Trump"];
  const text = "Welcome to my demonstration!";
  
  for (const voice of voices) {
    try {
      console.log(`Generating speech for ${voice}...`);
      await tts.sayToFile(
        voice,
        text,
        `./voices/${voice.replace(/\s+/g, '_').toLowerCase()}.wav`
      );
      console.log(`✓ ${voice} completed`);
    } catch (error) {
      console.error(`✗ ${voice} failed: ${error.message}`);
    }
  }
}

multiVoiceDemo();
```

## License

MIT 