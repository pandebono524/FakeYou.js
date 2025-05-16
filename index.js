/**
 * Firebase Cloud Functions for FakeYou.js Text-to-Speech Integration
 * 
 * This module provides three callable functions:
 * 1. loginFakeYou: Authenticates with FakeYou using username and password
 * 2. convertTextToSpeech: Starts a TTS job on FakeYou and returns a job token.
 * 3. checkConversionStatus: Checks the status of a TTS job and returns the audio URL when ready.
 * 
 * Features:
 * - Uses UUID for idempotency.
 * - Authenticates with FakeYou using account credentials
 * - Robust error handling and clear responses.
 * 
 * Author: [Your Name/Company]
 * Date: [YYYY-MM-DD]
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();

// --- Constants ---
const FAKEYOU_BASE_URL = "https://api.fakeyou.com";
const FAKEYOU_LOGIN_URL = `${FAKEYOU_BASE_URL}/login`;
const FAKEYOU_TTS_URL = `${FAKEYOU_BASE_URL}/tts/inference`;
const FAKEYOU_JOB_URL = `${FAKEYOU_BASE_URL}/tts/job`;

// Store session data
let sessionCookie = null;

/**
 * Callable function: loginFakeYou
 * 
 * Authenticates with FakeYou using username and password.
 * 
 * @param {Object} data - The request data.
 * @param {string} data.username - FakeYou account username/email.
 * @param {string} data.password - FakeYou account password.
 * @returns {Object} - { success, message }
 */
exports.loginFakeYou = functions.https.onCall(async (data, context) => {
  try {
    // Validate input
    if (!data.username || !data.password) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Username and password are required"
      );
    }

    // Prepare the login payload
    const payload = {
      username_or_email: data.username,
      password: data.password
    };

    // Make the login API call to FakeYou
    const response = await axios.post(FAKEYOU_LOGIN_URL, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      withCredentials: true
    });

    // Extract and store the session cookie
    if (response.headers['set-cookie']) {
      sessionCookie = response.headers['set-cookie'];
      
      // Store credentials in Firestore for persistence across function instances
      await admin.firestore().collection('fakeyou').doc('session').set({
        cookie: sessionCookie,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        success: true,
        message: "Login successful"
      };
    } else {
      throw new functions.https.HttpsError(
        "internal",
        "Failed to obtain session from FakeYou"
      );
    }
  } catch (error) {
    // Log and rethrow as Firebase error
    console.error("Error in loginFakeYou:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Unknown error"
    );
  }
});

/**
 * Get session cookie from Firestore if not already in memory
 * @returns {Promise<string>} The session cookie
 */
async function getSessionCookie() {
  // If we have a session in memory, use it
  if (sessionCookie) {
    return sessionCookie;
  }
  
  // Try to retrieve from Firestore
  const sessionDoc = await admin.firestore().collection('fakeyou').doc('session').get();
  
  if (sessionDoc.exists) {
    sessionCookie = sessionDoc.data().cookie;
    return sessionCookie;
  }
  
  throw new Error("No active session found. Please login first.");
}

/**
 * Callable function: convertTextToSpeech
 * 
 * Starts a new TTS job on FakeYou.
 * 
 * @param {Object} data - The request data.
 * @param {string} data.text - The text to convert to speech.
 * @param {string} data.modelName - The FakeYou model token (voice) to use.
 * @returns {Object} - { success, inferenceToken, status }
 */
exports.convertTextToSpeech = functions.https.onCall(async (data, context) => {
  try {
    // Validate input
    if (!data.text || !data.modelName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Text and model name are required"
      );
    }

    // Get session cookie
    const cookie = await getSessionCookie();
    
    // Prepare the request payload with a unique UUID for idempotency
    const payload = {
      tts_model_token: data.modelName,
      inference_text: data.text,
      uuid_idempotency_token: uuidv4(),
    };

    // Make the API call to FakeYou
    const response = await axios.post(FAKEYOU_TTS_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookie
      },
      withCredentials: true
    });

    // Handle FakeYou response
    if (response.data.success) {
      return {
        success: true,
        inferenceToken: response.data.inference_job_token,
        status: "processing",
      };
    } else {
      throw new functions.https.HttpsError(
        "internal",
        "Failed to initiate text-to-speech conversion"
      );
    }
  } catch (error) {
    // Log and rethrow as Firebase error
    console.error("Error in convertTextToSpeech:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Unknown error"
    );
  }
});

/**
 * Callable function: checkConversionStatus
 * 
 * Checks the status of a TTS job and returns the audio URL when ready.
 * 
 * @param {Object} data - The request data.
 * @param {string} data.inferenceToken - The job token returned by convertTextToSpeech.
 * @returns {Object} - { success, status, audioUrl }
 */
exports.checkConversionStatus = functions.https.onCall(
  async (data, context) => {
    try {
      // Validate input
      if (!data.inferenceToken) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Inference token is required"
        );
      }

      // Get session cookie
      const cookie = await getSessionCookie();

      // Make the API call to check job status
      const response = await axios.get(
        `${FAKEYOU_JOB_URL}/${data.inferenceToken}`,
        {
          headers: {
            "Cookie": cookie
          },
          withCredentials: true
        }
      );

      // Handle FakeYou response
      if (response.data.success) {
        const status = response.data.state.status;
        const audioUrl = response.data.state.maybe_public_bucket_wav_audio_path || null;

        return {
          success: true,
          status: status,
          audioUrl: audioUrl,
        };
      } else {
        throw new functions.https.HttpsError(
          "internal",
          "Failed to check conversion status"
        );
      }
    } catch (error) {
      // Log and rethrow as Firebase error
      console.error("Error in checkConversionStatus:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Unknown error"
      );
    }
  }
);
