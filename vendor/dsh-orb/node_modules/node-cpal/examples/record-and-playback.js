/** Record microphone audio, convert it, and play it through canonical CPAL streams. */

let cpal;
try {
  cpal = require('../');
} catch (_) {
  cpal = require('node-cpal');
}
const { getF32StreamConfig } = require('./f32-config');

const RECORD_DURATION_SECONDS = 10;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cancellableDelay(ms) {
  let timer;
  const promise = new Promise((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

function cancellableTimeout(ms, message) {
  let timer;
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

function concatenateChunks(chunks, totalSamples) {
  const audioData = new Float32Array(totalSamples);
  let offset = 0;

  for (const chunk of chunks) {
    audioData.set(chunk, offset);
    offset += chunk.length;
  }
  return audioData;
}

function convertChannels(audioData, inputChannels, outputChannels) {
  if (inputChannels === outputChannels) return audioData;

  const frameCount = Math.floor(audioData.length / inputChannels);
  const convertedData = new Float32Array(frameCount * outputChannels);

  for (let frame = 0; frame < frameCount; frame++) {
    if (outputChannels === 1) {
      let sample = 0;
      for (let channel = 0; channel < inputChannels; channel++) {
        sample += audioData[frame * inputChannels + channel];
      }
      convertedData[frame] = sample / inputChannels;
      continue;
    }

    for (let channel = 0; channel < outputChannels; channel++) {
      const inputChannel =
        inputChannels === 1 ? 0 : Math.min(channel, inputChannels - 1);
      convertedData[frame * outputChannels + channel] =
        audioData[frame * inputChannels + inputChannel];
    }
  }

  return convertedData;
}

function resampleAudio(audioData, inputRate, outputRate, channels) {
  if (inputRate === outputRate || audioData.length === 0) return audioData;

  const inputFrameCount = Math.floor(audioData.length / channels);
  const outputFrameCount = Math.round(
    (inputFrameCount * outputRate) / inputRate
  );
  const resampledData = new Float32Array(outputFrameCount * channels);

  for (let outputFrame = 0; outputFrame < outputFrameCount; outputFrame++) {
    const sourcePosition = (outputFrame * inputRate) / outputRate;
    const firstFrame = Math.min(
      Math.floor(sourcePosition),
      inputFrameCount - 1
    );
    const secondFrame = Math.min(firstFrame + 1, inputFrameCount - 1);
    const interpolation = sourcePosition - firstFrame;

    for (let channel = 0; channel < channels; channel++) {
      const firstSample = audioData[firstFrame * channels + channel];
      const secondSample = audioData[secondFrame * channels + channel];
      resampledData[outputFrame * channels + channel] =
        firstSample + (secondSample - firstSample) * interpolation;
    }
  }

  return resampledData;
}

async function main() {
  let host;
  let inputDevice;
  let outputDevice;
  let inputStream;
  let outputStream;

  try {
    host = cpal.defaultHost();
    inputDevice = host.defaultInputDevice();
    outputDevice = host.defaultOutputDevice();
    if (!inputDevice) throw new Error('No default input device');
    if (!outputDevice) throw new Error('No default output device');

    const inputSupported = getF32StreamConfig(cpal, inputDevice, true);
    const outputSupported = getF32StreamConfig(cpal, outputDevice, false);
    const inputConfig = inputSupported.config();
    const outputConfig = outputSupported.config();

    console.log(`Using input device: ${inputDevice.description().name()}`);
    console.log(`Using output device: ${outputDevice.description().name()}`);
    console.log(
      `Input configuration: ${inputConfig.sampleRate} Hz, ${inputConfig.channels} channels, f32 format`
    );
    console.log(
      `Output configuration: ${outputConfig.sampleRate} Hz, ${outputConfig.channels} channels, f32 format`
    );

    const recordedChunks = [];
    let totalSamples = 0;
    let lastRecordingProgress = -1;
    const expectedSamples =
      inputConfig.sampleRate *
      inputConfig.channels *
      RECORD_DURATION_SECONDS;
    let rejectInput;
    const inputFailed = new Promise((_, reject) => {
      rejectInput = reject;
    });

    console.log(`\nRecording ${RECORD_DURATION_SECONDS} seconds of audio...`);
    console.log('Speak into your microphone...');

    inputStream = inputDevice.buildInputStream(
      inputConfig,
      cpal.SampleFormat.F32,
      (data) => {
        recordedChunks.push(new Float32Array(data));
        totalSamples += data.length;

        const progress = Math.min(
          100,
          Math.round((totalSamples / expectedSamples) * 100)
        );
        if (progress !== lastRecordingProgress) {
          lastRecordingProgress = progress;
          process.stdout.write(`\rRecording: ${progress}% complete`);
        }
      },
      rejectInput
    );
    inputStream.play();
    const recordingDelay = cancellableDelay(RECORD_DURATION_SECONDS * 1000);
    try {
      await Promise.race([recordingDelay.promise, inputFailed]);
    } finally {
      recordingDelay.cancel();
    }

    console.log('\nStopping recording...');
    inputStream.close();
    inputStream = null;

    const totalRecordedSamples = recordedChunks.reduce(
      (total, chunk) => total + chunk.length,
      0
    );
    if (totalRecordedSamples === 0) {
      throw new Error('The input stream did not deliver any audio');
    }
    console.log(`Recorded ${totalRecordedSamples} samples`);

    const recordedData = concatenateChunks(
      recordedChunks,
      totalRecordedSamples
    );
    const channelConvertedData = convertChannels(
      recordedData,
      inputConfig.channels,
      outputConfig.channels
    );
    const playbackData = resampleAudio(
      channelConvertedData,
      inputConfig.sampleRate,
      outputConfig.sampleRate,
      outputConfig.channels
    );
    if (playbackData.length === 0) {
      throw new Error('The recording did not contain a complete audio frame');
    }

    if (
      inputConfig.sampleRate !== outputConfig.sampleRate ||
      inputConfig.channels !== outputConfig.channels
    ) {
      console.log(
        `Converting ${inputConfig.sampleRate} Hz/${inputConfig.channels}ch to ${outputConfig.sampleRate} Hz/${outputConfig.channels}ch`
      );
    }

    const playbackDurationMs =
      (playbackData.length /
        outputConfig.channels /
        outputConfig.sampleRate) *
      1000;
    console.log(
      `\nPlaying ${(playbackDurationMs / 1000).toFixed(1)} seconds of recorded audio...`
    );

    let playbackOffset = 0;
    let lastPlaybackProgress = -1;
    let resolvePlayback;
    let rejectPlayback;
    const playbackFinished = new Promise((resolve, reject) => {
      resolvePlayback = resolve;
      rejectPlayback = reject;
    });

    outputStream = outputDevice.buildOutputStream(
      outputConfig,
      cpal.SampleFormat.F32,
      (data) => {
        data.fill(0);
        const remaining = playbackData.length - playbackOffset;
        const sampleCount = Math.min(data.length, remaining);
        if (sampleCount > 0) {
          data.set(
            playbackData.subarray(
              playbackOffset,
              playbackOffset + sampleCount
            )
          );
          playbackOffset += sampleCount;
        }

        const progress = Math.round(
          (playbackOffset / playbackData.length) * 100
        );
        if (progress !== lastPlaybackProgress) {
          lastPlaybackProgress = progress;
          process.stdout.write(`\rPlayback: ${progress}% complete`);
        }
        if (playbackOffset === playbackData.length) resolvePlayback();
      },
      rejectPlayback
    );
    outputStream.play();

    const playbackTimeout = cancellableTimeout(
      playbackDurationMs + 5_000,
      'Timed out while waiting for output playback'
    );
    try {
      await Promise.race([playbackFinished, playbackTimeout.promise]);
    } finally {
      playbackTimeout.cancel();
    }
    await sleep(250);
    console.log('\nDone!');
  } catch (error) {
    console.error(`\n[${error.code || 'ERROR'}] ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (inputStream) inputStream.close();
    if (outputStream) outputStream.close();
    if (inputDevice) inputDevice.close();
    if (outputDevice) outputDevice.close();
    if (host) host.close();
  }
}

main();
