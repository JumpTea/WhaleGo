export type SampleFormatName =
  | 'i8'
  | 'i16'
  | 'i24'
  | 'i32'
  | 'i64'
  | 'u8'
  | 'u16'
  | 'u24'
  | 'u32'
  | 'u64'
  | 'f32'
  | 'f64'
  | 'dsdu8'
  | 'dsdu16'
  | 'dsdu32';

export type SizedSampleFormatName = Exclude<
  SampleFormatName,
  'dsdu8' | 'dsdu16' | 'dsdu32'
>;

export type ChannelCount = number;
export type SampleRate = number;
export type FrameCount = number;
export type DevicesFiltered<T = Device> = Iterable<T>;
export type InputDevices<T = Device> = DevicesFiltered<T>;
export type OutputDevices<T = Device> = DevicesFiltered<T>;
export type Devices = Iterable<Device>;
export type SupportedInputConfigs = Iterable<SupportedStreamConfigRange>;
export type SupportedOutputConfigs = Iterable<SupportedStreamConfigRange>;

export interface SampleArrayMap {
  i8: Int8Array;
  i16: Int16Array;
  i24: Int32Array;
  i32: Int32Array;
  i64: BigInt64Array;
  u8: Uint8Array;
  u16: Uint16Array;
  u24: Uint32Array;
  u32: Uint32Array;
  u64: BigUint64Array;
  f32: Float32Array;
  f64: Float64Array;
  dsdu8: Uint8Array;
  dsdu16: Uint16Array;
  dsdu32: Uint32Array;
}

export type SampleArray<F extends SampleFormatName = SampleFormatName> =
  SampleArrayMap[F];

export type SampleValue<F extends SampleFormatName = SampleFormatName> =
  F extends 'i64' | 'u64' ? bigint
    : F extends 'i24' ? I24
      : F extends 'u24' ? U24
        : number;

export class SampleFormatValue<F extends SampleFormatName = SampleFormatName> {
  private constructor();
  readonly name: string;
  readonly value: F;
  sampleSize(): number;
  bitsPerSample(): number;
  isInt(): boolean;
  isUint(): boolean;
  isFloat(): boolean;
  isDsd(): boolean;
  equilibrium(): SampleValue<F>;
  identity(): number;
  toSample<G extends SampleFormatName>(
    value: SampleValue<F>,
    targetFormat: SampleFormatValue<G> | G
  ): SampleValue<G>;
  toString(): F;
  toJSON(): F;
}

export const SampleFormat: {
  readonly I8: SampleFormatValue<'i8'>;
  readonly I16: SampleFormatValue<'i16'>;
  readonly I24: SampleFormatValue<'i24'>;
  readonly I32: SampleFormatValue<'i32'>;
  readonly I64: SampleFormatValue<'i64'>;
  readonly U8: SampleFormatValue<'u8'>;
  readonly U16: SampleFormatValue<'u16'>;
  readonly U24: SampleFormatValue<'u24'>;
  readonly U32: SampleFormatValue<'u32'>;
  readonly U64: SampleFormatValue<'u64'>;
  readonly F32: SampleFormatValue<'f32'>;
  readonly F64: SampleFormatValue<'f64'>;
  readonly DsdU8: SampleFormatValue<'dsdu8'>;
  readonly DsdU16: SampleFormatValue<'dsdu16'>;
  readonly DsdU32: SampleFormatValue<'dsdu32'>;
};

export type SampleFormat = typeof SampleFormat[keyof typeof SampleFormat];

export const Sample: {
  equilibrium<F extends SampleFormatName>(format: SampleFormatValue<F> | F): SampleValue<F>;
  identity(format: SampleFormat | SampleFormatName): number;
  toSample<S extends SampleFormatName, T extends SampleFormatName>(
    value: SampleValue<S>,
    sourceFormat: SampleFormatValue<S> | S,
    targetFormat: SampleFormatValue<T> | T
  ): SampleValue<T>;
  fromSample<S extends SampleFormatName, T extends SampleFormatName>(
    targetFormat: SampleFormatValue<T> | T,
    value: SampleValue<S>,
    sourceFormat: SampleFormatValue<S> | S
  ): SampleValue<T>;
  toSignedSample<F extends SampleFormatName>(
    value: SampleValue<F>,
    format: SampleFormatValue<F> | F
  ): number | bigint | I24;
  toFloatSample<F extends SampleFormatName>(
    value: SampleValue<F>,
    format: SampleFormatValue<F> | F
  ): number;
  addAmp<F extends SampleFormatName>(
    value: SampleValue<F>,
    amp: number | bigint | I24,
    format: SampleFormatValue<F> | F
  ): SampleValue<F>;
  mulAmp<F extends SampleFormatName>(
    value: SampleValue<F>,
    amp: number,
    format: SampleFormatValue<F> | F
  ): SampleValue<F>;
};

export const FromSample: {
  fromSample: typeof Sample.fromSample;
};

export const SizedSample: {
  format<F extends SampleFormatName>(format: SampleFormatValue<F> | F): SampleFormatValue<F>;
};

export class I24 {
  constructor(value: number);
  static readonly MIN: I24;
  static readonly MAX: I24;
  static readonly EQUILIBRIUM: I24;
  static new(value: number): I24 | null;
  static from(value: number): I24;
  static newUnchecked(value: number): I24;
  inner(): number;
  valueOf(): number;
  toString(): string;
}

export class U24 {
  constructor(value: number);
  static readonly MIN: U24;
  static readonly MAX: U24;
  static readonly EQUILIBRIUM: U24;
  static new(value: number): U24 | null;
  static from(value: number): U24;
  static newUnchecked(value: number): U24;
  inner(): number;
  valueOf(): number;
  toString(): string;
}

export interface CpalEnumValue<Name extends string, Value extends string> {
  readonly name: Name;
  readonly value: Value;
  toString(): string;
  toJSON(): Value;
}

export const ErrorKind: {
  readonly DeviceBusy: CpalEnumValue<'DeviceBusy', 'DEVICE_BUSY'>;
  readonly DeviceChanged: CpalEnumValue<'DeviceChanged', 'DEVICE_CHANGED'>;
  readonly DeviceNotAvailable: CpalEnumValue<'DeviceNotAvailable', 'DEVICE_NOT_AVAILABLE'>;
  readonly HostUnavailable: CpalEnumValue<'HostUnavailable', 'HOST_UNAVAILABLE'>;
  readonly InvalidInput: CpalEnumValue<'InvalidInput', 'INVALID_INPUT'>;
  readonly PermissionDenied: CpalEnumValue<'PermissionDenied', 'PERMISSION_DENIED'>;
  readonly RealtimeDenied: CpalEnumValue<'RealtimeDenied', 'REALTIME_DENIED'>;
  readonly ResourceExhausted: CpalEnumValue<'ResourceExhausted', 'RESOURCE_EXHAUSTED'>;
  readonly StreamInvalidated: CpalEnumValue<'StreamInvalidated', 'STREAM_INVALIDATED'>;
  readonly UnsupportedConfig: CpalEnumValue<'UnsupportedConfig', 'UNSUPPORTED_CONFIG'>;
  readonly UnsupportedOperation: CpalEnumValue<'UnsupportedOperation', 'UNSUPPORTED_OPERATION'>;
  readonly Xrun: CpalEnumValue<'Xrun', 'XRUN'>;
  readonly BackendError: CpalEnumValue<'BackendError', 'BACKEND_ERROR'>;
  readonly Other: CpalEnumValue<'Other', 'OTHER'>;
};

export type ErrorKind = typeof ErrorKind[keyof typeof ErrorKind];

export type CpalErrorCode = ErrorKind['value']
  | 'BINDING_LOAD_FAILED'
  | 'STREAM_CLOSED'
  | 'INVALID_BUFFER'
  | 'INPUT_OVERFLOW'
  | 'CALLBACK_FAILED';

export class CpalError extends globalThis.Error {
  readonly code: CpalErrorCode;
  readonly operation?: string;
  readonly cause?: unknown;
  constructor(
    code: CpalErrorCode | ErrorKind,
    message?: string | null,
    options?: { cause?: unknown; operation?: string; cpalMessage?: string | null }
  );
  static new(kind: ErrorKind): CpalError;
  static withMessage(kind: ErrorKind, message: string): CpalError;
  kind(): ErrorKind;
  cpalMessage(): string | null;
}

export const Error: typeof CpalError;

export const DeviceType: {
  readonly Speaker: CpalEnumValue<'Speaker', 'speaker'>;
  readonly Microphone: CpalEnumValue<'Microphone', 'microphone'>;
  readonly Headphones: CpalEnumValue<'Headphones', 'headphones'>;
  readonly Headset: CpalEnumValue<'Headset', 'headset'>;
  readonly Earpiece: CpalEnumValue<'Earpiece', 'earpiece'>;
  readonly Handset: CpalEnumValue<'Handset', 'handset'>;
  readonly HearingAid: CpalEnumValue<'HearingAid', 'hearing-aid'>;
  readonly Dock: CpalEnumValue<'Dock', 'dock'>;
  readonly Tuner: CpalEnumValue<'Tuner', 'tuner'>;
  readonly Virtual: CpalEnumValue<'Virtual', 'virtual'>;
  readonly Unknown: CpalEnumValue<'Unknown', 'unknown'>;
};
export type DeviceType = typeof DeviceType[keyof typeof DeviceType];

export const InterfaceType: {
  readonly BuiltIn: CpalEnumValue<'BuiltIn', 'built-in'>;
  readonly Usb: CpalEnumValue<'Usb', 'usb'>;
  readonly Bluetooth: CpalEnumValue<'Bluetooth', 'bluetooth'>;
  readonly Pci: CpalEnumValue<'Pci', 'pci'>;
  readonly FireWire: CpalEnumValue<'FireWire', 'firewire'>;
  readonly Thunderbolt: CpalEnumValue<'Thunderbolt', 'thunderbolt'>;
  readonly Hdmi: CpalEnumValue<'Hdmi', 'hdmi'>;
  readonly Line: CpalEnumValue<'Line', 'line'>;
  readonly Spdif: CpalEnumValue<'Spdif', 'spdif'>;
  readonly Network: CpalEnumValue<'Network', 'network'>;
  readonly Virtual: CpalEnumValue<'Virtual', 'virtual'>;
  readonly DisplayPort: CpalEnumValue<'DisplayPort', 'display-port'>;
  readonly Aggregate: CpalEnumValue<'Aggregate', 'aggregate'>;
  readonly Unknown: CpalEnumValue<'Unknown', 'unknown'>;
};
export type InterfaceType = typeof InterfaceType[keyof typeof InterfaceType];

export const DeviceDirection: {
  readonly Input: CpalEnumValue<'Input', 'input'>;
  readonly Output: CpalEnumValue<'Output', 'output'>;
  readonly Duplex: CpalEnumValue<'Duplex', 'duplex'>;
  readonly Unknown: CpalEnumValue<'Unknown', 'unknown'>;
};
export type DeviceDirection = typeof DeviceDirection[keyof typeof DeviceDirection];

export class HostId {
  private constructor(value: string, name?: string);
  static readonly AAudio?: HostId;
  static readonly Alsa?: HostId;
  static readonly Asio?: HostId;
  static readonly AudioWorklet?: HostId;
  static readonly CoreAudio?: HostId;
  static readonly Custom?: HostId;
  static readonly Jack?: HostId;
  static readonly Null?: HostId;
  static readonly PipeWire?: HostId;
  static readonly PulseAudio?: HostId;
  static readonly Wasapi?: HostId;
  static readonly WebAudio?: HostId;
  static fromString(value: string): HostId;
  name(): string;
  equals(other: HostId): boolean;
  toString(): string;
  toJSON(): string;
}

export class DeviceId {
  constructor(host: HostId | string, id: string);
  static fromString(value: string): DeviceId;
  host(): HostId;
  id(): string;
  equals(other: DeviceId): boolean;
  toString(): string;
  toJSON(): string;
}

export interface DeviceDescriptionInit {
  name: string;
  manufacturer?: string | null;
  driver?: string | null;
  deviceType?: DeviceType | DeviceType['value'];
  interfaceType?: InterfaceType | InterfaceType['value'];
  direction?: DeviceDirection | DeviceDirection['value'];
  address?: string | null;
  extended?: Iterable<string>;
}

export class DeviceDescription {
  constructor(init: DeviceDescriptionInit);
  name(): string;
  manufacturer(): string | null;
  driver(): string | null;
  deviceType(): DeviceType;
  interfaceType(): InterfaceType;
  direction(): DeviceDirection;
  supportsInput(): boolean;
  supportsOutput(): boolean;
  address(): string | null;
  extended(): IterableIterator<string>;
  toString(): string;
}

export class DeviceDescriptionBuilder {
  constructor(name: string);
  manufacturer(value: string): this;
  driver(value: string): this;
  deviceType(value: DeviceType | DeviceType['value']): this;
  interfaceType(value: InterfaceType | InterfaceType['value']): this;
  direction(value: DeviceDirection | DeviceDirection['value']): this;
  address(value: string): this;
  extended(lines: Iterable<string>): this;
  addExtendedLine(line: string): this;
  build(): DeviceDescription;
}

export class BufferSize {
  private constructor();
  readonly type: 'default' | 'fixed';
  readonly frames: number | null;
  static readonly Default: BufferSize & { readonly type: 'default'; readonly frames: null };
  static Fixed(frames: number): BufferSize & { readonly type: 'fixed'; readonly frames: number };
}

export class SupportedBufferSize {
  private constructor();
  readonly type: 'unknown' | 'range';
  readonly min: number | null;
  readonly max: number | null;
  static readonly Unknown: SupportedBufferSize & {
    readonly type: 'unknown';
    readonly min: null;
    readonly max: null;
  };
  static Range(min: number, max: number): SupportedBufferSize & {
    readonly type: 'range';
    readonly min: number;
    readonly max: number;
  };
}

export interface StreamConfigInit {
  channels: number;
  sampleRate: number;
  bufferSize?: BufferSize | { type: 'default' } | { type: 'fixed'; frames: number };
}

export class StreamConfig {
  constructor(init: StreamConfigInit);
  constructor(channels: number, sampleRate: number, bufferSize?: BufferSize);
  readonly channels: number;
  readonly sampleRate: number;
  readonly bufferSize: BufferSize;
}

export interface SupportedStreamConfigInit<F extends SampleFormatName = SampleFormatName> {
  channels: number;
  sampleRate: number;
  bufferSize: SupportedBufferSize | {
    type: 'unknown' | 'range';
    min?: number;
    max?: number;
    minFrames?: number;
    maxFrames?: number;
  };
  sampleFormat: SampleFormatValue<F> | F;
}

export class SupportedStreamConfig<F extends SampleFormatName = SampleFormatName> {
  constructor(init: SupportedStreamConfigInit<F>);
  constructor(
    channels: number,
    sampleRate: number,
    bufferSize: SupportedBufferSize,
    sampleFormat: SampleFormatValue<F> | F
  );
  channels(): number;
  sampleRate(): number;
  bufferSize(): SupportedBufferSize;
  sampleFormat(): SampleFormatValue<F>;
  config(): StreamConfig;
}

export interface SupportedStreamConfigRangeInit<F extends SampleFormatName = SampleFormatName> {
  channels: number;
  minSampleRate: number;
  maxSampleRate: number;
  bufferSize: SupportedStreamConfigInit<F>['bufferSize'];
  sampleFormat: SampleFormatValue<F> | F;
}

export class SupportedStreamConfigRange<F extends SampleFormatName = SampleFormatName> {
  constructor(init: SupportedStreamConfigRangeInit<F>);
  constructor(
    channels: number,
    minSampleRate: number,
    maxSampleRate: number,
    bufferSize: SupportedBufferSize,
    sampleFormat: SampleFormatValue<F> | F
  );
  channels(): number;
  minSampleRate(): number;
  maxSampleRate(): number;
  bufferSize(): SupportedBufferSize;
  sampleFormat(): SampleFormatValue<F>;
  withSampleRate(sampleRate: number): SupportedStreamConfig<F>;
  tryWithSampleRate(sampleRate: number): SupportedStreamConfig<F> | null;
  withMaxSampleRate(): SupportedStreamConfig<F>;
  containsRate(sampleRate: number): boolean;
  tryWithStandardSampleRate(): SupportedStreamConfig<F> | null;
  withStandardSampleRate(): SupportedStreamConfig<F>;
  cmpDefaultHeuristics(other: SupportedStreamConfigRange): -1 | 0 | 1;
}

export class StreamInstant {
  constructor(secs: bigint | number, nanos?: number);
  static readonly ZERO: StreamInstant;
  static fromNanos(nanos: bigint | number): StreamInstant;
  static fromMillis(millis: bigint | number): StreamInstant;
  static fromMicros(micros: bigint | number): StreamInstant;
  static fromSecsF64(secs: number): StreamInstant;
  asNanos(): bigint;
  checkedDurationSince(earlier: StreamInstant): bigint | null;
  saturatingDurationSince(earlier: StreamInstant): bigint;
  durationSince(earlier: StreamInstant): bigint;
  checkedAdd(durationNanos: bigint): StreamInstant | null;
  checkedSub(durationNanos: bigint): StreamInstant | null;
  add(durationNanos: bigint): StreamInstant;
  sub(value: bigint): StreamInstant;
  sub(value: StreamInstant): bigint;
  equals(other: StreamInstant): boolean;
}

export class InputStreamTimestamp {
  constructor(callback: StreamInstant, capture: StreamInstant);
  readonly callback: StreamInstant;
  readonly capture: StreamInstant;
}

export class OutputStreamTimestamp {
  constructor(callback: StreamInstant, playback: StreamInstant);
  readonly callback: StreamInstant;
  readonly playback: StreamInstant;
}

export class InputCallbackInfo {
  constructor(timestamp: InputStreamTimestamp);
  timestamp(): InputStreamTimestamp;
}

export class OutputCallbackInfo {
  constructor(timestamp: OutputStreamTimestamp);
  timestamp(): OutputStreamTimestamp;
}

export class Data<F extends SampleFormatName = SampleFormatName> {
  constructor(sampleFormat: SampleFormatValue<F> | F, samples: SampleArray<F>, mutable?: boolean);
  sampleFormat(): SampleFormatValue<F>;
  len(): number;
  bytes(): Uint8Array;
  bytesMut(): Uint8Array;
  asSlice<G extends SampleFormatName>(sampleFormat: SampleFormatValue<G> | G):
    G extends F ? SampleArray<G> : SampleArray<G> | null;
  asSliceMut<G extends SampleFormatName>(sampleFormat: SampleFormatValue<G> | G):
    G extends F ? SampleArray<G> : SampleArray<G> | null;
}

export type CanonicalErrorCallback = (error: CpalError) => void;

export class Host {
  protected constructor(...args: never[]);
  static isAvailable(): boolean;
  id(): HostId;
  devices(): Iterable<Device>;
  inputDevices(): Iterable<Device>;
  outputDevices(): Iterable<Device>;
  deviceById(id: DeviceId | string): Device | null;
  defaultInputDevice(): Device | null;
  defaultOutputDevice(): Device | null;
  close(): void;
}

export interface JackHost extends Host {
  setConnectAutomatically(value: boolean): void;
  setStartServerAutomatically(value: boolean): void;
  inputDeviceWithName(name: string): Device | null;
  outputDeviceWithName(name: string): Device | null;
}

export interface JackHostConstructor {
  new(): JackHost;
  isAvailable(): boolean;
}

export const JackHost: JackHostConstructor | undefined;

export interface PipeWireHost extends Host {
  setConnectAutomatically(value: boolean): void;
}

export interface PipeWireHostConstructor {
  new(): PipeWireHost;
  isAvailable(): boolean;
}

export const PipeWireHost: PipeWireHostConstructor | undefined;

export class Device {
  protected constructor(...args: never[]);
  clone(): Device;
  description(): DeviceDescription;
  id(): DeviceId;
  supportsInput(): boolean;
  supportsOutput(): boolean;
  supportedInputConfigs(): Iterable<SupportedStreamConfigRange>;
  supportedOutputConfigs(): Iterable<SupportedStreamConfigRange>;
  defaultInputConfig(): SupportedStreamConfig;
  defaultOutputConfig(): SupportedStreamConfig;
  buildInputStream<F extends SizedSampleFormatName>(
    config: StreamConfig | SupportedStreamConfig,
    sampleFormat: SampleFormatValue<F> | F,
    dataCallback: (data: SampleArray<F>, info: InputCallbackInfo) => void,
    errorCallback: CanonicalErrorCallback,
    timeout?: bigint | null
  ): Stream;
  buildOutputStream<F extends SizedSampleFormatName>(
    config: StreamConfig | SupportedStreamConfig,
    sampleFormat: SampleFormatValue<F> | F,
    dataCallback: (data: SampleArray<F>, info: OutputCallbackInfo) => void,
    errorCallback: CanonicalErrorCallback,
    timeout?: bigint | null
  ): Stream;
  buildInputStreamRaw<F extends SampleFormatName>(
    config: StreamConfig | SupportedStreamConfig,
    sampleFormat: SampleFormatValue<F> | F,
    dataCallback: (data: Data<F>, info: InputCallbackInfo) => void,
    errorCallback: CanonicalErrorCallback,
    timeout?: bigint | null
  ): Stream;
  buildOutputStreamRaw<F extends SampleFormatName>(
    config: StreamConfig | SupportedStreamConfig,
    sampleFormat: SampleFormatValue<F> | F,
    dataCallback: (data: Data<F>, info: OutputCallbackInfo) => void,
    errorCallback: CanonicalErrorCallback,
    timeout?: bigint | null
  ): Stream;
  equals(other: Device): boolean;
  toString(): string;
  close(): void;
}

export type StreamState = 'paused' | 'playing' | 'closed';

export class Stream {
  protected constructor(...args: never[]);
  play(): void;
  pause(): void;
  bufferSize(): number;
  now(): StreamInstant;
  state(): StreamState;
  close(): void;
}

export interface CustomHostAdapter {
  devices(): Iterable<CustomDevice | CustomDeviceAdapter>;
  defaultInputDevice(): CustomDevice | CustomDeviceAdapter | null;
  defaultOutputDevice(): CustomDevice | CustomDeviceAdapter | null;
}

export interface CustomDeviceAdapter {
  description(): DeviceDescription | DeviceDescriptionInit;
  id(): DeviceId | string;
  supportsInput?(): boolean;
  supportsOutput?(): boolean;
  supportedInputConfigs(): Iterable<SupportedStreamConfigRange | SupportedStreamConfigRangeInit>;
  supportedOutputConfigs(): Iterable<SupportedStreamConfigRange | SupportedStreamConfigRangeInit>;
  defaultInputConfig(): SupportedStreamConfig | SupportedStreamConfigInit;
  defaultOutputConfig(): SupportedStreamConfig | SupportedStreamConfigInit;
  buildInputStreamRaw(
    config: StreamConfig,
    sampleFormat: SampleFormat,
    dataCallback: Function,
    errorCallback: CanonicalErrorCallback,
    timeout: bigint | null
  ): CustomStream | Stream | CustomStreamAdapter;
  buildOutputStreamRaw(
    config: StreamConfig,
    sampleFormat: SampleFormat,
    dataCallback: Function,
    errorCallback: CanonicalErrorCallback,
    timeout: bigint | null
  ): CustomStream | Stream | CustomStreamAdapter;
}

export interface CustomStreamAdapter {
  play(): void;
  pause(): void;
  now(): StreamInstant;
  bufferSize(): number;
  state?(): StreamState;
  close?(): void;
}

export interface CustomHost {
  id(): HostId;
  devices(): Iterable<CustomDevice>;
  inputDevices(): Iterable<CustomDevice>;
  outputDevices(): Iterable<CustomDevice>;
  deviceById(id: DeviceId | string): CustomDevice | null;
  defaultInputDevice(): CustomDevice | null;
  defaultOutputDevice(): CustomDevice | null;
  close(): void;
}

export interface CustomHostConstructor {
  fromHost(adapter: CustomHostAdapter): CustomHost;
  isAvailable(): false;
}

export const CustomHost: CustomHostConstructor | undefined;

export interface CustomDevice {
  clone(): CustomDevice;
  description(): DeviceDescription;
  id(): DeviceId;
  supportsInput(): boolean;
  supportsOutput(): boolean;
  supportedInputConfigs(): Iterable<SupportedStreamConfigRange>;
  supportedOutputConfigs(): Iterable<SupportedStreamConfigRange>;
  defaultInputConfig(): SupportedStreamConfig;
  defaultOutputConfig(): SupportedStreamConfig;
  buildInputStream: Device['buildInputStream'];
  buildOutputStream: Device['buildOutputStream'];
  buildInputStreamRaw: Device['buildInputStreamRaw'];
  buildOutputStreamRaw: Device['buildOutputStreamRaw'];
  equals(other: CustomDevice): boolean;
  toString(): string;
  close(): void;
}

export interface CustomDeviceConstructor {
  fromDevice(adapter: CustomDeviceAdapter): CustomDevice;
}

export const CustomDevice: CustomDeviceConstructor | undefined;

export interface CustomStream {
  play(): void;
  pause(): void;
  now(): StreamInstant;
  bufferSize(): number;
  state(): StreamState;
  close(): void;
}

export interface CustomStreamConstructor {
  fromStream(adapter: CustomStreamAdapter): CustomStream;
}

export const CustomStream: CustomStreamConstructor | undefined;

export const ALL_HOSTS: readonly HostId[];
export const SAMPLE_RATE_CD: 44100;
export const SAMPLE_RATE_48K: 48000;
export function availableHosts(): HostId[];
export function defaultHost(): Host;
export function hostFromId(id: HostId | string): Host;

// Higher-level queued facade. These APIs are not part of CPAL itself.
export interface AudioHost {
  readonly id: string;
  readonly name: string;
}

export type DeviceTypeName = DeviceType['value'];
export type InterfaceTypeName = InterfaceType['value'];
export type DeviceDirectionName = DeviceDirection['value'];

export interface AudioDevice {
  readonly name: string;
  readonly deviceId: string;
  readonly hostId: string;
  readonly isDefaultInput: boolean;
  readonly isDefaultOutput: boolean;
  readonly supportsInput: boolean;
  readonly supportsOutput: boolean;
  readonly supportsLoopback: boolean;
  readonly deviceType: DeviceTypeName;
  readonly interfaceType: InterfaceTypeName;
  readonly direction: DeviceDirectionName;
  readonly manufacturer: string | null;
  readonly driver: string | null;
  readonly address: string | null;
  readonly extended: readonly string[];
}

export type QueuedSupportedBufferSize =
  | { readonly type: 'range'; readonly minFrames: number; readonly maxFrames: number }
  | { readonly type: 'unknown' };

export type QueuedStreamBufferSize =
  | { readonly type: 'default' }
  | { readonly type: 'fixed'; readonly frames: number };

export interface AudioDeviceConfig<F extends SampleFormatName = SampleFormatName> {
  readonly minSampleRate: number;
  readonly maxSampleRate: number;
  readonly channels: number;
  readonly sampleFormat: F;
  readonly bufferSize: QueuedSupportedBufferSize;
}

export interface QueuedStreamConfig<F extends SampleFormatName = SampleFormatName> {
  readonly sampleRate: number;
  readonly channels: number;
  readonly sampleFormat: F;
  readonly bufferSize?: QueuedStreamBufferSize;
}

export interface DefaultStreamConfig<F extends SampleFormatName = SampleFormatName>
  extends QueuedStreamConfig<F> {
  readonly bufferSize: QueuedStreamBufferSize;
  readonly supportedBufferSize: QueuedSupportedBufferSize;
}

export interface PipeWireHostOptions {
  readonly connectAutomatically?: boolean;
}
export type HostOptions = PipeWireHostOptions;

export interface DeviceQueryOptions {
  readonly hostId?: string;
  readonly direction?: 'all' | 'input' | 'output';
  readonly hostOptions?: HostOptions;
}

export interface HostQueryOptions {
  readonly hostId?: string;
  readonly hostOptions?: HostOptions;
}

export interface QueuedInputCallbackInfo {
  readonly frames: number;
  readonly callbackTimeNs: bigint;
  readonly captureTimeNs: bigint;
}

export interface QueuedOutputCallbackInfo {
  readonly frames: number;
  readonly callbackTimeNs: bigint;
  readonly playbackTimeNs: bigint;
  readonly underrunFrames: number;
}

export interface PullBufferRequest<F extends SampleFormatName = SampleFormatName> {
  readonly frames: number;
  readonly channels: number;
  readonly sampleFormat: F;
}

export type ErrorCallback = (error: CpalError) => void;

export interface BaseStreamOptions<F extends SampleFormatName = SampleFormatName> {
  readonly deviceId: string;
  readonly config: QueuedStreamConfig<F>;
  readonly onError: ErrorCallback;
  readonly autoStart?: boolean;
  readonly timeoutMs?: number | null;
  readonly queueCapacityBuffers?: number;
}

export interface InputStreamOptions<F extends SampleFormatName = SampleFormatName>
  extends BaseStreamOptions<F> {
  readonly onData: (data: SampleArray<F>, info: QueuedInputCallbackInfo) => void;
}

export interface PushOutputStreamOptions<F extends SampleFormatName = SampleFormatName>
  extends BaseStreamOptions<F> {
  readonly mode?: 'push';
  readonly onOutput?: (info: QueuedOutputCallbackInfo) => void;
  readonly onDrain?: () => void;
}

export interface PullOutputStreamOptions<F extends SampleFormatName = SampleFormatName>
  extends BaseStreamOptions<F> {
  readonly mode: 'pull';
  readonly onData: (request: PullBufferRequest<F>) => SampleArray<F>;
  readonly onOutput?: (info: QueuedOutputCallbackInfo) => void;
  readonly prefetchBuffers?: number;
}

export interface LoopbackStreamOptions<F extends SampleFormatName = SampleFormatName>
  extends InputStreamOptions<F> {}

export interface AudioStream<F extends SampleFormatName = SampleFormatName> {
  readonly direction: 'input' | 'output';
  readonly sampleFormat: F;
  readonly channels: number;
  readonly sampleRate: number;
  readonly state: StreamState;
  play(): void;
  pause(): void;
  bufferSize(): number;
  now(): bigint;
  close(): Promise<void>;
}

export interface InputStream<F extends SampleFormatName = SampleFormatName>
  extends AudioStream<F> {
  readonly direction: 'input';
}

export interface PushOutputStream<F extends SampleFormatName = SampleFormatName>
  extends AudioStream<F> {
  readonly direction: 'output';
  readonly bufferedFrames: number;
  write(data: SampleArray<F>): boolean;
}

export interface PullOutputStream<F extends SampleFormatName = SampleFormatName>
  extends PushOutputStream<F> {}

export interface ConvenienceApi {
  readonly CpalError: typeof CpalError;
  readonly AudioStream: Function & { readonly prototype: AudioStream };
  readonly InputStream: Function & { readonly prototype: InputStream };
  readonly PushOutputStream: Function & { readonly prototype: PushOutputStream };
  readonly PullOutputStream: Function & { readonly prototype: PullOutputStream };
  getHosts(): AudioHost[];
  getDevices(options?: DeviceQueryOptions): AudioDevice[];
  getDeviceById(deviceId: string): AudioDevice;
  getDefaultInputDevice(options?: HostQueryOptions): AudioDevice;
  getDefaultOutputDevice(options?: HostQueryOptions): AudioDevice;
  getSupportedInputConfigs(deviceId: string): AudioDeviceConfig[];
  getSupportedOutputConfigs(deviceId: string): AudioDeviceConfig[];
  getSupportedLoopbackConfigs(deviceId: string): AudioDeviceConfig[];
  getDefaultInputConfig(deviceId: string): DefaultStreamConfig;
  getDefaultOutputConfig(deviceId: string): DefaultStreamConfig;
  getSupportedFormats(deviceId: string): SampleFormatName[];
  getSupportedSampleRates(deviceId: string): number[];
  getMaxChannels(deviceId: string): number;
  createInputStream<F extends SampleFormatName>(
    options: InputStreamOptions<F>
  ): Promise<InputStream<F>>;
  createOutputStream<F extends SampleFormatName>(
    options: PullOutputStreamOptions<F>
  ): Promise<PullOutputStream<F>>;
  createOutputStream<F extends SampleFormatName>(
    options: PushOutputStreamOptions<F>
  ): Promise<PushOutputStream<F>>;
  createLoopbackStream<F extends SampleFormatName>(
    options: LoopbackStreamOptions<F>
  ): Promise<InputStream<F>>;
}

export const convenience: Readonly<ConvenienceApi>;
