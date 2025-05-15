/**
 * Firebase Cloud Functions for FakeYou.js Text-to-Speech Integration
 * 
 * This module provides two callable functions:
 * 1. convertTextToSpeech: Starts a TTS job on FakeYou and returns a job token.
 * 2. checkConversionStatus: Checks the status of a TTS job and returns the audio URL when ready.
 * 
 * Features:
 * - Uses UUID for idempotency.
 * - Reads FakeYou auth token from Firebase config or environment.
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
const FAKEYOU_TTS_URL = `${FAKEYOU_BASE_URL}/tts/inference`;
const FAKEYOU_JOB_URL = `${FAKEYOU_BASE_URL}/tts/job`;

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

    // Get FakeYou auth token from environment or Firebase config
    const authToken =
      process.env.FAKEYOU_AUTH_TOKEN || functions.config().fakeyou.auth_token;
    if (!authToken) {
      throw new functions.https.HttpsError(
        "internal",
        "FakeYou authentication token not configured"
      );
    }

    // Prepare the request payload with a unique UUID for idempotency
    const payload = {
      tts_model_token: data.modelName,
      inference_text: data.text,
      uuid_idempotency_token: uuidv4(),
    };

    // Make the API call to FakeYou
    const response = await axios.post(FAKEYOU_TTS_URL, payload, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
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

      // Get FakeYou auth token from environment or Firebase config
      const authToken =
        process.env.FAKEYOU_AUTH_TOKEN || functions.config().fakeyou.auth_token;
      if (!authToken) {
        throw new functions.https.HttpsError(
          "internal",
          "FakeYou authentication token not configured"
        );
      }

      // Make the API call to check job status
      const response = await axios.get(
        `${FAKEYOU_JOB_URL}/${data.inferenceToken}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
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
