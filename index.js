/**
 * FakeYou TTS API Wrapper
 * 
 * Handles text-to-speech generation using the FakeYou API
 * Fixed to work with the new CDN URL (Nov 2024 change)
 * 
 * @author Bernie
 * @version 1.2.1
 */

const FakeYou = require("fakeyou.ts").default;
const fs = require("fs");
const https = require("https");
const path = require("path");

// FakeYou updated their CDN URL in November 2024
const CDN_URL = "https://cdn-2.fakeyou.com";

// Keep track of login status
let loggedIn = false;

// Helper for downloading files - we need this since their API doesn't 
// always handle the downloads correctly
function downloadAudioFile(url, savePath) {
  // Create dirs if they don't exist
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(savePath);
    
    https.get(url, (response) => {
      // Handle redirects if needed
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadAudioFile(response.headers.location, savePath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      response.pipe(file);
      
      file.on("finish", () => {
        file.close();
        resolve(true);
      });
      
      response.on("error", (err) => {
        fs.unlink(savePath, () => {}); // Clean up failed file
        reject(err);
      });
    }).on("error", (err) => {
      fs.unlink(savePath, () => {}); // Clean up failed file
      reject(err);
    });
  });
}

/**
 * Main FakeYou TTS class
 */
class FakeYouTTS {
  constructor(opts = {}) {
    this.client = new FakeYou();
    this.username = opts.username || null;
    this.password = opts.password || null;
    this.loggedIn = false;
    this.lastError = null;
    
    // Default options
    this.options = {
      retries: opts.retries || 3,
      retryDelay: opts.retryDelay || 1000,
      timeout: opts.timeout || 30000,
      cacheDir: opts.cacheDir || "./cache",
    };
    
    // Track models we've already fetched to avoid duplicate API calls
    this._modelCache = {};
    
    // Try to login on init if credentials provided
    if (this.username && this.password) {
      // Do login async - don't wait for it
      this.login().catch(e => {
        console.warn("Auto-login failed:", e.message);
      });
    }
  }
  
  /**
   * Log in to FakeYou
   */
  async login(username = null, password = null) {
    // Use provided credentials or fall back to constructor values
    const user = username || this.username;
    const pass = password || this.password;
    
    if (!user || !pass) {
      throw new Error("No credentials provided for login");
    }
    
    try {
      await this.client.login({
        username: user,
        password: pass
      });
      
      this.loggedIn = true;
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = err;
      this.loggedIn = false;
      // Re-throw with better message
      throw new Error(`FakeYou login failed: ${err.message}`);
    }
  }
  
  /**
   * Find voice models by search term
   */
  async findModels(searchTerm) {
    // Try to use cached results first
    const cacheKey = `search_${searchTerm}`;
    if (this._modelCache[cacheKey]) {
      return this._modelCache[cacheKey];
    }
    
    try {
      // Handle empty search specially - fakeyou.ts behaves weird with empty searches
      if (!searchTerm || searchTerm.trim() === '') {
        searchTerm = 'a'; // Just search for something common
      }
      
      const modelsMap = await this.client.fetchTtsModels(searchTerm);
      
      if (!modelsMap) {
        throw new Error("No models returned from API");
      }
      
      // Convert Map to Array for easier use
      const models = Array.from(modelsMap.values());
      
      // Cache this search result
      this._modelCache[cacheKey] = models;
      
      return models;
    } catch (err) {
      console.error(`Error finding models for "${searchTerm}":`, err);
      return [];
    }
  }
  
  /**
   * Get a model by its exact token
   */
  async getModel(modelToken) {
    // Check cache first
    if (this._modelCache[modelToken]) {
      return this._modelCache[modelToken];
    }
    
    try {
      // TODO: This is inefficient but the API doesn't have a direct "get by ID" endpoint
      //       Look into a better way to do this in the future
      const models = await this.findModels("");
      const model = models.find(m => m.token === modelToken);
      
      if (model) {
        // Cache for future use
        this._modelCache[modelToken] = model;
      }
      
      return model || null;
    } catch (err) {
      console.error(`Failed to get model ${modelToken}:`, err);
      return null;
    }
  }
  
  /**
   * Find a model by name (partial match)
   * Returns the best matching model or null if none found
   */
  async findModelByName(name) {
    try {
      // Check if we're logged in
      if (!this.loggedIn && this.username && this.password) {
        await this.login();
      }
      
      const models = await this.findModels(name);
      
      if (!models || models.length === 0) {
        return null;
      }
      
      // Try to match by name (case insensitive)
      const nameLower = name.toLowerCase();
      
      // Try exact match first
      let match = models.find(m => 
        m.title && m.title.toLowerCase() === nameLower
      );
      
      // If no exact match, try includes
      if (!match) {
        match = models.find(m => 
          m.title && m.title.toLowerCase().includes(nameLower)
        );
      }
      
      // If still no match, just use the first result
      if (!match && models.length > 0) {
        match = models[0];
      }
      
      return match;
    } catch (err) {
      console.error(`Error finding model by name "${name}":`, err);
      return null;
    }
  }
  
  /**
   * Generate TTS from text
   */
  async generateTTS(model, text) {
    if (!model) {
      throw new Error("No model provided for TTS generation");
    }
    
    if (!text || text.trim() === '') {
      throw new Error("No text provided for TTS generation");
    }
    
    let retries = this.options.retries;
    
    while (retries >= 0) {
      try {
        const result = await model.infer(text);
        return result;
      } catch (err) {
        retries--;
        
        // If we're out of retries, throw the error
        if (retries < 0) {
          throw new Error(`TTS generation failed after ${this.options.retries} attempts: ${err.message}`);
        }
        
        // Wait before retrying
        await new Promise(r => setTimeout(r, this.options.retryDelay));
      }
    }
  }
  
  /**
   * Get the CDN URL for a TTS result
   */
  getAudioUrl(inference) {
    if (!inference) return null;
    
    // Get the path from the inference result
    if (inference.publicBucketWavAudioPath) {
      // Use the new CDN URL with the path
      return `${CDN_URL}${inference.publicBucketWavAudioPath}`;
    }
    
    // Fall back to resourceUrl if available
    if (inference.resourceUrl) {
      // Check if resourceUrl uses the old CDN
      if (inference.resourceUrl.includes('storage.googleapis.com')) {
        // Extract path and use new CDN
        const pathMatch = inference.resourceUrl.match(/\/media\/.*\.wav$/);
        if (pathMatch) {
          return `${CDN_URL}${pathMatch[0]}`;
        }
      }
      return inference.resourceUrl;
    }
    
    // We couldn't find a valid URL
    return null;
  }
  
  /**
   * Download a TTS result to a file
   */
  async downloadTTS(inference, outputPath) {
    const url = this.getAudioUrl(inference);
    
    if (!url) {
      throw new Error("Could not determine audio URL");
    }
    
    try {
      await downloadAudioFile(url, outputPath);
      return outputPath;
    } catch (err) {
      throw new Error(`Failed to download audio: ${err.message}`);
    }
  }
  
  /**
   * Shortcut method to generate and download TTS in one go
   */
  async sayToFile(modelNameOrToken, text, outputPath) {
    let model;
    
    // Check if it's a model token or name
    if (modelNameOrToken.startsWith('weight_')) {
      model = await this.getModel(modelNameOrToken);
    } else {
      model = await this.findModelByName(modelNameOrToken);
    }
    
    if (!model) {
      throw new Error(`Could not find model: ${modelNameOrToken}`);
    }
    
    const inference = await this.generateTTS(model, text);
    return await this.downloadTTS(inference, outputPath);
  }
}

module.exports = FakeYouTTS;
