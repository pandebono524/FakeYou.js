const FakeYou = require("fakeyou.ts").default;
const fs = require("fs");
const https = require("https");

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https
      .get(url, function (response) {
        response.pipe(file);
        file.on("finish", function () {
          file.close(resolve);
          console.log(`File downloaded to ${outputPath}`);
        });
      })
      .on("error", function (err) {
        fs.unlink(outputPath, () => {}); // Delete the file on error
        reject(err);
      });
  });
}

async function main() {
  const client = new FakeYou();

  try {
    await client.login({
      username: "YOUR_FAKEYOU_USERNAME",
      password: "YOUR_FAKEYOU_PASSWORD",
    });
    console.log("Login successful");
  } catch (error) {
    console.error("Login failed:", error);
  }

  // Get all models
  const modelsMap = await client.fetchTtsModels("homer");
  const modelsArr = Array.from(modelsMap.values());
  console.log(`Found ${modelsArr.length} models`);

  // Find a popular model
  const popularModel = modelsArr.find(
    (m) =>
      m.title &&
      (m.title.toLowerCase().includes("mario") ||
        m.title.toLowerCase().includes("trump") ||
        m.title.toLowerCase().includes("morgan freeman"))
  );

  const model = popularModel || modelsArr[0];
  console.log("Using model:", model.title, model.token);

  try {
    console.log("Starting TTS generation...");
    const inference = await model.infer("Hello, this is a test message!");

    // Save to disk
    console.log("Saving audio to disk...");

    // Create the correct CDN URL using the path
    if (inference.publicBucketWavAudioPath) {
      const cdnUrl = `https://cdn-2.fakeyou.com${inference.publicBucketWavAudioPath}`;
      console.log("New CDN URL:", cdnUrl);
      await downloadFile(cdnUrl, "./downloaded_audio.wav");
    } else {
      console.log("Original resourceUrl:", inference.resourceUrl);
    }
  } catch (error) {
    console.error("TTS generation failed:", error);
  }
}

main();
