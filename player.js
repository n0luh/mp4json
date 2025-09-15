const express = require('express');
const app = express();
app.use(express.json());

app.post('/process-video', async (req, res) => {
  const { url, startTime, endTime } = req.body;
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let videoData = [];

  video.src = url;
  video.crossOrigin = 'anonymous';
  await video.load();

  canvas.width = 854;
  canvas.height = 480;

  const duration = endTime - startTime;
  const fps = 25;
  const totalFrames = Math.floor(duration * fps);

  video.currentTime = startTime;

  for (let i = 0; i < totalFrames; i++) {
    await new Promise(resolve => {
      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const framePixels = [];
        for (let j = 0; j < frameData.length; j += 4) {
          framePixels.push({
            r: frameData[j],
            g: frameData[j + 1],
            b: frameData[j + 2],
            a: frameData[j + 3]
          });
        }
        videoData.push({ frame: i, pixels: framePixels });
        video.currentTime += 1 / fps;
        resolve();
      };
    });
  }

  res.json({ video: videoData });
});

app.listen(3000, () => console.log('Server running on port 3000'));
