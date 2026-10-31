/** Render microphone volume using CPAL's typed input callback. */

let cpal;
try {
  cpal = require('../');
} catch (_) {
  cpal = require('node-cpal');
}
const { getF32StreamConfig } = require('./f32-config');

const DURATION_SECONDS = 30;
const VISUALIZATION_WIDTH = 50;

let resolveExit;
const exitRequested = new Promise((resolve) => {
  resolveExit = resolve;
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down...');
  resolveExit();
});

function calculateRMS(audioData) {
  if (audioData.length === 0) return 0;

  let sum = 0;
  for (const sample of audioData) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / audioData.length);
}

function visualizeAudio(level, width) {
  const barLength = Math.floor(level * width);
  let bar = '';

  for (let index = 0; index < width; index++) {
    if (index >= barLength) bar += ' ';
    else if (index > width * 0.8) bar += '█';
    else if (index > width * 0.4) bar += '▓';
    else bar += '▒';
  }

  return `|${bar}| ${(level * 100).toFixed(1)}%`;
}

async function main() {
  let host;
  let device;
  let stream;

  try {
    host = cpal.defaultHost();
    device = host.defaultInputDevice();
    if (!device) throw new Error('No default input device');

    const supported = getF32StreamConfig(cpal, device, true);
    const config = supported.config();
    console.log(`Using input device: ${device.description().name()}`);
    console.log(
      `Using configuration: ${config.sampleRate} Hz, ${config.channels} channels, f32 format`
    );
    console.log(`\nAudio Visualizer - Running for ${DURATION_SECONDS} seconds`);
    console.log('Make some noise to see the visualization!');
    console.log('Press Ctrl+C to exit early\n');

    stream = device.buildInputStream(
      config,
      cpal.SampleFormat.F32,
      (data) => {
        const level = Math.min(1, calculateRMS(data) * 5);
        process.stdout.write(
          `\r${visualizeAudio(level, VISUALIZATION_WIDTH)}`
        );
      },
      (error) => console.error(`\n[${error.code}] ${error.message}`)
    );
    stream.play();

    await Promise.race([
      new Promise((resolve) => setTimeout(resolve, DURATION_SECONDS * 1000)),
      exitRequested,
    ]);
    console.log('\n\nStopping audio visualization...');
    console.log('Done!');
  } catch (error) {
    console.error(`\n[${error.code || 'ERROR'}] ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (stream) stream.close();
    if (device) device.close();
    if (host) host.close();
  }
}

main();
