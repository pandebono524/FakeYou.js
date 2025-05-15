const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();

const FAKEYOU_BASE_URL = "https://api.fakeyou.com";
const FAKEYOU_TTS_URL = `${FAKEYOU_BASE_URL}/tts/inference`;
const FAKEYOU_JOB_URL = `${FAKEYOU_BASE_URL}/tts/job`;

exports.convertTextToSpeech = functions.https.onCall(async (data, context) => {
  try {
    if (!data.text || !data.modelName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Text and model name are required"
      );
    }

    const authToken =
      process.env.FAKEYOU_AUTH_TOKEN || functions.config().fakeyou.auth_token;
    if (!authToken) {
      throw new functions.https.HttpsError(
        "internal",
        "FakeYou authentication token not configured"
      );
    }

    const payload = {
      tts_model_token: data.modelName,
      inference_text: data.text,
      uuid_idempotency_token: uuidv4(),
    };

    const response = await axios.post(FAKEYOU_TTS_URL, payload, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

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
    console.error("Error in convertTextToSpeech:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Unknown error"
    );
  }
});

exports.checkConversionStatus = functions.https.onCall(
  async (data, context) => {
    try {
      if (!data.inferenceToken) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Inference token is required"
        );
      }

      const authToken =
        process.env.FAKEYOU_AUTH_TOKEN || functions.config().fakeyou.auth_token;
      if (!authToken) {
        throw new functions.https.HttpsError(
          "internal",
          "FakeYou authentication token not configured"
        );
      }

      const response = await axios.get(
        `${FAKEYOU_JOB_URL}/${data.inferenceToken}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.data.success) {
        const status = response.data.state.status;
        const audioUrl = response.data.state.maybe_public_bucket_wav_audio_path;

        return {
          success: true,
          status: status,
          audioUrl: audioUrl || null,
        };
      } else {
        throw new functions.https.HttpsError(
          "internal",
          "Failed to check conversion status"
        );
      }
    } catch (error) {
      console.error("Error in checkConversionStatus:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Unknown error"
      );
    }
  }
);
