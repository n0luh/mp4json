const video = document.createElement('video');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
let audioCtx, source, videoData = [];

async function processVideo(url, startTime, endTime) {
  video.src = url;
  video.crossOrigin = 'anonymous';
  await video.load();

  canvas.width = 854; // 480p resolution
  canvas.height = 480;

  const duration = endTime - startTime;
  const fps = 25;
  const totalFrames = Math.floor(duration * fps);

  audioCtx = new AudioContext();
  source = audioCtx.createMediaElementSource(video);
  source.connect(audioCtx.destination);

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

  const audioData = await extractAudioData(video, startTime, endTime);
  const jsonOutput = {
    video: videoData,
    audio: {
      sampleRate: audioCtx.sampleRate,
      data: audioData
    }
  };

  return JSON.stringify(jsonOutput);
}

async function extractAudioData(video, startTime, endTime) {
  const offlineCtx = new OfflineAudioContext(1, (endTime - startTime) * video.audioTracks[0].sampleRate, video.audioTracks[0].sampleRate);
  const offlineSource = offlineCtx.createMediaElementSource(video);
  offlineSource.connect(offlineCtx.destination);
  offlineCtx.startRendering();
  video.currentTime = startTime;
  await video.play();

  return new Promise(resolve => {
    offlineCtx.oncomplete = event => {
      resolve(Array.from(event.renderedBuffer.getChannelData(0)));
    };
  });
}

function playbackJson(jsonData, targetHz) {
  const data = JSON.parse(jsonData);
  const videoFrames = data.video;
  const audioData = data.audio.data;
  const sampleRate = data.audio.sampleRate;

  canvas.width = 854;
  canvas.height = 480;
  document.body.appendChild(canvas);

  const frameTime = 1000 / 25; // 25 fps
  let frameIndex = 0;

  function drawFrame() {
    if (frameIndex >= videoFrames.length) return;
    const frame = videoFrames[frameIndex].pixels;
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < frame.length; i++) {
      const pixel = frame[i];
      const idx = i * 4;
      imageData.data[idx] = pixel.r;
      imageData.data[idx + 1] = pixel.g;
      imageData.data[idx + 2] = pixel.b;
      imageData.data[idx + 3] = pixel.a;
    }
    ctx.putImageData(imageData, 0, 0);
    frameIndex++;
    setTimeout(drawFrame, frameTime);
  }

  audioCtx = new AudioContext({ sampleRate: targetHz });
  const buffer = audioCtx.createBuffer(1, audioData.length, sampleRate);
  buffer.copyToChannel(Float32Array.from(audioData), 0);
  const audioSource = audioCtx.createBufferSource();
  audioSource.buffer = buffer;
  audioSource.connect(audioCtx.destination);
  audioSource.start();

  drawFrame();
}

// Example usage:
// processVideo('https://example.com/video.mp4', 0, 10).then(json => {
//   playbackJson(json, 44100);
// });
