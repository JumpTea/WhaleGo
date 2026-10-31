'use strict';

const SAMPLE_RATE_CD = 44_100;
const SAMPLE_RATE_48K = 48_000;
const U32_MAX = 0xffff_ffff;
const U64_MAX = (1n << 64n) - 1n;
const MAX_STREAM_INSTANT_NANOS = U64_MAX * 1_000_000_000n + 999_999_999n;
let createCpalError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

function requireInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  return value;
}

class EnumValue {
  constructor(name, value, display = name) {
    this.name = name;
    this.value = value;
    this._display = display;
  }

  toString() {
    return this._display;
  }

  toJSON() {
    return this.value;
  }

  [Symbol.toPrimitive](hint) {
    return hint === 'string' ? this._display : this.value;
  }
}

class SampleFormatValue extends EnumValue {
  constructor(name, value, sampleSize, bitsPerSample, category) {
    super(name, value, value);
    this._sampleSize = sampleSize;
    this._bitsPerSample = bitsPerSample;
    this._category = category;
    Object.freeze(this);
  }

  sampleSize() {
    return this._sampleSize;
  }

  bitsPerSample() {
    return this._bitsPerSample;
  }

  isInt() {
    return this._category === 'int';
  }

  isUint() {
    return this._category === 'uint';
  }

  isFloat() {
    return this._category === 'float';
  }

  isDsd() {
    return this._category === 'dsd';
  }

  equilibrium() {
    return sampleEquilibrium(this);
  }

  identity() {
    if (this.isDsd()) throw new TypeError('DSD formats do not implement CPAL Sample');
    return 1;
  }

  toSample(value, targetFormat) {
    return convertSample(value, this, targetFormat);
  }
}

function sampleFormat(name, value, size, bits, category) {
  return new SampleFormatValue(name, value, size, bits, category);
}

const SampleFormat = Object.freeze({
  I8: sampleFormat('I8', 'i8', 1, 8, 'int'),
  I16: sampleFormat('I16', 'i16', 2, 16, 'int'),
  I24: sampleFormat('I24', 'i24', 4, 24, 'int'),
  I32: sampleFormat('I32', 'i32', 4, 32, 'int'),
  I64: sampleFormat('I64', 'i64', 8, 64, 'int'),
  U8: sampleFormat('U8', 'u8', 1, 8, 'uint'),
  U16: sampleFormat('U16', 'u16', 2, 16, 'uint'),
  U24: sampleFormat('U24', 'u24', 4, 24, 'uint'),
  U32: sampleFormat('U32', 'u32', 4, 32, 'uint'),
  U64: sampleFormat('U64', 'u64', 8, 64, 'uint'),
  F32: sampleFormat('F32', 'f32', 4, 32, 'float'),
  F64: sampleFormat('F64', 'f64', 8, 64, 'float'),
  DsdU8: sampleFormat('DsdU8', 'dsdu8', 1, 1, 'dsd'),
  DsdU16: sampleFormat('DsdU16', 'dsdu16', 2, 1, 'dsd'),
  DsdU32: sampleFormat('DsdU32', 'dsdu32', 4, 1, 'dsd'),
});

const sampleFormatsByValue = new Map(
  Object.values(SampleFormat).flatMap((value) => [
    [value.value, value],
    [value.name.toLowerCase(), value],
  ])
);

function normalizeSampleFormat(value, name = 'sampleFormat') {
  if (value instanceof SampleFormatValue) return value;
  if (typeof value === 'string') {
    const format = sampleFormatsByValue.get(value.toLowerCase());
    if (format) return format;
  }
  throw new RangeError(`${name} is not a supported CPAL sample format`);
}

class I24 {
  constructor(value) {
    value = requireInteger(value, 'value', -0x800000, 0x7fffff);
    this._value = value;
    Object.freeze(this);
  }

  static new(value) {
    return Number.isInteger(value) && value >= -0x800000 && value <= 0x7fffff
      ? new I24(value)
      : null;
  }

  static from(value) {
    requireInteger(value, 'value', -0x80000000, 0x7fffffff);
    const wrapped = ((value + 0x800000) % 0x1000000 + 0x1000000) % 0x1000000;
    return new I24(wrapped - 0x800000);
  }

  static newUnchecked(value) {
    requireInteger(value, 'value', -0x80000000, 0x7fffffff);
    const sample = Object.create(I24.prototype);
    sample._value = value;
    return Object.freeze(sample);
  }

  inner() { return this._value; }
  valueOf() { return this._value; }
  toString() { return String(this._value); }
}

I24.MIN = new I24(-0x800000);
I24.MAX = new I24(0x7fffff);
I24.EQUILIBRIUM = new I24(0);

class U24 {
  constructor(value) {
    value = requireInteger(value, 'value', 0, 0xffffff);
    this._value = value;
    Object.freeze(this);
  }

  static new(value) {
    return Number.isInteger(value) && value >= 0 && value <= 0xffffff
      ? new U24(value)
      : null;
  }

  static from(value) {
    requireInteger(value, 'value', -0x80000000, 0x7fffffff);
    return new U24(((value % 0x1000000) + 0x1000000) % 0x1000000);
  }

  static newUnchecked(value) {
    requireInteger(value, 'value', -0x80000000, 0x7fffffff);
    const sample = Object.create(U24.prototype);
    sample._value = value;
    return Object.freeze(sample);
  }

  inner() { return this._value; }
  valueOf() { return this._value; }
  toString() { return String(this._value); }
}

U24.MIN = new U24(0);
U24.MAX = new U24(0xffffff);
U24.EQUILIBRIUM = new U24(0x800000);

function sampleEquilibrium(formatValue) {
  const format = normalizeSampleFormat(formatValue);
  if (format.isDsd()) throw new TypeError('DSD formats do not implement CPAL Sample');
  if (format.isFloat() || format.isInt()) {
    if (format.value === 'i24') return I24.EQUILIBRIUM;
    return format.value === 'i64' ? 0n : 0;
  }
  if (format.value === 'u24') return U24.EQUILIBRIUM;
  const value = 1n << BigInt(format.bitsPerSample() - 1);
  return format.value === 'u64' ? value : Number(value);
}

function integerSampleValue(value, format) {
  if (format.value === 'i24') value = value instanceof I24 ? value.inner() : value;
  if (format.value === 'u24') value = value instanceof U24 ? value.inner() : value;
  if (format.bitsPerSample() === 64) {
    if (typeof value !== 'bigint') throw new TypeError(`${format} samples must be bigint values`);
    return value;
  }
  if (!Number.isInteger(value)) throw new TypeError(`${format} samples must be integer values`);
  return BigInt(value);
}

function signedIntegerValue(value, format) {
  const integer = integerSampleValue(value, format);
  return format.isUint()
    ? integer - (1n << BigInt(format.bitsPerSample() - 1))
    : integer;
}

function makeIntegerSample(value, format) {
  const bits = BigInt(format.bitsPerSample());
  const minimum = format.isUint() ? 0n : -(1n << (bits - 1n));
  const maximum = format.isUint() ? (1n << bits) - 1n : (1n << (bits - 1n)) - 1n;
  if (value < minimum || value > maximum) {
    throw new RangeError(`${format} sample conversion overflowed`);
  }
  if (format.value === 'i24') return I24.newUnchecked(Number(value));
  if (format.value === 'u24') return U24.newUnchecked(Number(value));
  return format.bitsPerSample() === 64 ? value : Number(value);
}

function convertSample(value, sourceFormatValue, targetFormatValue) {
  const source = normalizeSampleFormat(sourceFormatValue, 'sourceFormat');
  const target = normalizeSampleFormat(targetFormatValue, 'targetFormat');
  if (source.isDsd() || target.isDsd()) {
    throw new TypeError('DSD formats do not implement CPAL Sample conversion');
  }
  if (source === target) return value;

  if (target.isFloat()) {
    const normalized = source.isFloat()
      ? value
      : Number(signedIntegerValue(value, source)) /
        Number(1n << BigInt(source.bitsPerSample() - 1));
    if (typeof normalized !== 'number') throw new TypeError('floating samples must be numbers');
    return target.value === 'f32' ? Math.fround(normalized) : normalized;
  }

  let signed;
  if (source.isFloat()) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value >= 1) {
      throw new RangeError('floating samples must be finite values in the range [-1, 1)');
    }
    signed = BigInt(Math.trunc(value * 2 ** (target.bitsPerSample() - 1)));
  } else {
    signed = signedIntegerValue(value, source);
    const difference = target.bitsPerSample() - source.bitsPerSample();
    signed = difference >= 0
      ? signed << BigInt(difference)
      : signed >> BigInt(-difference);
  }
  const targetValue = target.isUint()
    ? signed + (1n << BigInt(target.bitsPerSample() - 1))
    : signed;
  return makeIntegerSample(targetValue, target);
}

function signedFormat(formatValue) {
  const format = normalizeSampleFormat(formatValue);
  if (format.isFloat() || format.isInt()) return format;
  return normalizeSampleFormat(`i${format.bitsPerSample()}`);
}

function floatFormat(formatValue) {
  const format = normalizeSampleFormat(formatValue);
  return format.bitsPerSample() <= 32 ? SampleFormat.F32 : SampleFormat.F64;
}

const Sample = Object.freeze({
  equilibrium: sampleEquilibrium,
  identity(format) {
    format = normalizeSampleFormat(format);
    if (format.isDsd()) throw new TypeError('DSD formats do not implement CPAL Sample');
    return 1;
  },
  toSample: convertSample,
  fromSample(targetFormat, value, sourceFormat) {
    return convertSample(value, sourceFormat, targetFormat);
  },
  toSignedSample(value, format) {
    return convertSample(value, format, signedFormat(format));
  },
  toFloatSample(value, format) {
    return convertSample(value, format, floatFormat(format));
  },
  addAmp(value, amp, format) {
    const source = normalizeSampleFormat(format);
    if (source.isFloat()) {
      if (typeof value !== 'number' || typeof amp !== 'number') {
        throw new TypeError('floating samples and amplitudes must be numbers');
      }
      return source.value === 'f32' ? Math.fround(value + amp) : value + amp;
    }
    const signed = signedFormat(source);
    const sum = signedIntegerValue(convertSample(value, source, signed), signed) +
      signedIntegerValue(amp, signed);
    return convertSample(makeIntegerSample(sum, signed), signed, source);
  },
  mulAmp(value, amp, format) {
    if (typeof amp !== 'number') throw new TypeError('amp must be a number');
    const source = normalizeSampleFormat(format);
    const float = floatFormat(source);
    return convertSample(convertSample(value, source, float) * amp, float, source);
  },
});

const FromSample = Object.freeze({
  fromSample: Sample.fromSample,
});

const SizedSample = Object.freeze({
  format(value) {
    return normalizeSampleFormat(value);
  },
});

function makeEnum(definitions) {
  return Object.freeze(Object.fromEntries(definitions.map(([name, value, display]) => [
    name,
    Object.freeze(new EnumValue(name, value, display)),
  ])));
}

const ErrorKind = makeEnum([
  ['DeviceBusy', 'DEVICE_BUSY', 'The requested device is temporarily busy. Another application or stream may be using it.'],
  ['DeviceChanged', 'DEVICE_CHANGED', 'The audio route changed. The stream was automatically rerouted to a different device.'],
  ['DeviceNotAvailable', 'DEVICE_NOT_AVAILABLE', 'The requested audio device is not available. It may have been disconnected.'],
  ['HostUnavailable', 'HOST_UNAVAILABLE', 'The requested audio host is not available. The subsystem or daemon may not be installed or running.'],
  ['InvalidInput', 'INVALID_INPUT', 'Invalid input or argument.'],
  ['PermissionDenied', 'PERMISSION_DENIED', 'Permission denied. Grant the required access and retry.'],
  ['RealtimeDenied', 'REALTIME_DENIED', 'Real-time scheduling was refused for the audio thread. Audio may be subject to increased latency or glitches under load.'],
  ['ResourceExhausted', 'RESOURCE_EXHAUSTED', 'An OS resource limit was reached. Freeing resources and retrying may succeed.'],
  ['StreamInvalidated', 'STREAM_INVALIDATED', 'The stream configuration is no longer valid and must be rebuilt.'],
  ['UnsupportedConfig', 'UNSUPPORTED_CONFIG', 'The requested stream configuration is not supported by the device.'],
  ['UnsupportedOperation', 'UNSUPPORTED_OPERATION', 'The requested operation is not supported.'],
  ['Xrun', 'XRUN', 'A buffer underrun or overrun occurred.'],
  ['BackendError', 'BACKEND_ERROR', 'The audio backend returned an unclassified error.'],
  ['Other', 'OTHER', 'An error occurred.'],
]);

const errorKindsByCode = new Map(Object.values(ErrorKind).map((value) => [value.value, value]));

function normalizeErrorKind(value) {
  if (value instanceof EnumValue && errorKindsByCode.get(value.value) === value) return value;
  if (typeof value === 'string') {
    const direct = errorKindsByCode.get(value.toUpperCase());
    if (direct) return direct;
    const named = ErrorKind[value];
    if (named) return named;
  }
  return ErrorKind.Other;
}

const DeviceType = makeEnum([
  ['Speaker', 'speaker', 'Speaker'],
  ['Microphone', 'microphone', 'Microphone'],
  ['Headphones', 'headphones', 'Headphones'],
  ['Headset', 'headset', 'Headset'],
  ['Earpiece', 'earpiece', 'Earpiece'],
  ['Handset', 'handset', 'Handset'],
  ['HearingAid', 'hearing-aid', 'Hearing Aid'],
  ['Dock', 'dock', 'Dock'],
  ['Tuner', 'tuner', 'Tuner'],
  ['Virtual', 'virtual', 'Virtual'],
  ['Unknown', 'unknown', 'Unknown'],
]);

const InterfaceType = makeEnum([
  ['BuiltIn', 'built-in', 'Built-in'],
  ['Usb', 'usb', 'USB'],
  ['Bluetooth', 'bluetooth', 'Bluetooth'],
  ['Pci', 'pci', 'PCI'],
  ['FireWire', 'firewire', 'FireWire'],
  ['Thunderbolt', 'thunderbolt', 'Thunderbolt'],
  ['Hdmi', 'hdmi', 'HDMI'],
  ['Line', 'line', 'Line'],
  ['Spdif', 'spdif', 'S/PDIF'],
  ['Network', 'network', 'Network'],
  ['Virtual', 'virtual', 'Virtual'],
  ['DisplayPort', 'display-port', 'DisplayPort'],
  ['Aggregate', 'aggregate', 'Aggregate'],
  ['Unknown', 'unknown', 'Unknown'],
]);

const DeviceDirection = makeEnum([
  ['Input', 'input', 'Input'],
  ['Output', 'output', 'Output'],
  ['Duplex', 'duplex', 'Duplex'],
  ['Unknown', 'unknown', 'Unknown'],
]);

function normalizeEnum(value, enumeration, name) {
  if (Object.values(enumeration).includes(value)) return value;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    const match = Object.values(enumeration).find((entry) => (
      entry.value.toLowerCase() === lowered || entry.name.toLowerCase() === lowered
    ));
    if (match) return match;
  }
  throw new RangeError(`${name} is not a valid CPAL enum value`);
}

const hostIdsByValue = new Map();
const HOST_ID_VARIANTS = Object.freeze({
  aaudio: 'AAudio',
  alsa: 'Alsa',
  asio: 'Asio',
  audioworklet: 'AudioWorklet',
  coreaudio: 'CoreAudio',
  custom: 'Custom',
  jack: 'Jack',
  null: 'Null',
  pipewire: 'PipeWire',
  pulseaudio: 'PulseAudio',
  wasapi: 'Wasapi',
  webaudio: 'WebAudio',
});

class HostId {
  constructor(value, name = value) {
    this._value = requireString(value, 'value').toLowerCase();
    this._name = requireString(name, 'name');
    Object.freeze(this);
  }

  name() {
    return this._name;
  }

  toString() {
    return this._value;
  }

  toJSON() {
    return this._value;
  }

  equals(other) {
    return other instanceof HostId && other._value === this._value;
  }

  static fromString(value) {
    requireString(value, 'value');
    const result = hostIdsByValue.get(value.toLowerCase());
    if (!result) {
      throw createCpalError(
        'UNSUPPORTED_OPERATION',
        `host "${value}" is not supported on this platform`
      );
    }
    return result;
  }
}

function registerHostIds(descriptors) {
  // Backend subpath facades can coexist, so retain IDs registered by
  // earlier builds.
  return descriptors.map((descriptor) => {
    const value = String(descriptor.id).toLowerCase();
    const variant = HOST_ID_VARIANTS[value];
    const registered = variant && Object.hasOwn(HostId, variant)
      ? HostId[variant]
      : null;
    const hostId = registered instanceof HostId && registered.toString() === value
      ? registered
      : new HostId(value, String(descriptor.name));
    hostIdsByValue.set(value, hostId);
    hostIdsByValue.set(String(descriptor.name).toLowerCase(), hostId);
    if (variant && registered === null) {
      Object.defineProperty(HostId, variant, {
        configurable: false,
        enumerable: true,
        value: hostId,
        writable: false,
      });
    }
    return hostId;
  });
}

class DeviceId {
  constructor(host, id) {
    this._host = host instanceof HostId ? host : HostId.fromString(String(host));
    this._id = requireString(id, 'id');
    Object.freeze(this);
  }

  host() {
    return this._host;
  }

  id() {
    return this._id;
  }

  toString() {
    return `${this._host}:${this._id}`;
  }

  toJSON() {
    return this.toString();
  }

  equals(other) {
    return other instanceof DeviceId && other.toString() === this.toString();
  }

  static fromString(value) {
    requireString(value, 'value');
    const separator = value.indexOf(':');
    if (separator < 1) {
      throw createCpalError(
        'INVALID_INPUT',
        `failed to parse device ID "${value}": expected "host:device_id" format`
      );
    }
    return new DeviceId(
      HostId.fromString(value.slice(0, separator)),
      value.slice(separator + 1)
    );
  }
}

class DeviceDescription {
  constructor({
    name,
    manufacturer = null,
    driver = null,
    deviceType = DeviceType.Unknown,
    interfaceType = InterfaceType.Unknown,
    direction = DeviceDirection.Unknown,
    address = null,
    extended = [],
  }) {
    this._name = requireString(name, 'name');
    this._manufacturer = manufacturer == null ? null : requireString(manufacturer, 'manufacturer');
    this._driver = driver == null ? null : requireString(driver, 'driver');
    this._deviceType = normalizeEnum(deviceType, DeviceType, 'deviceType');
    this._interfaceType = normalizeEnum(interfaceType, InterfaceType, 'interfaceType');
    this._direction = normalizeEnum(direction, DeviceDirection, 'direction');
    this._address = address == null ? null : requireString(address, 'address');
    this._extended = Object.freeze(Array.from(extended, (line) => requireString(line, 'extended line')));
    Object.freeze(this);
  }

  name() { return this._name; }
  manufacturer() { return this._manufacturer; }
  driver() { return this._driver; }
  deviceType() { return this._deviceType; }
  interfaceType() { return this._interfaceType; }
  direction() { return this._direction; }
  supportsInput() {
    return this._direction === DeviceDirection.Input || this._direction === DeviceDirection.Duplex;
  }
  supportsOutput() {
    return this._direction === DeviceDirection.Output || this._direction === DeviceDirection.Duplex;
  }
  address() { return this._address; }
  extended() { return this._extended.values(); }

  toString() {
    let value = this._name;
    if (this._manufacturer !== null) value += ` (${this._manufacturer})`;
    if (this._deviceType !== DeviceType.Unknown) value += ` [${this._deviceType}]`;
    if (this._interfaceType !== InterfaceType.Unknown) value += ` via ${this._interfaceType}`;
    return value;
  }
}

class DeviceDescriptionBuilder {
  constructor(name) {
    this._description = {
      name: requireString(name, 'name'),
      manufacturer: null,
      driver: null,
      deviceType: DeviceType.Unknown,
      interfaceType: InterfaceType.Unknown,
      direction: DeviceDirection.Unknown,
      address: null,
      extended: [],
    };
  }

  manufacturer(value) {
    this._description.manufacturer = requireString(value, 'manufacturer');
    return this;
  }

  driver(value) {
    this._description.driver = requireString(value, 'driver');
    return this;
  }

  deviceType(value) {
    this._description.deviceType = normalizeEnum(value, DeviceType, 'deviceType');
    return this;
  }

  interfaceType(value) {
    this._description.interfaceType = normalizeEnum(value, InterfaceType, 'interfaceType');
    return this;
  }

  direction(value) {
    this._description.direction = normalizeEnum(value, DeviceDirection, 'direction');
    return this;
  }

  address(value) {
    this._description.address = requireString(value, 'address');
    return this;
  }

  extended(lines) {
    this._description.extended = Array.from(lines, (line) => requireString(line, 'extended line'));
    return this;
  }

  addExtendedLine(line) {
    this._description.extended.push(requireString(line, 'line'));
    return this;
  }

  build() {
    return new DeviceDescription(this._description);
  }
}

class BufferSize {
  constructor(type, frames = null) {
    this.type = type;
    this.frames = frames;
    Object.freeze(this);
  }

  static Fixed(frames) {
    return new BufferSize('fixed', requireInteger(frames, 'frames', 0, U32_MAX));
  }
}

BufferSize.Default = Object.freeze(new BufferSize('default'));

function normalizeBufferSize(value, name = 'bufferSize') {
  if (value instanceof BufferSize) return value;
  if (value == null || value === 'default' || value.type === 'default') return BufferSize.Default;
  if (value.type === 'fixed') return BufferSize.Fixed(value.frames);
  throw new TypeError(`${name} must be BufferSize.Default or BufferSize.Fixed(frames)`);
}

class SupportedBufferSize {
  constructor(type, min = null, max = null) {
    this.type = type;
    this.min = min;
    this.max = max;
    Object.freeze(this);
  }

  static Range(min, max) {
    min = requireInteger(min, 'min', 0, U32_MAX);
    max = requireInteger(max, 'max', 0, U32_MAX);
    return new SupportedBufferSize('range', min, max);
  }
}

SupportedBufferSize.Unknown = Object.freeze(new SupportedBufferSize('unknown'));

function normalizeSupportedBufferSize(value, name = 'bufferSize') {
  if (value instanceof SupportedBufferSize) return value;
  if (value == null || value.type === 'unknown') return SupportedBufferSize.Unknown;
  if (value.type === 'range') {
    return SupportedBufferSize.Range(
      value.min === undefined ? value.minFrames : value.min,
      value.max === undefined ? value.maxFrames : value.max
    );
  }
  throw new TypeError(`${name} must be SupportedBufferSize.Unknown or Range(min, max)`);
}

class StreamConfig {
  constructor(channels, sampleRate, bufferSize = BufferSize.Default) {
    if (typeof channels === 'object' && channels !== null) {
      ({ channels, sampleRate, bufferSize = BufferSize.Default } = channels);
    }
    this.channels = requireInteger(channels, 'channels', 0, 0xffff);
    this.sampleRate = requireInteger(sampleRate, 'sampleRate', 0, U32_MAX);
    this.bufferSize = normalizeBufferSize(bufferSize);
    Object.freeze(this);
  }
}

class SupportedStreamConfig {
  constructor(channels, sampleRate, bufferSize, sampleFormatValue) {
    if (typeof channels === 'object' && channels !== null) {
      ({ channels, sampleRate, bufferSize, sampleFormat: sampleFormatValue } = channels);
    }
    this._channels = requireInteger(channels, 'channels', 0, 0xffff);
    this._sampleRate = requireInteger(sampleRate, 'sampleRate', 0, U32_MAX);
    this._bufferSize = normalizeSupportedBufferSize(bufferSize);
    this._sampleFormat = normalizeSampleFormat(sampleFormatValue);
    Object.freeze(this);
  }

  channels() { return this._channels; }
  sampleRate() { return this._sampleRate; }
  bufferSize() { return this._bufferSize; }
  sampleFormat() { return this._sampleFormat; }
  config() { return new StreamConfig(this._channels, this._sampleRate, BufferSize.Default); }
}

const FORMAT_RANKS = new Map([
  ['dsdu8', 0], ['dsdu16', 1], ['dsdu32', 2], ['u8', 3], ['i8', 4],
  ['u64', 5], ['i64', 6], ['u16', 7], ['i16', 8], ['u24', 9],
  ['i24', 10], ['u32', 11], ['i32', 12], ['f64', 13], ['f32', 14],
]);

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

class SupportedStreamConfigRange {
  constructor(channels, minSampleRate, maxSampleRate, bufferSize, sampleFormatValue) {
    if (typeof channels === 'object' && channels !== null) {
      ({
        channels,
        minSampleRate,
        maxSampleRate,
        bufferSize,
        sampleFormat: sampleFormatValue,
      } = channels);
    }
    this._channels = requireInteger(channels, 'channels', 0, 0xffff);
    this._minSampleRate = requireInteger(minSampleRate, 'minSampleRate', 0, U32_MAX);
    this._maxSampleRate = requireInteger(maxSampleRate, 'maxSampleRate', 0, U32_MAX);
    this._bufferSize = normalizeSupportedBufferSize(bufferSize);
    this._sampleFormat = normalizeSampleFormat(sampleFormatValue);
    Object.freeze(this);
  }

  channels() { return this._channels; }
  minSampleRate() { return this._minSampleRate; }
  maxSampleRate() { return this._maxSampleRate; }
  bufferSize() { return this._bufferSize; }
  sampleFormat() { return this._sampleFormat; }
  containsRate(rate) {
    requireInteger(rate, 'rate', 0, U32_MAX);
    return this._minSampleRate <= rate && rate <= this._maxSampleRate;
  }
  tryWithSampleRate(rate) {
    return this.containsRate(rate)
      ? new SupportedStreamConfig(
        this._channels,
        rate,
        this._bufferSize,
        this._sampleFormat
      )
      : null;
  }
  withSampleRate(rate) {
    const config = this.tryWithSampleRate(rate);
    if (config === null) throw new RangeError('sample rate out of range');
    return config;
  }
  withMaxSampleRate() {
    return this.withSampleRate(this._maxSampleRate);
  }
  tryWithStandardSampleRate() {
    if (this.containsRate(SAMPLE_RATE_48K)) return this.withSampleRate(SAMPLE_RATE_48K);
    if (this.containsRate(SAMPLE_RATE_CD)) return this.withSampleRate(SAMPLE_RATE_CD);
    return null;
  }
  withStandardSampleRate() {
    const config = this.tryWithStandardSampleRate();
    if (config === null) {
      throw new RangeError('no standard sample rate (48000 or 44100 Hz) in supported range');
    }
    return config;
  }
  cmpDefaultHeuristics(other) {
    if (!(other instanceof SupportedStreamConfigRange)) {
      throw new TypeError('other must be a SupportedStreamConfigRange');
    }
    for (const comparator of [
      () => compare(this._channels === 2, other._channels === 2),
      () => compare(this._channels === 1, other._channels === 1),
      () => compare(this._channels, other._channels),
      () => compare(FORMAT_RANKS.get(this._sampleFormat.value), FORMAT_RANKS.get(other._sampleFormat.value)),
      () => compare(this.containsRate(SAMPLE_RATE_48K), other.containsRate(SAMPLE_RATE_48K)),
      () => compare(this.containsRate(SAMPLE_RATE_CD), other.containsRate(SAMPLE_RATE_CD)),
      () => compare(this._maxSampleRate, other._maxSampleRate),
    ]) {
      const result = comparator();
      if (result !== 0) return result;
    }
    return 0;
  }
}

class StreamInstant {
  constructor(secs, nanos = 0) {
    secs = typeof secs === 'bigint' ? secs : BigInt(requireInteger(secs, 'secs', 0, Number.MAX_SAFE_INTEGER));
    nanos = requireInteger(nanos, 'nanos', 0, U32_MAX);
    const total = secs * 1_000_000_000n + BigInt(nanos);
    if (secs < 0n || total > MAX_STREAM_INSTANT_NANOS) {
      throw new RangeError('StreamInstant is outside CPAL\'s representable range');
    }
    this._nanos = total;
    Object.freeze(this);
  }

  static fromNanos(nanos) {
    nanos = typeof nanos === 'bigint'
      ? nanos
      : BigInt(requireInteger(nanos, 'nanos', 0, Number.MAX_SAFE_INTEGER));
    if (nanos < 0n || nanos > U64_MAX) throw new RangeError('nanos must fit in u64');
    return StreamInstant._fromTotalNanos(nanos);
  }

  static fromMillis(millis) {
    return StreamInstant._fromUnit(millis, 1_000_000n, 'millis');
  }

  static fromMicros(micros) {
    return StreamInstant._fromUnit(micros, 1_000n, 'micros');
  }

  static fromSecsF64(secs) {
    if (typeof secs !== 'number' || !Number.isFinite(secs) || secs < 0) {
      throw new RangeError('secs must be a finite, non-negative number');
    }
    const result = StreamInstant._fromTotalNanos(BigInt(Math.round(secs * 1_000_000_000)));
    if (result === null) throw new RangeError('secs is too large for StreamInstant');
    return result;
  }

  static _fromUnit(value, scale, name) {
    value = typeof value === 'bigint'
      ? value
      : BigInt(requireInteger(value, name, 0, Number.MAX_SAFE_INTEGER));
    if (value < 0n || value > U64_MAX) throw new RangeError(`${name} must fit in u64`);
    const result = StreamInstant._fromTotalNanos(value * scale);
    if (result === null) throw new RangeError(`${name} is too large for StreamInstant`);
    return result;
  }

  static _fromTotalNanos(nanos) {
    if (nanos < 0n || nanos > MAX_STREAM_INSTANT_NANOS) return null;
    const value = Object.create(StreamInstant.prototype);
    value._nanos = nanos;
    Object.freeze(value);
    return value;
  }

  asNanos() { return this._nanos; }
  checkedDurationSince(earlier) {
    requireStreamInstant(earlier, 'earlier');
    return this._nanos < earlier._nanos ? null : this._nanos - earlier._nanos;
  }
  saturatingDurationSince(earlier) {
    return this.checkedDurationSince(earlier) ?? 0n;
  }
  durationSince(earlier) {
    return this.saturatingDurationSince(earlier);
  }
  checkedAdd(durationNanos) {
    return StreamInstant._fromTotalNanos(this._nanos + requireDuration(durationNanos));
  }
  checkedSub(durationNanos) {
    return StreamInstant._fromTotalNanos(this._nanos - requireDuration(durationNanos));
  }
  add(durationNanos) {
    const value = this.checkedAdd(durationNanos);
    if (value === null) throw new RangeError('overflow when adding duration to stream instant');
    return value;
  }
  sub(value) {
    if (value instanceof StreamInstant) return this.durationSince(value);
    const instant = this.checkedSub(value);
    if (instant === null) throw new RangeError('underflow when subtracting duration from stream instant');
    return instant;
  }
  equals(other) {
    return other instanceof StreamInstant && other._nanos === this._nanos;
  }
}

StreamInstant.ZERO = StreamInstant._fromTotalNanos(0n);

function requireDuration(value) {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new RangeError('duration must be a non-negative bigint in nanoseconds');
  }
  return value;
}

function requireStreamInstant(value, name) {
  if (!(value instanceof StreamInstant)) throw new TypeError(`${name} must be a StreamInstant`);
  return value;
}

class InputStreamTimestamp {
  constructor(callback, capture) {
    this.callback = requireStreamInstant(callback, 'callback');
    this.capture = requireStreamInstant(capture, 'capture');
    Object.freeze(this);
  }
}

class OutputStreamTimestamp {
  constructor(callback, playback) {
    this.callback = requireStreamInstant(callback, 'callback');
    this.playback = requireStreamInstant(playback, 'playback');
    Object.freeze(this);
  }
}

class InputCallbackInfo {
  constructor(timestamp) {
    if (!(timestamp instanceof InputStreamTimestamp)) {
      throw new TypeError('timestamp must be an InputStreamTimestamp');
    }
    this._timestamp = timestamp;
    Object.freeze(this);
  }
  timestamp() { return this._timestamp; }
}

class OutputCallbackInfo {
  constructor(timestamp) {
    if (!(timestamp instanceof OutputStreamTimestamp)) {
      throw new TypeError('timestamp must be an OutputStreamTimestamp');
    }
    this._timestamp = timestamp;
    Object.freeze(this);
  }
  timestamp() { return this._timestamp; }
}

class Data {
  constructor(sampleFormatValue, samples, mutable = false) {
    this._sampleFormat = normalizeSampleFormat(sampleFormatValue);
    const Constructor = globalThis[
      {
        i8: 'Int8Array', i16: 'Int16Array', i24: 'Int32Array', i32: 'Int32Array',
        i64: 'BigInt64Array', u8: 'Uint8Array', u16: 'Uint16Array',
        u24: 'Uint32Array', u32: 'Uint32Array', u64: 'BigUint64Array',
        f32: 'Float32Array', f64: 'Float64Array', dsdu8: 'Uint8Array',
        dsdu16: 'Uint16Array', dsdu32: 'Uint32Array',
      }[this._sampleFormat.value]
    ];
    if (!(samples instanceof Constructor)) {
      throw new TypeError(`samples must be a ${Constructor.name}`);
    }
    this._samples = samples;
    this._mutable = Boolean(mutable);
    this._active = true;
  }

  sampleFormat() { this._assertActive(); return this._sampleFormat; }
  len() { this._assertActive(); return this._samples.length; }
  bytes() {
    this._assertActive();
    const bytes = new Uint8Array(
      this._samples.buffer,
      this._samples.byteOffset,
      this._samples.byteLength
    );
    return this._mutable ? bytes : bytes.slice();
  }
  bytesMut() {
    this._assertMutable();
    return new Uint8Array(
      this._samples.buffer,
      this._samples.byteOffset,
      this._samples.byteLength
    );
  }
  asSlice(sampleFormatValue) {
    this._assertActive();
    if (normalizeSampleFormat(sampleFormatValue) !== this._sampleFormat) return null;
    return this._mutable ? this._samples : this._samples.slice();
  }
  asSliceMut(sampleFormatValue) {
    this._assertMutable();
    return this.asSlice(sampleFormatValue);
  }
  _assertActive() {
    if (!this._active) throw new Error('CPAL Data is only valid during its stream callback');
  }
  _assertMutable() {
    this._assertActive();
    if (!this._mutable) throw new TypeError('input stream Data is immutable');
  }
  _invalidate() {
    this._active = false;
  }
}

module.exports = {
  SAMPLE_RATE_CD,
  SAMPLE_RATE_48K,
  SampleFormat,
  SampleFormatValue,
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
  StreamConfig,
  SupportedStreamConfig,
  SupportedStreamConfigRange,
  StreamInstant,
  InputStreamTimestamp,
  OutputStreamTimestamp,
  InputCallbackInfo,
  OutputCallbackInfo,
  Data,
  _normalizeBufferSize: normalizeBufferSize,
  _normalizeEnum: normalizeEnum,
  _normalizeErrorKind: normalizeErrorKind,
  _normalizeSampleFormat: normalizeSampleFormat,
  _registerHostIds: registerHostIds,
  _setErrorFactory(factory) {
    createCpalError = factory;
  },
};
