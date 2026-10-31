# Migrating from node-cpal 0.2.0 to 1.0.0

Version 1.0.0 is a deliberate breaking release. In 0.2.0, node-cpal exposed a
flattened, binding-specific API based on device objects, string stream IDs, and
an `f32` output queue. In 1.0.0, the package's top-level API is a one-to-one
translation of CPAL 0.18.2: a `Host` owns `Device` handles, and a `Device`
builds `Stream` handles.

There is no drop-in compatibility import. Applications must choose one of two
migration paths:

1. **Canonical CPAL (recommended):** use the top-level `Host`, `Device`, and
   `Stream` API. This is the stable direction for node-cpal and exposes CPAL's
   direct typed and raw callbacks.
2. **Queued convenience API:** use `require('node-cpal').convenience` when the
   application depends on queued writes, pull prefetch, or keeping JavaScript
   off the native audio callback path. This resembles the architecture of
   0.2.0, but its stream API is still intentionally redesigned.

Node.js 22 or newer remains required.

## Upgrade the package

```bash
npm install node-cpal@^1.0.0
```

For the canonical API, keep the normal import:

```js
const cpal = require('node-cpal');
```

For the queued API, change the import:

```js
const cpal = require('node-cpal').convenience;
```

Do not make that import change alone and expect 0.2.0 calls to keep working.
`createStream`, `writeToStream`, and the string-ID lifecycle functions were
removed, including from `convenience`.

## Breaking changes at a glance

| 0.2.0 | Canonical 1.0.0 | Queued 1.0.0 |
| --- | --- | --- |
| `getHosts()` | `availableHosts()` | `convenience.getHosts()` |
| `getDevices(hostId)` | `hostFromId(hostId).devices()` | `convenience.getDevices({ hostId })` |
| `getDefaultInputDevice()` | `host.defaultInputDevice()` | `convenience.getDefaultInputDevice()` |
| `getDefaultOutputDevice()` | `host.defaultOutputDevice()` | `convenience.getDefaultOutputDevice()` |
| `getSupportedInputConfigs(id)` | `device.supportedInputConfigs()` | `convenience.getSupportedInputConfigs(id)` |
| `getSupportedOutputConfigs(id)` | `device.supportedOutputConfigs()` | `convenience.getSupportedOutputConfigs(id)` |
| `getDefaultInputConfig(id)` | `device.defaultInputConfig()` | `convenience.getDefaultInputConfig(id)` |
| `getDefaultOutputConfig(id)` | `device.defaultOutputConfig()` | `convenience.getDefaultOutputConfig(id)` |
| `getSupportedFormats(id)` | derive from the device's config ranges | unchanged under `convenience` |
| `getSupportedSampleRates(id)` | inspect config ranges | unchanged under `convenience` |
| `getMaxChannels(id)` | inspect config ranges | unchanged under `convenience` |
| `createStream(id, true, ...)` | `device.buildInputStream(...)` | `await convenience.createInputStream(options)` |
| `createStream(id, false, ...)` | `device.buildOutputStream(...)` | `await convenience.createOutputStream(options)` |
| `writeToStream(streamId, data)` | fill the output callback's buffer | `stream.write(data)` |
| `pauseStream(streamId)` | `stream.pause()` | `stream.pause()` |
| `resumeStream(streamId)` | `stream.play()` | `stream.play()` |
| `isStreamActive(streamId)` | `stream.state() === 'playing'` | `stream.state === 'playing'` |
| `closeStream(streamId)` | `stream.close()` | `await stream.close()` |
| `StreamId` string | `Stream` object | `AudioStream` object |

The canonical methods return CPAL value objects. Configuration fields that were
plain properties in 0.2.0 are methods in the canonical API. For example:

```js
// 0.2.0
config.channels;
config.minSampleRate;
config.format;

// Canonical 1.0.0
config.channels();
config.minSampleRate();
config.sampleFormat();

// Queued 1.0.0
config.channels;
config.minSampleRate;
config.sampleFormat; // `format` was renamed
```

## Migrate discovery to Host and Device handles

### Before: 0.2.0

```js
const hosts = cpal.getHosts();
const devices = cpal.getDevices(hosts[0].id);

for (const device of devices) {
  console.log(device.deviceId, device.name);
}
```

### After: canonical 1.0.0

```js
const hostId = cpal.availableHosts()[0];
const host = cpal.hostFromId(hostId);
const devices = [...host.devices()];

try {
  for (const device of devices) {
    console.log(device.id().toString(), device.description().name());
  }
} finally {
  for (const device of devices) device.close();
  host.close();
}
```

Use `cpal.defaultHost()` when the application does not need to select a
backend. `defaultInputDevice()` and `defaultOutputDevice()` now return
`Device | null`, matching CPAL's `Option<Device>`, instead of throwing solely
because no default exists:

```js
const host = cpal.defaultHost();
const device = host.defaultOutputDevice();
if (!device) throw new Error('No default output device');
```

Canonical hosts and devices are native handles. Close them deterministically
after their streams are closed. Finalizers remain a fallback, not the preferred
resource-management mechanism.

### Queued discovery

The convenience facade retains flattened device metadata, but host filtering
now uses an options object:

```js
const cpal = require('node-cpal').convenience;
const hosts = cpal.getHosts();
const devices = cpal.getDevices({
  hostId: hosts[0].id,
  direction: 'output',
});
```

`AudioDevice` now also reports input/output support, loopback support, device
type, interface type, direction, manufacturer, driver, address, and extended
description lines.

## Re-enumerate persisted device IDs

Do not assume a device ID saved by 0.2.0 can be passed to 1.0.0. Version 0.2.0
used the backend's device string directly and could fall back to the device
name. Version 1.0.0 uses CPAL's serializable host-qualified `DeviceId`.

After upgrading, enumerate devices again and persist `device.id().toString()`
for the canonical API or `device.deviceId` for the convenience API. Restore a
canonical device through its owning host:

```js
const id = cpal.DeviceId.fromString(savedId);
const host = cpal.hostFromId(id.host());
const device = host.deviceById(id);
if (!device) throw new Error('The saved device is no longer available');
```

Device IDs identify devices; they do not guarantee that disconnected hardware
will remain available.

## Migrate configuration selection

Version 0.2.0 streams always used `f32`, even though capability metadata listed
other formats. Version 1.0.0 does not perform implicit sample conversion. The
sample format selected for a stream determines its callback or write-buffer
typed array.

Canonical configuration ranges are iterable CPAL value objects:

```js
function selectF32Output(cpal, device) {
  const defaultConfig = device.defaultOutputConfig();
  if (defaultConfig.sampleFormat() === cpal.SampleFormat.F32) {
    return defaultConfig;
  }

  const ranges = [...device.supportedOutputConfigs()];
  const range = ranges.find(
    (candidate) => candidate.sampleFormat() === cpal.SampleFormat.F32
  );
  if (!range) throw new Error('The output device does not support f32');

  return (
    range.tryWithSampleRate(defaultConfig.sampleRate()) ??
    range.tryWithStandardSampleRate() ??
    range.withMaxSampleRate()
  );
}
```

`SupportedStreamConfig.config()` produces the `StreamConfig` accepted by a
builder. A format is passed separately because it represents CPAL's Rust sample
type parameter:

```js
const supported = selectF32Output(cpal, device);
const streamConfig = supported.config();
const sampleFormat = supported.sampleFormat();
```

For the convenience API, configurations remain plain objects, but they now
require `sampleFormat` and may specify `bufferSize`:

```js
function selectQueuedF32Output(cpal, device) {
  const defaultConfig = cpal.getDefaultOutputConfig(device.deviceId);
  const ranges = cpal.getSupportedOutputConfigs(device.deviceId);
  const range = ranges
    .find(
      (candidate) =>
        candidate.sampleFormat === 'f32' &&
        candidate.channels === defaultConfig.channels
    ) ?? ranges
      .find((candidate) => candidate.sampleFormat === 'f32');
  if (!range) throw new Error('The output device does not support f32');

  const defaultRateIsSupported =
    defaultConfig.sampleRate >= range.minSampleRate &&
    defaultConfig.sampleRate <= range.maxSampleRate;
  return {
    channels: range.channels,
    sampleRate: defaultRateIsSupported
      ? defaultConfig.sampleRate
      : range.minSampleRate,
    sampleFormat: 'f32',
    bufferSize: { type: 'default' },
  };
}
```

Supported convenience ranges use `sampleFormat` instead of the 0.2.0 `format`
property and include a supported `bufferSize` range.

## Migrate output streams

The canonical API has CPAL's output model: the backend supplies a mutable
buffer to the data callback, and the application fills that buffer before the
callback returns. There is no canonical `write()` method.

### Before: queued output in 0.2.0

```js
const streamId = cpal.createStream(
  outputDevice.deviceId,
  false,
  { channels: 2, sampleRate: 48_000 },
  () => {}
);

cpal.writeToStream(streamId, samples);
cpal.closeStream(streamId);
```

### After: direct canonical output

```js
const host = cpal.defaultHost();
const device = host.defaultOutputDevice();
if (!device) throw new Error('No default output device');

const supported = selectF32Output(cpal, device);
const config = supported.config();
const samples = loadOrGenerateAudio(); // An application-owned Float32Array.
let offset = 0;
let lastPlaybackTimeNs = 0n;

const stream = device.buildOutputStream(
  config,
  cpal.SampleFormat.F32,
  (output, info) => {
    // Output is pre-filled with f32 equilibrium (zero/silence).
    const count = Math.min(output.length, samples.length - offset);
    if (count > 0) {
      output.set(samples.subarray(offset, offset + count));
      offset += count;
    }
    lastPlaybackTimeNs = info.timestamp().playback.asNanos();
  },
  (error) => console.error(error.code, error.message)
);

// New canonical streams are paused, just like CPAL streams.
stream.play();
const playbackDurationMs =
  (samples.length / config.channels / config.sampleRate) * 1000;
setTimeout(() => {
  stream.close();
  device.close();
  host.close();
  console.log('Last playback timestamp:', lastPlaybackTimeNs);
}, playbackDurationMs + 250);
```

Canonical data callbacks must complete synchronously and must not return a
Promise. The native CPAL callback waits for JavaScript, so keep the callback
short and avoid blocking I/O. Output buffers are pre-filled with the selected
format's equilibrium, not always numeric zero.

This applies to canonical input and output callbacks. Version 0.2.0 decoupled
input delivery through a queue and consumed output from a queue; choose
`convenience` if application callbacks depend on that isolation.

### Preserve queued writes with `convenience`

```js
const cpal = require('node-cpal').convenience;

async function main() {
  const device = cpal.getDefaultOutputDevice();
  const samples = loadOrGenerateAudio(); // A correctly typed, whole-frame buffer.
  let resolveDrain;
  const stream = await cpal.createOutputStream({
    deviceId: device.deviceId,
    config: selectQueuedF32Output(cpal, device),
    autoStart: true,
    onDrain() {
      resolveDrain?.();
      resolveDrain = undefined;
    },
    onError(error) {
      console.error(error.code, error.message);
    },
  });

  try {
    while (!stream.write(samples)) {
      await new Promise((resolve) => {
        resolveDrain = resolve;
      });
    }
  } finally {
    await stream.close();
  }
}

main();
```

In 0.2.0, a full output queue made `writeToStream()` throw. In 1.0.0,
`PushOutputStream.write()` returns `false`, and `onDrain` signals when a retry
is appropriate. Buffers must contain at least one complete interleaved frame.

The convenience API also adds pull output. Set `mode: 'pull'` and return the
requested typed array synchronously from `onData({ frames, channels,
sampleFormat })`.

## Migrate input streams

### Before: 0.2.0

```js
const streamId = cpal.createStream(
  inputDevice.deviceId,
  true,
  { channels: 1, sampleRate: 48_000 },
  (data) => processInput(data)
);
```

### After: canonical 1.0.0

```js
const host = cpal.defaultHost();
const device = host.defaultInputDevice();
if (!device) throw new Error('No default input device');

const supported = device.defaultInputConfig();
const format = supported.sampleFormat();
if (format.isDsd()) throw new Error('Use buildInputStreamRaw for DSD');
let lastCaptureTimeNs = 0n;

const stream = device.buildInputStream(
  supported.config(),
  format,
  (data, info) => {
    processInput(data);
    lastCaptureTimeNs = info.timestamp().capture.asNanos();
  },
  (error) => console.error(error.code, error.message)
);

stream.play();
setTimeout(() => {
  stream.close();
  device.close();
  host.close();
  console.log('Last capture timestamp:', lastCaptureTimeNs);
}, 5_000);
```

The typed array now matches the chosen format rather than always being
`Float32Array`. Input callbacks also receive an `InputCallbackInfo` with exact
callback and capture timestamps.

The queued equivalent is asynchronous to create and takes an options object:

```js
const cpal = require('node-cpal').convenience;

async function main() {
  const device = cpal.getDefaultInputDevice();
  const config = cpal.getDefaultInputConfig(device.deviceId);
  const stream = await cpal.createInputStream({
    deviceId: device.deviceId,
    config,
    autoStart: true,
    onData(data, info) {
      processInput(data, info.captureTimeNs);
    },
    onError(error) {
      console.error(error.code, error.message);
    },
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  } finally {
    await stream.close();
  }
}

main();
```

## Stream lifecycle differences

Version 0.2.0 played streams immediately. Both 1.0.0 APIs create paused streams
unless convenience creation receives `autoStart: true`.

Canonical device builders return a stream synchronously and must not be
`await`ed. Convenience stream factories return promises and must be `await`ed.

Canonical lifecycle:

```js
stream.state();      // 'paused', 'playing', or 'closed'
stream.play();
stream.pause();
stream.bufferSize(); // negotiated frame count
stream.now();        // StreamInstant
stream.close();      // synchronous and idempotent
```

Convenience lifecycle:

```js
stream.state;        // property, not a method
stream.play();
stream.pause();
stream.bufferSize();
stream.now();        // bigint nanoseconds
await stream.close();
```

Calls other than `close()` reject a closed stream with `STREAM_CLOSED`.

## Sample formats and raw data

Typed canonical builders support CPAL's sized sample formats. Important storage
mappings include:

| Format | Typed array |
| --- | --- |
| `SampleFormat.I16` | `Int16Array` |
| `SampleFormat.I24` | `Int32Array` with 24-bit range validation |
| `SampleFormat.I64` | `BigInt64Array` |
| `SampleFormat.U16` | `Uint16Array` |
| `SampleFormat.U24` | `Uint32Array` with 24-bit range validation |
| `SampleFormat.U64` | `BigUint64Array` |
| `SampleFormat.F32` | `Float32Array` |
| `SampleFormat.F64` | `Float64Array` |

DSD formats use `buildInputStreamRaw()` or `buildOutputStreamRaw()`. Raw
callbacks receive a `Data` view with `sampleFormat()`, `len()`, `bytes()`, and
typed slice accessors. A raw `Data` object is valid only during its callback.

## Errors and callbacks

Version 0.2.0 mostly threw generic `Error` objects and printed native stream
errors to stderr. Version 1.0.0 uses `CpalError` with stable `code`, `kind()`,
`cpalMessage()`, `operation`, and `cause` information.

Every 1.0.0 stream requires an error callback:

```js
(error) => {
  if (error.code === 'DEVICE_NOT_AVAILABLE') {
    // Re-enumerate devices or ask the user to select another one.
  }
}
```

Callback exceptions are reported as `CALLBACK_FAILED`. In canonical output,
the affected buffer is replaced with format-correct silence. Do not throw from
an error callback unless the process should surface an uncaught exception.

The optional canonical stream timeout is `bigint` nanoseconds or `null`. The
convenience equivalent is `timeoutMs` in milliseconds.

## TypeScript name changes

| 0.2.0 type | Canonical 1.0.0 | Queued 1.0.0 |
| --- | --- | --- |
| `SampleFormat` string union | `SampleFormatName`; runtime values are under `SampleFormat` | `SampleFormatName` |
| `StreamId` | `Stream` | `AudioStream`, `InputStream`, or output stream type |
| `StreamConfig` interface | `StreamConfig` class | `QueuedStreamConfig` |
| `AudioHost` | `Host` and `HostId` | `AudioHost` |
| `AudioDevice` | `Device`, `DeviceId`, and `DeviceDescription` | `AudioDevice` |
| `AudioDeviceConfig` | `SupportedStreamConfigRange` | `AudioDeviceConfig` with `sampleFormat` |
| `DefaultStreamConfig` | `SupportedStreamConfig` | `DefaultStreamConfig` |

Let builder calls infer the typed-array callback where possible:

```ts
device.buildOutputStream(
  config,
  cpal.SampleFormat.I16,
  (data) => {
    data satisfies Int16Array;
  },
  console.error
);
```

## Optional backends

The root entry point contains CPAL's default platform backend: CoreAudio on
macOS, ALSA on Linux, and WASAPI on Windows. Version 1.0.0 also provides
feature-specific builds as subpaths of the same `node-cpal` package:

```js
const jack = require('node-cpal/backend-jack');
const pipewire = require('node-cpal/backend-pipewire');
const pulseaudio = require('node-cpal/backend-pulseaudio');
const asio = require('node-cpal/backend-asio');
```

Do not install an additional package. The subpath chooses a native addon built
with that CPAL feature; select the resulting host through `hostFromId()` or a
concrete host constructor. The platform's default host is still present, so
`defaultHost()` retains CPAL's ordinary behavior. Backend client libraries,
services, drivers, and platform availability are still required.

## Migration checklist

- Choose canonical callbacks or the queued convenience facade deliberately.
- Replace flattened top-level discovery with `Host`/`Device`, or namespace it
  under `convenience` and update `getDevices()` options.
- Re-enumerate and re-save device IDs.
- Change supported-config `format` to `sampleFormat` or `sampleFormat()`.
- Split `createStream(..., isInput, ...)` into direction-specific builders.
- Add the required error callback to every stream.
- Account for streams starting paused.
- Replace string stream controls with stream object methods.
- Replace output queue exceptions with canonical buffer filling or convenience
  boolean backpressure and `onDrain`.
- Use the typed array required by the selected sample format.
- Close canonical streams, devices, and hosts in that order.
- Run tests on every supported operating system and real audio device used by
  the application.

The updated runnable examples are in [`examples/`](../examples/), and the full
CPAL public-item audit is in
[`docs/cpal-0.18.2-parity.json`](./cpal-0.18.2-parity.json).
