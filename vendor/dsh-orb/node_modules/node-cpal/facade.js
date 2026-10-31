const path = require('path');
const os = require('os');
const fs = require('fs');
const cpalValues = require('./cpal-values');
const PACKAGE_NAME = require('./package.json').name || 'node-cpal';

const {
  SAMPLE_RATE_CD,
  SAMPLE_RATE_48K,
  SampleFormat,
  Sample,
  FromSample,
  SizedSample,
  I24,
  U24,
  ErrorKind,
  DeviceType,
  InterfaceType,
  DeviceDirection,
  HostId,
  DeviceId,
  DeviceDescription,
  DeviceDescriptionBuilder,
  BufferSize,
  SupportedBufferSize,
  StreamConfig: CpalStreamConfig,
  SupportedStreamConfig,
  SupportedStreamConfigRange,
  StreamInstant,
  InputStreamTimestamp,
  OutputStreamTimestamp,
  InputCallbackInfo: CpalInputCallbackInfo,
  OutputCallbackInfo: CpalOutputCallbackInfo,
  Data,
  _normalizeErrorKind: normalizeErrorKind,
  _normalizeSampleFormat: normalizeSampleFormat,
  _registerHostIds: registerHostIds,
  _setErrorFactory: setCpalErrorFactory,
} = cpalValues;

const BINDING_TARGETS = Object.freeze({
  default: new Set([
    'darwin-x64',
    'darwin-arm64',
    'linux-x64',
    'linux-arm64',
    'win32-x64',
  ]),
  jack: new Set([
    'darwin-x64',
    'darwin-arm64',
    'linux-x64',
    'linux-arm64',
    'win32-x64',
  ]),
  pipewire: new Set(['linux-x64', 'linux-arm64']),
  pulseaudio: new Set(['linux-x64', 'linux-arm64']),
  asio: new Set(['win32-x64']),
});

const SAMPLE_ARRAYS = Object.freeze({
  i8: Int8Array,
  i16: Int16Array,
  i24: Int32Array,
  i32: Int32Array,
  i64: BigInt64Array,
  u8: Uint8Array,
  u16: Uint16Array,
  u24: Uint32Array,
  u32: Uint32Array,
  u64: BigUint64Array,
  f32: Float32Array,
  f64: Float64Array,
  dsdu8: Uint8Array,
  dsdu16: Uint16Array,
  dsdu32: Uint32Array,
});

class CpalError extends Error {
  constructor(code, message = null, options = {}) {
    const kind = normalizeErrorKind(code);
    const explicitMessage = message == null ? null : String(message);
    super(
      explicitMessage === null ? kind.toString() : explicitMessage,
      options.cause === undefined ? undefined : { cause: options.cause }
    );
    this.name = 'CpalError';
    this.code = code && typeof code === 'object' && typeof code.value === 'string'
      ? code.value
      : code || 'OTHER';
    this._cpalMessage = options.cpalMessage === undefined
      ? explicitMessage
      : options.cpalMessage;
    if (options.operation) this.operation = options.operation;
  }

  static new(kind) {
    return new CpalError(kind);
  }

  static withMessage(kind, message) {
    return new CpalError(kind, message);
  }

  kind() {
    return normalizeErrorKind(this.code);
  }

  cpalMessage() {
    return this._cpalMessage;
  }
}

setCpalErrorFactory((code, message) => new CpalError(code, message));

function loadBinding(backend) {
  const platform = os.platform();
  const arch = os.arch();
  const target = `${platform}-${arch}`;
  const supportedPlatforms = ['darwin', 'linux', 'win32'];
  const supportedArchs = ['x64', 'arm64'];
  const variant = backend || 'default';
  const entryPoint = backend ? `${PACKAGE_NAME}/backend-${backend}` : PACKAGE_NAME;
  const supportedTargets = BINDING_TARGETS[variant];

  if (!supportedTargets) {
    throw new CpalError(
      'UNSUPPORTED_OPERATION',
      `Unknown node-cpal backend: ${String(backend)}`,
      { operation: 'loadBinding' }
    );
  }

  if (!supportedPlatforms.includes(platform)) {
    throw new CpalError(
      'UNSUPPORTED_OPERATION',
      `Unsupported platform: ${platform}. node-cpal supports: ${supportedPlatforms.join(', ')}`,
      { operation: 'loadBinding' }
    );
  }
  if (!supportedArchs.includes(arch)) {
    throw new CpalError(
      'UNSUPPORTED_OPERATION',
      `Unsupported architecture: ${arch}. node-cpal supports: ${supportedArchs.join(', ')}`,
      { operation: 'loadBinding' }
    );
  }
  if (!supportedTargets.has(target)) {
    throw new CpalError(
      'UNSUPPORTED_OPERATION',
      `${entryPoint} does not publish a native binary for ${target}`,
      { operation: 'loadBinding' }
    );
  }

  const publishedPath = backend
    ? path.join(__dirname, 'bin', `backend-${backend}`, target, 'index.node')
    : path.join(__dirname, 'bin', target, 'index.node');

  try {
    try {
      return require(publishedPath);
    } catch (publishedError) {
      if (fs.existsSync(publishedPath)) throw publishedError;
      return require(path.join(__dirname, 'index.node'));
    }
  } catch (error) {
    throw new CpalError(
      'BINDING_LOAD_FAILED',
      `Failed to load ${entryPoint} binary for ${target}: ${error.message}`,
      { operation: 'loadBinding', cause: error }
    );
  }
}

function createFacade(backend = null) {
  const native = loadBinding(backend);

  function asCpalError(error, operation) {
    if (error instanceof CpalError) return error;
    return new CpalError(error && error.code ? error.code : 'OTHER', String(error && error.message ? error.message : error), {
      operation: error && error.operation ? error.operation : operation,
      cause: error,
      cpalMessage: error && Object.hasOwn(error, 'cpalMessage')
        ? error.cpalMessage
        : undefined,
    });
  }

  function requireObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`${name} must be an object`);
    }
    return value;
  }

  function requireFunction(value, name) {
    if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
    return value;
  }

  function requirePositiveInteger(
    value,
    name,
    minimum = 1,
    maximum = Number.MAX_SAFE_INTEGER
  ) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(
        `${name} must be an integer between ${minimum} and ${maximum}`
      );
    }
    return value;
  }

  function normalizeDiscoveryOptions(options) {
    if (options === undefined) return { hostId: null, direction: 'all' };
    requireObject(options, 'options');
    const hostId = options.hostId == null ? null : options.hostId;
    if (hostId !== null && typeof hostId !== 'string') {
      throw new TypeError('options.hostId must be a string');
    }
    const direction = options.direction === undefined ? 'all' : options.direction;
    if (!['all', 'input', 'output'].includes(direction)) {
      throw new RangeError("options.direction must be 'all', 'input', or 'output'");
    }
    if (options.hostOptions !== undefined) {
      requireObject(options.hostOptions, 'options.hostOptions');
    }
    return { hostId, direction, hostOptions: options.hostOptions };
  }

  function normalizeConfig(config, options) {
    requireObject(config, 'options.config');
    const sampleFormat = config.sampleFormat;
    if (!Object.hasOwn(SAMPLE_ARRAYS, sampleFormat)) {
      throw new RangeError(`Unsupported sample format: ${String(sampleFormat)}`);
    }
    const channels = requirePositiveInteger(
      config.channels,
      'options.config.channels',
      1,
      65_535
    );
    const sampleRate = requirePositiveInteger(
      config.sampleRate,
      'options.config.sampleRate',
      1,
      4_294_967_295
    );

    let bufferSizeFrames = null;
    if (config.bufferSize !== undefined) {
      requireObject(config.bufferSize, 'options.config.bufferSize');
      if (config.bufferSize.type === 'fixed') {
        bufferSizeFrames = requirePositiveInteger(
          config.bufferSize.frames,
          'options.config.bufferSize.frames',
          1,
          4_294_967_295
        );
      } else if (config.bufferSize.type !== 'default') {
        throw new RangeError("options.config.bufferSize.type must be 'default' or 'fixed'");
      }
    }

    let timeoutMs = null;
    if (options.timeoutMs !== undefined && options.timeoutMs !== null) {
      timeoutMs = requirePositiveInteger(options.timeoutMs, 'options.timeoutMs', 0);
    }
    const queueCapacityBuffers = options.queueCapacityBuffers === undefined
      ? 32
      : requirePositiveInteger(
        options.queueCapacityBuffers,
        'options.queueCapacityBuffers',
        2,
        4096
      );

    return {
      channels,
      sampleRate,
      sampleFormat,
      bufferSizeFrames,
      timeoutMs,
      queueCapacityBuffers,
    };
  }

  function validateSampleArray(data, sampleFormat, expectedSamples) {
    const Constructor = SAMPLE_ARRAYS[sampleFormat];
    if (!(data instanceof Constructor)) {
      throw new TypeError(`Expected ${Constructor.name} for ${sampleFormat} audio`);
    }
    if (expectedSamples !== undefined && data.length !== expectedSamples) {
      throw new RangeError(
        `Expected ${expectedSamples} samples for the requested buffer, received ${data.length}`
      );
    }
    if (sampleFormat === 'i24') {
      for (const sample of data) {
        if (sample < -0x800000 || sample > 0x7fffff) {
          throw new RangeError('i24 samples must be between -8388608 and 8388607');
        }
      }
    } else if (sampleFormat === 'u24') {
      for (const sample of data) {
        if (sample > 0xffffff) {
          throw new RangeError('u24 samples must be between 0 and 16777215');
        }
      }
    }
    return data;
  }

  function validateWriteBuffer(data, sampleFormat, channels) {
    validateSampleArray(data, sampleFormat);
    if (data.length === 0 || data.length % channels !== 0) {
      throw new CpalError(
        'INVALID_BUFFER',
        `Audio data must contain one or more complete ${channels}-channel frames`,
        { operation: 'write' }
      );
    }
    return data;
  }

  function createSilence(sampleFormat, length) {
    const Constructor = SAMPLE_ARRAYS[sampleFormat];
    const data = new Constructor(length);
    switch (sampleFormat) {
      case 'u8':
        data.fill(128);
        break;
      case 'u16':
        data.fill(32768);
        break;
      case 'u24':
        data.fill(8388608);
        break;
      case 'u32':
        data.fill(2147483648);
        break;
      case 'u64':
        data.fill(1n << 63n);
        break;
      case 'dsdu8':
        data.fill(0x69);
        break;
      case 'dsdu16':
        data.fill(0x6969);
        break;
      case 'dsdu32':
        data.fill(0x69696969);
        break;
    }
    return data;
  }

  function canonicalNativeCall(operation, ...arguments_) {
    try {
      return native[operation](...arguments_);
    } catch (error) {
      throw asCpalError(error, operation.replace(/^_cpal/, ''));
    }
  }

  const ALL_HOSTS = Object.freeze(registerHostIds(
    native._cpalAllHosts ? native._cpalAllHosts() : native.getHosts()
  ));

  if (backend !== null && !ALL_HOSTS.some((id) => id.toString() === backend)) {
    throw new CpalError(
      'BINDING_LOAD_FAILED',
      `The loaded native addon was not compiled with the backend-${backend} feature`,
      { operation: 'loadBinding' }
    );
  }

  const canonicalHostFinalizer = new FinalizationRegistry((handle) => {
    try {
      if (native._cpalReleaseHost) native._cpalReleaseHost(handle);
    } catch (_) {
      // Native resources are best-effort during garbage collection.
    }
  });

  const canonicalDeviceFinalizer = new FinalizationRegistry((handle) => {
    try {
      if (native._cpalReleaseDevice) native._cpalReleaseDevice(handle);
    } catch (_) {
      // Native resources are best-effort during garbage collection.
    }
  });

  function hostIdFromDescriptor(descriptor) {
    return HostId.fromString(descriptor.id);
  }

  function wrapDeviceDescription(descriptor) {
    return new DeviceDescription(descriptor);
  }

  function wrapSupportedConfigRange(config) {
    return new SupportedStreamConfigRange(config);
  }

  function wrapSupportedConfig(config) {
    return new SupportedStreamConfig(config);
  }

  class Host {
    constructor(descriptor) {
      requireObject(descriptor, 'host descriptor');
      this._handle = descriptor.handle;
      this._id = hostIdFromDescriptor(descriptor);
      this._closed = false;
      canonicalHostFinalizer.register(this, this._handle, this);
    }

    static isAvailable() {
      return availableHosts().length > 0;
    }

    id() {
      return this._id;
    }

    devices() {
      return this._devices('all');
    }

    inputDevices() {
      return this._devices('input');
    }

    outputDevices() {
      return this._devices('output');
    }

    deviceById(id) {
      this._assertOpen('host.deviceById');
      const deviceId = id instanceof DeviceId ? id : DeviceId.fromString(String(id));
      const descriptor = canonicalNativeCall(
        '_cpalHostDeviceById',
        this._handle,
        deviceId.toString()
      );
      return descriptor === null ? null : new Device(descriptor);
    }

    defaultInputDevice() {
      return this._defaultDevice(true);
    }

    defaultOutputDevice() {
      return this._defaultDevice(false);
    }

    close() {
      if (this._closed) return;
      this._closed = true;
      canonicalHostFinalizer.unregister(this);
      canonicalNativeCall('_cpalReleaseHost', this._handle);
    }

    _devices(direction) {
      this._assertOpen(`host.${direction === 'all' ? 'devices' : `${direction}Devices`}`);
      return canonicalNativeCall('_cpalHostDevices', this._handle, direction)
        .map((descriptor) => new Device(descriptor));
    }

    _defaultDevice(input) {
      this._assertOpen(input ? 'host.defaultInputDevice' : 'host.defaultOutputDevice');
      const descriptor = canonicalNativeCall('_cpalHostDefaultDevice', this._handle, input);
      return descriptor === null ? null : new Device(descriptor);
    }

    _assertOpen(operation) {
      if (this._closed) {
        throw new CpalError('INVALID_INPUT', 'Host is closed', { operation });
      }
    }
  }

  class JackHost extends Host {
    constructor(descriptor = canonicalNativeCall('_cpalHostFromId', 'jack')) {
      super(descriptor);
    }

    static isAvailable() {
      return availableHosts().some((id) => id.toString() === 'jack');
    }

    setConnectAutomatically(value) {
      this._setBooleanOption('connectAutomatically', value);
    }

    setStartServerAutomatically(value) {
      this._setBooleanOption('startServerAutomatically', value);
    }

    inputDeviceWithName(name) {
      return this._namedDevice(name, true);
    }

    outputDeviceWithName(name) {
      return this._namedDevice(name, false);
    }

    _setBooleanOption(option, value) {
      this._assertOpen(`jackHost.${option}`);
      if (typeof value !== 'boolean') throw new TypeError('value must be a boolean');
      canonicalNativeCall('_cpalHostSetOption', this._handle, option, value);
    }

    _namedDevice(name, input) {
      this._assertOpen(input ? 'jackHost.inputDeviceWithName' : 'jackHost.outputDeviceWithName');
      if (typeof name !== 'string') throw new TypeError('name must be a string');
      const descriptor = canonicalNativeCall('_cpalJackNamedDevice', this._handle, name, input);
      return descriptor === null ? null : new Device(descriptor);
    }
  }

  class PipeWireHost extends Host {
    constructor(descriptor = canonicalNativeCall('_cpalHostFromId', 'pipewire')) {
      super(descriptor);
    }

    static isAvailable() {
      return availableHosts().some((id) => id.toString() === 'pipewire');
    }

    setConnectAutomatically(value) {
      this._assertOpen('pipeWireHost.setConnectAutomatically');
      if (typeof value !== 'boolean') throw new TypeError('value must be a boolean');
      canonicalNativeCall(
        '_cpalHostSetOption',
        this._handle,
        'connectAutomatically',
        value
      );
    }
  }

  function requireAdapterMethod(adapter, method, owner) {
    const callback = adapter && adapter[method];
    if (typeof callback !== 'function') {
      throw new TypeError(`${owner} adapter must implement ${method}()`);
    }
    return callback.bind(adapter);
  }

  class CustomHost {
    constructor(adapter) {
      requireObject(adapter, 'host adapter');
      this._adapter = adapter;
      this._closed = false;
    }

    static fromHost(adapter) {
      return new CustomHost(adapter);
    }

    static isAvailable() {
      return false;
    }

    id() {
      return HostId.fromString('custom');
    }

    devices() {
      this._assertOpen('customHost.devices');
      return Array.from(
        requireAdapterMethod(this._adapter, 'devices', 'CustomHost')(),
        wrapCustomDevice
      );
    }

    inputDevices() {
      return this.devices().filter((device) => device.supportsInput());
    }

    outputDevices() {
      return this.devices().filter((device) => device.supportsOutput());
    }

    deviceById(id) {
      const wanted = id instanceof DeviceId ? id : DeviceId.fromString(String(id));
      return this.devices().find((device) => device.id().equals(wanted)) || null;
    }

    defaultInputDevice() {
      return this._defaultDevice('defaultInputDevice');
    }

    defaultOutputDevice() {
      return this._defaultDevice('defaultOutputDevice');
    }

    close() {
      this._closed = true;
    }

    _defaultDevice(method) {
      this._assertOpen(`customHost.${method}`);
      const value = requireAdapterMethod(this._adapter, method, 'CustomHost')();
      return value == null ? null : wrapCustomDevice(value);
    }

    _assertOpen(operation) {
      if (this._closed) {
        throw new CpalError('INVALID_INPUT', 'Custom host is closed', { operation });
      }
    }
  }

  class CustomDevice {
    constructor(adapter) {
      requireObject(adapter, 'device adapter');
      this._adapter = adapter;
      this._closed = false;
    }

    static fromDevice(adapter) {
      return new CustomDevice(adapter);
    }

    description() {
      this._assertOpen('customDevice.description');
      const value = requireAdapterMethod(this._adapter, 'description', 'CustomDevice')();
      return value instanceof DeviceDescription ? value : new DeviceDescription(value);
    }

    id() {
      this._assertOpen('customDevice.id');
      const value = requireAdapterMethod(this._adapter, 'id', 'CustomDevice')();
      return value instanceof DeviceId ? value : DeviceId.fromString(String(value));
    }

    supportsInput() {
      this._assertOpen('customDevice.supportsInput');
      return typeof this._adapter.supportsInput === 'function'
        ? Boolean(this._adapter.supportsInput())
        : this.supportedInputConfigs().length > 0;
    }

    supportsOutput() {
      this._assertOpen('customDevice.supportsOutput');
      return typeof this._adapter.supportsOutput === 'function'
        ? Boolean(this._adapter.supportsOutput())
        : this.supportedOutputConfigs().length > 0;
    }

    supportedInputConfigs() {
      return this._supportedConfigs('supportedInputConfigs');
    }

    supportedOutputConfigs() {
      return this._supportedConfigs('supportedOutputConfigs');
    }

    defaultInputConfig() {
      return this._defaultConfig('defaultInputConfig');
    }

    defaultOutputConfig() {
      return this._defaultConfig('defaultOutputConfig');
    }

    buildInputStream(config, sampleFormat, dataCallback, errorCallback, timeout = null) {
      const format = this._typedStreamArguments(sampleFormat, dataCallback, errorCallback);
      return this.buildInputStreamRaw(
        config,
        format,
        (data, info) => {
          if (!(data instanceof Data)) {
            throw new TypeError('CustomDevice raw input callback must receive Data');
          }
          const samples = data.asSlice(format);
          if (samples === null) throw new TypeError('CustomDevice supplied the wrong sample format');
          const result = dataCallback(samples, info);
          if (result && typeof result.then === 'function') {
            throw new TypeError('CPAL stream callbacks must complete synchronously');
          }
        },
        errorCallback,
        timeout
      );
    }

    buildOutputStream(config, sampleFormat, dataCallback, errorCallback, timeout = null) {
      const format = this._typedStreamArguments(sampleFormat, dataCallback, errorCallback);
      return this.buildOutputStreamRaw(
        config,
        format,
        (data, info) => {
          if (!(data instanceof Data)) {
            throw new TypeError('CustomDevice raw output callback must receive Data');
          }
          const samples = data.asSliceMut(format);
          if (samples === null) throw new TypeError('CustomDevice supplied the wrong sample format');
          const result = dataCallback(samples, info);
          if (result && typeof result.then === 'function') {
            throw new TypeError('CPAL stream callbacks must complete synchronously');
          }
          validateSampleArray(samples, format.value);
        },
        errorCallback,
        timeout
      );
    }

    buildInputStreamRaw(config, sampleFormat, dataCallback, errorCallback, timeout = null) {
      return this._buildStream(
        'buildInputStreamRaw',
        config,
        sampleFormat,
        dataCallback,
        errorCallback,
        timeout
      );
    }

    buildOutputStreamRaw(config, sampleFormat, dataCallback, errorCallback, timeout = null) {
      return this._buildStream(
        'buildOutputStreamRaw',
        config,
        sampleFormat,
        dataCallback,
        errorCallback,
        timeout
      );
    }

    clone() {
      this._assertOpen('customDevice.clone');
      return new CustomDevice(this._adapter);
    }

    equals(other) {
      return other instanceof CustomDevice && this.id().equals(other.id());
    }

    toString() {
      return this.description().name();
    }

    close() {
      this._closed = true;
    }

    _supportedConfigs(method) {
      this._assertOpen(`customDevice.${method}`);
      return Array.from(
        requireAdapterMethod(this._adapter, method, 'CustomDevice')(),
        (config) => config instanceof SupportedStreamConfigRange
          ? config
          : new SupportedStreamConfigRange(config)
      );
    }

    _defaultConfig(method) {
      this._assertOpen(`customDevice.${method}`);
      const config = requireAdapterMethod(this._adapter, method, 'CustomDevice')();
      return config instanceof SupportedStreamConfig
        ? config
        : new SupportedStreamConfig(config);
    }

    _typedStreamArguments(sampleFormat, dataCallback, errorCallback) {
      requireFunction(dataCallback, 'dataCallback');
      requireFunction(errorCallback, 'errorCallback');
      const format = normalizeSampleFormat(sampleFormat);
      if (format.isDsd()) {
        throw new CpalError(
          'UNSUPPORTED_OPERATION',
          'DSD formats are only available through CPAL raw stream builders',
          { operation: 'customDevice.buildStream' }
        );
      }
      return format;
    }

    _buildStream(method, config, sampleFormat, dataCallback, errorCallback, timeout) {
      this._assertOpen(`customDevice.${method}`);
      requireFunction(dataCallback, 'dataCallback');
      requireFunction(errorCallback, 'errorCallback');
      const stream = requireAdapterMethod(this._adapter, method, 'CustomDevice')(
        config instanceof CpalStreamConfig ? config : new CpalStreamConfig(config),
        normalizeSampleFormat(sampleFormat),
        dataCallback,
        errorCallback,
        normalizeTimeout(timeout)
      );
      return stream instanceof CustomStream || stream instanceof Stream
        ? stream
        : CustomStream.fromStream(stream);
    }

    _assertOpen(operation) {
      if (this._closed) {
        throw new CpalError('INVALID_INPUT', 'Custom device is closed', { operation });
      }
    }
  }

  class CustomStream {
    constructor(adapter) {
      requireObject(adapter, 'stream adapter');
      this._adapter = adapter;
      this._closed = false;
    }

    static fromStream(adapter) {
      return new CustomStream(adapter);
    }

    play() {
      this._call('play');
    }

    pause() {
      this._call('pause');
    }

    bufferSize() {
      return this._call('bufferSize');
    }

    now() {
      const value = this._call('now');
      if (!(value instanceof StreamInstant)) {
        throw new TypeError('CustomStream now() must return a StreamInstant');
      }
      return value;
    }

    state() {
      if (this._closed) return 'closed';
      return typeof this._adapter.state === 'function' ? this._adapter.state() : 'paused';
    }

    close() {
      if (this._closed) return;
      this._closed = true;
      if (typeof this._adapter.close === 'function') this._adapter.close();
    }

    _call(method) {
      if (this._closed) {
        throw new CpalError('STREAM_CLOSED', 'Custom stream is closed', {
          operation: `customStream.${method}`,
        });
      }
      return requireAdapterMethod(this._adapter, method, 'CustomStream')();
    }
  }

  function wrapCustomDevice(value) {
    return value instanceof CustomDevice ? value : CustomDevice.fromDevice(value);
  }

  function wrapHost(descriptor) {
    if (descriptor.platformKind === 'jack') return new JackHost(descriptor);
    if (descriptor.platformKind === 'pipewire') return new PipeWireHost(descriptor);
    return new Host(descriptor);
  }

  class Device {
    constructor(descriptor) {
      requireObject(descriptor, 'device descriptor');
      this._handle = descriptor.handle;
      this._closed = false;
      canonicalDeviceFinalizer.register(this, this._handle, this);
    }

    description() {
      this._assertOpen('device.description');
      return wrapDeviceDescription(
        canonicalNativeCall('_cpalDeviceDescription', this._handle)
      );
    }

    clone() {
      this._assertOpen('device.clone');
      return new Device(canonicalNativeCall('_cpalCloneDevice', this._handle));
    }

    id() {
      this._assertOpen('device.id');
      return DeviceId.fromString(canonicalNativeCall('_cpalDeviceId', this._handle));
    }

    supportsInput() {
      this._assertOpen('device.supportsInput');
      return canonicalNativeCall('_cpalDeviceSupports', this._handle, true);
    }

    supportsOutput() {
      this._assertOpen('device.supportsOutput');
      return canonicalNativeCall('_cpalDeviceSupports', this._handle, false);
    }

    supportedInputConfigs() {
      return this._supportedConfigs(true);
    }

    supportedOutputConfigs() {
      return this._supportedConfigs(false);
    }

    defaultInputConfig() {
      return this._defaultConfig(true);
    }

    defaultOutputConfig() {
      return this._defaultConfig(false);
    }

    buildInputStream(config, sampleFormat, dataCallback, errorCallback, timeout = null) {
      return buildCanonicalStream(
        this,
        true,
        false,
        config,
        sampleFormat,
        dataCallback,
        errorCallback,
        timeout
      );
    }

    buildOutputStream(config, sampleFormat, dataCallback, errorCallback, timeout = null) {
      return buildCanonicalStream(
        this,
        false,
        false,
        config,
        sampleFormat,
        dataCallback,
        errorCallback,
        timeout
      );
    }

    buildInputStreamRaw(config, sampleFormat, dataCallback, errorCallback, timeout = null) {
      return buildCanonicalStream(
        this,
        true,
        true,
        config,
        sampleFormat,
        dataCallback,
        errorCallback,
        timeout
      );
    }

    buildOutputStreamRaw(config, sampleFormat, dataCallback, errorCallback, timeout = null) {
      return buildCanonicalStream(
        this,
        false,
        true,
        config,
        sampleFormat,
        dataCallback,
        errorCallback,
        timeout
      );
    }

    equals(other) {
      this._assertOpen('device.equals');
      if (!(other instanceof Device)) return false;
      other._assertOpen('device.equals');
      return canonicalNativeCall('_cpalDeviceEquals', this._handle, other._handle);
    }

    toString() {
      this._assertOpen('device.toString');
      return canonicalNativeCall('_cpalDeviceToString', this._handle);
    }

    close() {
      if (this._closed) return;
      this._closed = true;
      canonicalDeviceFinalizer.unregister(this);
      canonicalNativeCall('_cpalReleaseDevice', this._handle);
    }

    _supportedConfigs(input) {
      this._assertOpen(input ? 'device.supportedInputConfigs' : 'device.supportedOutputConfigs');
      return canonicalNativeCall('_cpalDeviceSupportedConfigs', this._handle, input)
        .map(wrapSupportedConfigRange);
    }

    _defaultConfig(input) {
      this._assertOpen(input ? 'device.defaultInputConfig' : 'device.defaultOutputConfig');
      return wrapSupportedConfig(
        canonicalNativeCall('_cpalDeviceDefaultConfig', this._handle, input)
      );
    }

    _assertOpen(operation) {
      if (this._closed) {
        throw new CpalError('INVALID_INPUT', 'Device is closed', { operation });
      }
    }
  }

  function availableHosts() {
    const descriptors = canonicalNativeCall('_cpalAvailableHosts');
    return descriptors.map((descriptor) => HostId.fromString(descriptor.id));
  }

  function defaultHost() {
    return wrapHost(canonicalNativeCall('_cpalDefaultHost'));
  }

  function hostFromId(id) {
    const hostId = id instanceof HostId ? id : HostId.fromString(String(id));
    return wrapHost(canonicalNativeCall('_cpalHostFromId', hostId.toString()));
  }

  const canonicalStreamFinalizer = new FinalizationRegistry((id) => {
    try {
      native._cpalStreamClose(id);
    } catch (_) {
      // Native resources are best-effort during garbage collection.
    }
  });

  class Stream {
    constructor(descriptor) {
      this._id = descriptor.id;
      this._closed = false;
      canonicalStreamFinalizer.register(this, this._id, this);
    }

    play() {
      this._assertOpen('stream.play');
      canonicalNativeCall('_cpalStreamPlay', this._id);
    }

    pause() {
      this._assertOpen('stream.pause');
      canonicalNativeCall('_cpalStreamPause', this._id);
    }

    bufferSize() {
      this._assertOpen('stream.bufferSize');
      return canonicalNativeCall('_cpalStreamBufferSize', this._id);
    }

    now() {
      this._assertOpen('stream.now');
      return streamInstantFromNanos(canonicalNativeCall('_cpalStreamNow', this._id));
    }

    state() {
      return this._closed
        ? 'closed'
        : canonicalNativeCall('_cpalStreamState', this._id);
    }

    close() {
      if (this._closed) return;
      this._closed = true;
      canonicalStreamFinalizer.unregister(this);
      canonicalNativeCall('_cpalStreamClose', this._id);
    }

    _assertOpen(operation) {
      if (this._closed) {
        throw new CpalError('STREAM_CLOSED', 'Stream is closed', { operation });
      }
    }
  }

  function streamInstantFromNanos(value) {
    if (typeof value !== 'bigint' || value < 0n) {
      throw new TypeError('native stream timestamp must be a non-negative bigint');
    }
    return new StreamInstant(value / 1_000_000_000n, Number(value % 1_000_000_000n));
  }

  function wrapCanonicalCallbackInfo(info) {
    const callback = streamInstantFromNanos(info.callbackTimeNs);
    if (info.kind === 'input') {
      return new CpalInputCallbackInfo(new InputStreamTimestamp(
        callback,
        streamInstantFromNanos(info.captureTimeNs)
      ));
    }
    return new CpalOutputCallbackInfo(new OutputStreamTimestamp(
      callback,
      streamInstantFromNanos(info.playbackTimeNs)
    ));
  }

  function normalizeCanonicalStreamConfig(config) {
    if (config instanceof SupportedStreamConfig) config = config.config();
    if (!(config instanceof CpalStreamConfig)) {
      config = new CpalStreamConfig(config);
    }
    return {
      channels: config.channels,
      sampleRate: config.sampleRate,
      bufferSizeFrames: config.bufferSize.type === 'fixed'
        ? config.bufferSize.frames
        : null,
    };
  }

  function normalizeTimeout(timeout) {
    if (timeout === undefined || timeout === null) return null;
    if (typeof timeout !== 'bigint' || timeout < 0n) {
      throw new RangeError('timeout must be a non-negative bigint in nanoseconds or null');
    }
    return timeout;
  }

  function invokeCanonicalErrorCallback(callback, error, operation) {
    const cpalError = error instanceof CpalError
      ? error
      : asCpalError(error, operation);
    try {
      callback(cpalError);
    } catch (callbackError) {
      queueMicrotask(() => {
        throw callbackError;
      });
    }
  }

  function buildCanonicalStream(
    device,
    input,
    raw,
    config,
    sampleFormatValue,
    dataCallback,
    errorCallback,
    timeout
  ) {
    device._assertOpen(input ? 'device.buildInputStream' : 'device.buildOutputStream');
    requireFunction(dataCallback, 'dataCallback');
    requireFunction(errorCallback, 'errorCallback');
    const sampleFormat = normalizeSampleFormat(sampleFormatValue);
    if (!raw && sampleFormat.isDsd()) {
      throw new CpalError(
        'UNSUPPORTED_OPERATION',
        'DSD formats are only available through CPAL raw stream builders',
        { operation: input ? 'device.buildInputStream' : 'device.buildOutputStream' }
      );
    }
    const nativeConfig = normalizeCanonicalStreamConfig(config);
    const nativeTimeout = normalizeTimeout(timeout);
    const reportError = (error, operation) => (
      invokeCanonicalErrorCallback(errorCallback, error, operation)
    );

    const bridgeErrorCallback = (error) => {
      reportError(error, input ? 'inputStream' : 'outputStream');
    };
    const bridgeDataCallback = (samples, nativeInfo) => {
      const info = wrapCanonicalCallbackInfo(nativeInfo);
      const data = raw ? new Data(sampleFormat, samples, !input) : samples;
      try {
        const result = dataCallback(data, info);
        if (result && typeof result.then === 'function') {
          throw new TypeError('CPAL stream callbacks must complete synchronously');
        }
        if (!input) validateSampleArray(samples, sampleFormat.value);
      } catch (error) {
        if (!input) samples.set(createSilence(sampleFormat.value, samples.length));
        reportError(new CpalError(
          'CALLBACK_FAILED',
          `Stream data callback failed: ${error.message || String(error)}`,
          {
            operation: input ? 'inputDataCallback' : 'outputDataCallback',
            cause: error,
          }
        ));
      } finally {
        if (raw) data._invalidate();
      }
    };

    const descriptor = canonicalNativeCall(
      '_cpalBuildStream',
      device._handle,
      input,
      nativeConfig,
      sampleFormat.value,
      bridgeDataCallback,
      bridgeErrorCallback,
      nativeTimeout
    );
    return new Stream(descriptor);
  }

  const streamFinalizer = new FinalizationRegistry((id) => {
    try {
      native._closeStream(id);
    } catch (_) {
      // Finalizers cannot report failures to a user-owned callback safely.
    }
  });

  class AudioStream {
    constructor(descriptor, options) {
      this._id = descriptor.id;
      this._direction = descriptor.direction;
      this._sampleFormat = descriptor.sampleFormat;
      this._channels = descriptor.channels;
      this._sampleRate = descriptor.sampleRate;
      this._initialBufferSize = descriptor.bufferSizeFrames
        ?? (options.config.bufferSize && options.config.bufferSize.type === 'fixed'
          ? options.config.bufferSize.frames
          : null);
      this._onError = options.onError;
      this._closed = false;
      streamFinalizer.register(this, this._id, this);
    }

    get direction() {
      return this._direction;
    }

    get sampleFormat() {
      return this._sampleFormat;
    }

    get channels() {
      return this._channels;
    }

    get sampleRate() {
      return this._sampleRate;
    }

    get state() {
      return this._closed ? 'closed' : native._getStreamState(this._id);
    }

    play() {
      this._assertOpen('play');
      try {
        native._playStream(this._id);
      } catch (error) {
        throw asCpalError(error, 'play');
      }
    }

    pause() {
      this._assertOpen('pause');
      try {
        native._pauseStream(this._id);
      } catch (error) {
        throw asCpalError(error, 'pause');
      }
    }

    bufferSize() {
      this._assertOpen('bufferSize');
      try {
        return native._getStreamBufferSize(this._id);
      } catch (error) {
        throw asCpalError(error, 'bufferSize');
      }
    }

    now() {
      this._assertOpen('now');
      try {
        return native._getStreamNow(this._id);
      } catch (error) {
        throw asCpalError(error, 'now');
      }
    }

    async close() {
      if (this._closed) return;
      this._closed = true;
      streamFinalizer.unregister(this);
      try {
        native._closeStream(this._id);
      } catch (error) {
        throw asCpalError(error, 'close');
      }
    }

    _assertOpen(operation) {
      if (this._closed) {
        throw new CpalError('STREAM_CLOSED', 'Stream is closed', { operation });
      }
    }

    _report(error) {
      const cpalError = error instanceof CpalError
        ? error
        : new CpalError(error && error.code ? error.code : 'OTHER', error && error.message ? error.message : String(error), {
          operation: error && error.operation,
          cause: error,
        });
      try {
        this._onError(cpalError);
      } catch (callbackError) {
        queueMicrotask(() => {
          throw callbackError;
        });
      }
    }
  }

  class InputStream extends AudioStream {
    constructor(descriptor, options) {
      super(descriptor, options);
      this._onData = options.onData;
    }

    _handleNativeEvent(event) {
      if (this._closed) return;
      if (event.type === 'error') {
        this._report(event.error);
      } else if (event.type === 'data') {
        try {
          this._onData(event.data, event.info);
        } catch (error) {
          this._report(new CpalError('CALLBACK_FAILED', `Input callback failed: ${error.message}`, {
            operation: 'onData',
            cause: error,
          }));
        }
      }
    }
  }

  class PushOutputStream extends AudioStream {
    constructor(descriptor, options) {
      super(descriptor, options);
      this._onOutput = options.onOutput;
      this._onDrain = options.onDrain;
    }

    get bufferedFrames() {
      this._assertOpen('bufferedFrames');
      try {
        return native._getBufferedFrames(this._id);
      } catch (error) {
        throw asCpalError(error, 'bufferedFrames');
      }
    }

    write(data) {
      this._assertOpen('write');
      validateWriteBuffer(data, this._sampleFormat, this._channels);
      try {
        return native._writeToStream(this._id, data);
      } catch (error) {
        throw asCpalError(error, 'write');
      }
    }

    _handleNativeEvent(event) {
      if (this._closed) return;
      if (event.type === 'error') {
        this._report(event.error);
      } else if (event.type === 'drain' && this._onDrain) {
        try {
          this._onDrain();
        } catch (error) {
          this._report(new CpalError('CALLBACK_FAILED', `Drain callback failed: ${error.message}`, {
            operation: 'onDrain',
            cause: error,
          }));
        }
      } else if (event.type === 'output' && this._onOutput) {
        try {
          this._onOutput(event.info);
        } catch (error) {
          this._report(new CpalError('CALLBACK_FAILED', `Output callback failed: ${error.message}`, {
            operation: 'onOutput',
            cause: error,
          }));
        }
      }
    }
  }

  class PullOutputStream extends PushOutputStream {
    constructor(descriptor, options) {
      super(descriptor, options);
      this._onData = options.onData;
    }

    _requestBuffer(frames) {
      if (this._closed) return;
      const samples = frames * this._channels;
      let data;
      try {
        data = this._onData({
          frames,
          channels: this._channels,
          sampleFormat: this._sampleFormat,
        });
        if (data && typeof data.then === 'function') {
          throw new TypeError('Pull onData must return a typed array synchronously');
        }
        validateSampleArray(data, this._sampleFormat, samples);
      } catch (error) {
        this._report(new CpalError('CALLBACK_FAILED', `Pull callback failed: ${error.message}`, {
          operation: 'onData',
          cause: error,
        }));
        data = createSilence(this._sampleFormat, samples);
      }

      try {
        const accepted = native._writeToStream(this._id, data);
        if (!accepted) {
          this._report(new CpalError(
            'RESOURCE_EXHAUSTED',
            'Pull output queue is full; the generated buffer was dropped',
            { operation: 'write' }
          ));
        }
      } catch (error) {
        this._report(asCpalError(error, 'write'));
      }
    }

    _handleNativeEvent(event) {
      super._handleNativeEvent(event);
      if (!this._closed && event.type === 'output') {
        this._requestBuffer(event.info.frames);
      }
    }

    async _prime(count) {
      if (this._initialBufferSize == null) {
        await this.close();
        throw new CpalError(
          'UNSUPPORTED_OPERATION',
          'Pull output requires a backend that reports its negotiated buffer size',
          { operation: 'createOutputStream' }
        );
      }
      for (let index = 0; index < count; index++) {
        this._requestBuffer(this._initialBufferSize);
      }
    }
  }

  function createNativeStream(options, isInput, StreamConstructor) {
    requireObject(options, 'options');
    if (typeof options.deviceId !== 'string' || options.deviceId.length === 0) {
      throw new TypeError('options.deviceId must be a non-empty string');
    }
    requireFunction(options.onError, 'options.onError');
    if (options.autoStart !== undefined && typeof options.autoStart !== 'boolean') {
      throw new TypeError('options.autoStart must be a boolean');
    }
    const config = normalizeConfig(options.config, options);
    let weakStream;
    let descriptor;
    try {
      descriptor = native._createStream(
        options.deviceId,
        isInput,
        config,
        (event) => {
          const stream = weakStream && weakStream.deref();
          if (stream) stream._handleNativeEvent(event);
        }
      );
    } catch (error) {
      throw asCpalError(error, isInput ? 'createInputStream' : 'createOutputStream');
    }
    const stream = new StreamConstructor(descriptor, options);
    weakStream = new WeakRef(stream);
    return stream;
  }

  async function createInputStream(options) {
    requireObject(options, 'options');
    requireFunction(options.onData, 'options.onData');
    const stream = createNativeStream(options, true, InputStream);
    if (options.autoStart === true) {
      try {
        stream.play();
      } catch (error) {
        await stream.close().catch(() => {});
        throw error;
      }
    }
    return stream;
  }

  async function createOutputStream(options) {
    requireObject(options, 'options');
    if (options.onOutput !== undefined) {
      requireFunction(options.onOutput, 'options.onOutput');
    }
    if (options.onDrain !== undefined) {
      requireFunction(options.onDrain, 'options.onDrain');
    }
    const mode = options.mode === undefined ? 'push' : options.mode;
    if (!['push', 'pull'].includes(mode)) {
      throw new RangeError("options.mode must be 'push' or 'pull'");
    }
    let stream;
    if (mode === 'pull') {
      requireFunction(options.onData, 'options.onData');
      const prefetchBuffers = options.prefetchBuffers === undefined
        ? 3
        : requirePositiveInteger(
          options.prefetchBuffers,
          'options.prefetchBuffers',
          2,
          4095
        );
      const queueCapacityBuffers = options.queueCapacityBuffers === undefined
        ? 32
        : requirePositiveInteger(
          options.queueCapacityBuffers,
          'options.queueCapacityBuffers',
          2,
          4096
        );
      const normalizedOptions = {
        ...options,
        queueCapacityBuffers: Math.max(queueCapacityBuffers, prefetchBuffers + 1),
      };
      stream = createNativeStream(normalizedOptions, false, PullOutputStream);
      await stream._prime(prefetchBuffers);
    } else {
      stream = createNativeStream(options, false, PushOutputStream);
    }
    if (options.autoStart === true) {
      try {
        stream.play();
      } catch (error) {
        await stream.close().catch(() => {});
        throw error;
      }
    }
    return stream;
  }

  async function createLoopbackStream(options) {
    requireObject(options, 'options');
    const device = getDeviceById(options.deviceId);
    if (!device.supportsLoopback) {
      throw new CpalError(
        'UNSUPPORTED_OPERATION',
        `Loopback capture is not supported by the ${device.hostId} backend`,
        { operation: 'createLoopbackStream' }
      );
    }
    return createInputStream(options);
  }

  function getHosts() {
    try {
      return native.getHosts();
    } catch (error) {
      throw asCpalError(error, 'getHosts');
    }
  }

  function getDevices(options) {
    const normalized = normalizeDiscoveryOptions(options);
    try {
      return native.getDevices(normalized.hostId, normalized.direction, normalized.hostOptions);
    } catch (error) {
      throw asCpalError(error, 'getDevices');
    }
  }

  function getDefaultInputDevice(options) {
    const normalized = normalizeDiscoveryOptions(options);
    try {
      return native.getDefaultInputDevice(normalized.hostId, normalized.hostOptions);
    } catch (error) {
      throw asCpalError(error, 'getDefaultInputDevice');
    }
  }

  function getDefaultOutputDevice(options) {
    const normalized = normalizeDiscoveryOptions(options);
    try {
      return native.getDefaultOutputDevice(normalized.hostId, normalized.hostOptions);
    } catch (error) {
      throw asCpalError(error, 'getDefaultOutputDevice');
    }
  }

  function getDeviceById(deviceId) {
    if (typeof deviceId !== 'string' || deviceId.length === 0) {
      throw new TypeError('deviceId must be a non-empty string');
    }
    try {
      return native.getDeviceById(deviceId);
    } catch (error) {
      throw asCpalError(error, 'getDeviceById');
    }
  }

  function getSupportedInputConfigs(deviceId) {
    return callDeviceFunction('getSupportedInputConfigs', deviceId);
  }

  function getSupportedOutputConfigs(deviceId) {
    return callDeviceFunction('getSupportedOutputConfigs', deviceId);
  }

  function getSupportedLoopbackConfigs(deviceId) {
    const device = getDeviceById(deviceId);
    if (!device.supportsLoopback) return [];
    return getSupportedOutputConfigs(deviceId);
  }

  function callDeviceFunction(operation, deviceId) {
    if (typeof deviceId !== 'string' || deviceId.length === 0) {
      throw new TypeError('deviceId must be a non-empty string');
    }
    try {
      return native[operation](deviceId);
    } catch (error) {
      throw asCpalError(error, operation);
    }
  }

  const convenience = Object.freeze({
    CpalError,
    AudioStream,
    InputStream,
    PushOutputStream,
    PullOutputStream,
    getHosts,
    getDevices,
    getDeviceById,
    getDefaultInputDevice,
    getDefaultOutputDevice,
    getSupportedInputConfigs,
    getSupportedOutputConfigs,
    getSupportedLoopbackConfigs,
    getDefaultInputConfig: (deviceId) => callDeviceFunction('getDefaultInputConfig', deviceId),
    getDefaultOutputConfig: (deviceId) => callDeviceFunction('getDefaultOutputConfig', deviceId),
    getSupportedFormats: (deviceId) => callDeviceFunction('getSupportedFormats', deviceId),
    getSupportedSampleRates: (deviceId) => callDeviceFunction('getSupportedSampleRates', deviceId),
    getMaxChannels: (deviceId) => callDeviceFunction('getMaxChannels', deviceId),
    createInputStream,
    createOutputStream,
    createLoopbackStream,
  });

  const facade = {
    // Canonical CPAL 0.18.2 surface.
    availableHosts,
    defaultHost,
    hostFromId,
    ALL_HOSTS,
    SAMPLE_RATE_CD,
    SAMPLE_RATE_48K,
    SampleFormat,
    Sample,
    FromSample,
    SizedSample,
    I24,
    U24,
    ErrorKind,
    Error: CpalError,
    CpalError,
    DeviceType,
    InterfaceType,
    DeviceDirection,
    HostId,
    DeviceId,
    Host,
    Device,
    Stream,
    DeviceDescription,
    DeviceDescriptionBuilder,
    BufferSize,
    SupportedBufferSize,
    StreamConfig: CpalStreamConfig,
    SupportedStreamConfig,
    SupportedStreamConfigRange,
    StreamInstant,
    InputStreamTimestamp,
    OutputStreamTimestamp,
    InputCallbackInfo: CpalInputCallbackInfo,
    OutputCallbackInfo: CpalOutputCallbackInfo,
    Data,

    // Higher-level queued and loopback helpers are intentionally namespaced.
    convenience,
  };

  if (ALL_HOSTS.some((id) => id.toString() === 'jack')) {
    facade.JackHost = JackHost;
  }
  if (ALL_HOSTS.some((id) => id.toString() === 'pipewire')) {
    facade.PipeWireHost = PipeWireHost;
  }
  if (ALL_HOSTS.some((id) => id.toString() === 'custom')) {
    facade.CustomHost = CustomHost;
    facade.CustomDevice = CustomDevice;
    facade.CustomStream = CustomStream;
  }

  return facade;
}

module.exports = createFacade;
