/** Play silence through the canonical one-to-one CPAL API for one second. */

const cpal = require('../');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const host = cpal.defaultHost();
  const device = host.defaultOutputDevice();
  if (!device) throw new Error('No default output device');

  const supported = device.defaultOutputConfig();
  const format = supported.sampleFormat();
  const build = format.isDsd()
    ? device.buildOutputStreamRaw.bind(device)
    : device.buildOutputStream.bind(device);
  const stream = build(supported.config(), format, () => {
    // CPAL pre-fills output callbacks with format-correct silence.
  }, (error) => console.error(error.kind().name, error.message));

  try {
    stream.play();
    await sleep(1000);
  } finally {
    stream.close();
    device.close();
    host.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
