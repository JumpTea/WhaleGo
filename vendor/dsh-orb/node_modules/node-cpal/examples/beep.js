/** Play a 440 Hz sine wave for one second with CPAL's typed output callback. */

let cpal;
try {
  cpal = require('../');
} catch (_) {
  cpal = require('node-cpal');
}
const { getF32StreamConfig } = require('./f32-config');

const FREQUENCY = 440;
const DURATION_SECONDS = 1;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let host;
  let device;
  let stream;

  try {
    host = cpal.defaultHost();
    device = host.defaultOutputDevice();
    if (!device) throw new Error('No default output device');

    const supported = getF32StreamConfig(cpal, device, false);
    const config = supported.config();
    let frameClock = 0;

    console.log(
      `Playing ${FREQUENCY} Hz through ${device.description().name()} at ${config.sampleRate} Hz`
    );

    stream = device.buildOutputStream(
      config,
      cpal.SampleFormat.F32,
      (data) => {
        for (let frame = 0; frame < data.length / config.channels; frame++) {
          const sample =
            frameClock < config.sampleRate * DURATION_SECONDS
              ? Math.sin(
                  (2 * Math.PI * FREQUENCY * frameClock) / config.sampleRate
                ) * 0.3
              : 0;
          for (let channel = 0; channel < config.channels; channel++) {
            data[frame * config.channels + channel] = sample;
          }
          frameClock++;
        }
      },
      (error) => console.error(`[${error.code}] ${error.message}`)
    );

    stream.play();
    await sleep(DURATION_SECONDS * 1000 + 250);
    console.log('Done!');
  } catch (error) {
    console.error(`[${error.code || 'ERROR'}] ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (stream) stream.close();
    if (device) device.close();
    if (host) host.close();
  }
}

main();
