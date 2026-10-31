# node-cpal

One-to-one Node.js bindings for [CPAL 0.18.2](https://github.com/RustAudio/cpal). The top-level API follows CPAL's object hierarchy and behavior: `Host` owns `Device` objects, `Device` synchronously builds paused `Stream` objects, and stream callbacks receive the same typed or raw audio data and timestamps as CPAL.

The higher-level queued, push/pull, and loopback API is available separately as `cpal.convenience`; those helpers are not part of the canonical top-level surface.

Upgrading from 0.2.0? Follow the [0.2.0 to 1.0.0 migration guide](./docs/migration-0.2-to-1.0.md).

## Platform support

| Platform | Architectures | Built-in backend |
| --- | --- | --- |
| macOS | x64, arm64 | CoreAudio |
| Linux | x64, arm64 | ALSA |
| Windows | x64 | WASAPI |

The same npm package also contains feature-specific CPAL builds behind package
subpaths:

| Import | Platforms | Additional backend |
| --- | --- | --- |
| `node-cpal/backend-jack` | macOS, Linux, Windows | JACK |
| `node-cpal/backend-pipewire` | Linux | PipeWire |
| `node-cpal/backend-pulseaudio` | Linux | PulseAudio |
| `node-cpal/backend-asio` | Windows | ASIO |

These are entry points of `node-cpal`, not separately installed packages. Each
loads a native addon compiled with the named CPAL feature while retaining the
platform's default backend as well.

Node.js 22 or newer is required. Source builds require Rust 1.85 or newer plus the selected backend's development libraries.

```bash
npm install node-cpal
```

To select an optional backend, import its subpath and then use CPAL's normal
host selection API:

```js
const cpal = require('node-cpal/backend-jack');
const host = cpal.hostFromId(cpal.HostId.Jack);
```

The corresponding native client library and audio service or driver must be
available on the machine. Importing a subpath on an unsupported platform throws
`CpalError` with code `UNSUPPORTED_OPERATION`.

## Canonical quick start

This is the CPAL flow translated directly to JavaScript:

```js
const cpal = require('node-cpal');

const host = cpal.defaultHost();
const device = host.defaultOutputDevice();
if (!device) throw new Error('No output device');

const supported = device.defaultOutputConfig();
const format = supported.sampleFormat();
if (format.isDsd()) {
  throw new Error('Use buildOutputStreamRaw for a DSD configuration');
}
const config = supported.config();
let phase = 0;
let playbackTimeNs = 0n;

const stream = device.buildOutputStream(
  config,
  format,
  (data, info) => {
    // The typed array is pre-filled with the format's equilibrium (silence).
    if (format !== cpal.SampleFormat.F32) return;
    for (let frame = 0; frame < data.length / config.channels; frame++) {
      const sample = Math.sin(phase) * 0.2;
      phase += 2 * Math.PI * 440 / config.sampleRate;
      for (let channel = 0; channel < config.channels; channel++) {
        data[frame * config.channels + channel] = sample;
      }
    }
    playbackTimeNs = info.timestamp().playback.asNanos();
  },
  (error) => console.error(error.kind().name, error.message),
  null // Optional timeout, as bigint nanoseconds.
);

// Like CPAL, newly built streams are paused.
stream.play();
setTimeout(() => {
  stream.close();
  device.close();
  host.close();
  console.log('Last playback timestamp:', playbackTimeNs);
}, 1000);
```

Unlike the queued convenience API, canonical callbacks are synchronous: the native CPAL audio callback waits while its JavaScript callback runs on the Node thread. This preserves CPAL callback ordering, mutability, and current-buffer semantics, but a stalled Node event loop can cause an underrun. Use `cpal.convenience` when bounded buffering and keeping JavaScript off the real-time path are more important than literal CPAL semantics.

## Translation rules

The binding applies the same mechanical rules throughout:

- Rust `snake_case` becomes JavaScript `camelCase`; enum variants remain PascalCase.
- `Result<T, Error>` returns `T` or throws `CpalError`.
- `Option<T>` becomes `T | null`.
- iterators become JavaScript iterables, currently materialized as arrays;
- `Duration` becomes a non-negative `bigint` count of nanoseconds;
- generic sample type `T` becomes an explicit `SampleFormat` value and matching typed array;
- Rust `Drop` is handled by a finalizer, with an idempotent `close()` extension for deterministic cleanup.

The complete public-item audit is in [`docs/cpal-0.18.2-parity.json`](./docs/cpal-0.18.2-parity.json). It labels every CPAL item as bound, structurally translated, conditional, or Rust-only.

## Hosts and devices

```js
for (const id of cpal.availableHosts()) {
  console.log(id.toString(), id.name());
}

const host = cpal.hostFromId(cpal.ALL_HOSTS[0]);
for (const device of host.devices()) {
  const description = device.description();
  console.log(device.id().toString(), description.toString());
}

const saved = device.id().toString();
const restored = host.deviceById(cpal.DeviceId.fromString(saved));
```

`Host` and `Device` are real native handles. A `Device` retains its owning host, so PipeWire or other backend configuration is not lost during lookup or stream construction. `DeviceId` is CPAL's serializable `<host>:<device>` identifier.

The host methods mirror `HostTrait`:

```ts
host.id(): HostId;
Host.isAvailable(): boolean;
host.devices(): Iterable<Device>;
host.inputDevices(): Iterable<Device>;
host.outputDevices(): Iterable<Device>;
host.deviceById(id): Device | null;
host.defaultInputDevice(): Device | null;
host.defaultOutputDevice(): Device | null;
```

The device query methods mirror `DeviceTrait`:

```ts
device.description(): DeviceDescription;
device.id(): DeviceId;
device.supportsInput(): boolean;
device.supportsOutput(): boolean;
device.supportedInputConfigs(): Iterable<SupportedStreamConfigRange>;
device.supportedOutputConfigs(): Iterable<SupportedStreamConfigRange>;
device.defaultInputConfig(): SupportedStreamConfig;
device.defaultOutputConfig(): SupportedStreamConfig;
```

`DeviceDescriptionBuilder`, `DeviceType`, `InterfaceType`, and `DeviceDirection` are also exposed directly.

## Configurations

CPAL's configuration value types and methods are available without native calls:

```js
const range = [...device.supportedOutputConfigs()][0];
const supported = range.tryWithStandardSampleRate()
  ?? range.withMaxSampleRate();

console.log(
  range.channels(),
  range.minSampleRate(),
  range.maxSampleRate(),
  range.bufferSize(),
  range.sampleFormat()
);

const config = new cpal.StreamConfig({
  channels: supported.channels(),
  sampleRate: supported.sampleRate(),
  bufferSize: cpal.BufferSize.Fixed(256),
});
```

`SupportedStreamConfigRange` implements CPAL's `withSampleRate`, `tryWithSampleRate`, `withMaxSampleRate`, `containsRate`, standard-rate selection, and `cmpDefaultHeuristics`. `SupportedBufferSize.Unknown` and `SupportedBufferSize.Range(min, max)` mirror its enum variants.

## Typed and raw streams

Because Rust's generic type argument does not exist at runtime in JavaScript, typed builders take an explicit sample format immediately after the config:

```ts
device.buildInputStream(config, sampleFormat, dataCallback, errorCallback, timeout?);
device.buildOutputStream(config, sampleFormat, dataCallback, errorCallback, timeout?);
```

The callback receives the matching typed array. Raw builders receive a `Data` object:

```js
const stream = device.buildOutputStreamRaw(
  config,
  cpal.SampleFormat.I24,
  (data, info) => {
    console.log(data.sampleFormat(), data.len(), data.bytes());
    const samples = data.asSliceMut(cpal.SampleFormat.I24);
    samples.fill(0);
  },
  console.error
);
```

`Data` is valid only during its callback, matching CPAL's borrowed lifetime. Input `Data` is immutable; output `Data` exposes `bytesMut()` and `asSliceMut()`. DSD formats are supported only by the raw builders, matching CPAL's lack of a DSD `SizedSample` implementation.

Streams expose CPAL's `play()`, `pause()`, `bufferSize()`, and `now()`. `now()` returns a `StreamInstant`. The binding adds `state()` and synchronous, idempotent `close()` for JavaScript resource management.

Closing is safe from inside a data callback. Shutdown wakes the waiting native audio callback before the native stream is dropped.

## Sample formats and sample traits

No stream conversion is implicit.

| `SampleFormat` | Typed array | Notes |
| --- | --- | --- |
| `I8` | `Int8Array` | |
| `I16` | `Int16Array` | |
| `I24` | `Int32Array` | −8,388,608…8,388,607 |
| `I32` | `Int32Array` | |
| `I64` | `BigInt64Array` | |
| `U8` | `Uint8Array` | |
| `U16` | `Uint16Array` | |
| `U24` | `Uint32Array` | 0…16,777,215 |
| `U32` | `Uint32Array` | |
| `U64` | `BigUint64Array` | |
| `F32` | `Float32Array` | |
| `F64` | `Float64Array` | |
| `DsdU8` | `Uint8Array` | Raw streams only |
| `DsdU16` | `Uint16Array` | Raw streams only |
| `DsdU32` | `Uint32Array` | Raw streams only |

Each format exposes `sampleSize()`, `bitsPerSample()`, `isInt()`, `isUint()`, `isFloat()`, and `isDsd()`. CPAL's re-exported `Sample`, `FromSample`, and `SizedSample` traits are represented by the `Sample`, `FromSample`, and `SizedSample` utility objects and typed signatures. `I24` and `U24` expose their checked and unchecked constructors, bounds, equilibrium, and inner value.

## Timestamps and errors

`StreamInstant`, `InputStreamTimestamp`, `OutputStreamTimestamp`, `InputCallbackInfo`, and `OutputCallbackInfo` mirror CPAL. Durations and `asNanos()` use `bigint`, preserving `u128` timestamp precision.

Native failures throw or deliver a `CpalError`. `error.kind()` returns the matching `ErrorKind` value; `error.message` is the JavaScript `Error` message, and `error.cpalMessage()` is the CPAL optional-message equivalent. Binding-only failures use additional documented codes such as `CALLBACK_FAILED` and map to `ErrorKind.Other`.

Canonical error callbacks use the same synchronous bridge as data callbacks, so every native CPAL error is delivered in order and cannot be suppressed by an audio-task quota. The queued convenience API reserves callback capacity for errors and coalesces only duplicate errors that are already pending.

## Backend-specific hosts

The JACK and PipeWire subpath builds export their concrete CPAL host types:

```js
if (!cpal.PipeWireHost) throw new Error('This build does not include PipeWire');
const host = new cpal.PipeWireHost();
host.setConnectAutomatically(false);

if (!cpal.JackHost) throw new Error('This build does not include JACK');
const jack = new cpal.JackHost();
jack.setConnectAutomatically(false);
jack.setStartServerAutomatically(true);
const namedOutput = jack.outputDeviceWithName('node-cpal');
```

These methods intentionally have CPAL's exact timing and behavior. In CPAL 0.18.2, `JackHost.new()` initializes default devices before the setters run; node-cpal does not pretend those setters were applied earlier.

Source builds with `--features test-host` conditionally export structural `CustomHost`, `CustomDevice`, and `CustomStream` adapters corresponding to CPAL's `from_host`, `from_device`, and `from_stream` APIs.

## Convenience API

The previous higher-level API is namespaced under `cpal.convenience`:

```js
const { convenience } = require('node-cpal');

const device = convenience.getDefaultOutputDevice();
const config = convenience.getDefaultOutputConfig(device.deviceId);
const stream = await convenience.createOutputStream({
  deviceId: device.deviceId,
  config,
  mode: 'pull',
  autoStart: true,
  onData({ frames, channels }) {
    return new Float32Array(frames * channels);
  },
  onError(error) {
    console.error(error.code, error.message);
  },
});

await stream.close();
```

This API provides flattened discovery, stable-ID lookup, bounded input delivery, nonblocking push writes with `onDrain`, prefetched pull output, and CoreAudio/WASAPI loopback helpers. It is implemented on top of CPAL but is not part of CPAL's API. The runnable examples use the canonical API; the convenience facade retains its own unit, hardware, stress, and benchmark coverage.

## Building and testing

```bash
npm ci
npm run debug
npm test
npm run test:hardware # requires real audio devices
cargo fmt --check
```

Optional source features are passed after `--`:

```bash
npm run build -- --features backend-pipewire
npm run build -- --features realtime-dbus
```

This remains useful for development or custom feature combinations. The build
replaces the local `index.node`; import the matching package subpath to verify
that its requested feature is present. Install the selected backend's native
development libraries first.

Hardware suites access microphones and speakers and are opt-in:

```bash
npm run test:hardware
npm run benchmark:audio
```

See [PUBLISHING.md](./PUBLISHING.md) for release packaging details.
