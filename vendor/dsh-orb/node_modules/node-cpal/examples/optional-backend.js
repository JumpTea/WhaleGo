/** Enumerate devices through one of node-cpal's optional backend subpaths. */

const BACKENDS = Object.freeze({
  jack: 'Jack',
  pipewire: 'PipeWire',
  pulseaudio: 'PulseAudio',
  asio: 'Asio',
});

const backend = process.argv[2];
if (!Object.hasOwn(BACKENDS, backend)) {
  console.log('Usage: node optional-backend.js <jack|pipewire|pulseaudio|asio>');
  process.exitCode = backend === undefined ? 0 : 1;
} else {
  const cpal = require(`node-cpal/backend-${backend}`);
  const hostId = cpal.HostId[BACKENDS[backend]];
  const host = cpal.hostFromId(hostId);

  try {
    console.log(`${host.id().name()} devices:`);
    for (const device of host.devices()) {
      try {
        console.log(`- ${device.description().name()}`);
      } finally {
        device.close();
      }
    }
  } finally {
    host.close();
  }
}
