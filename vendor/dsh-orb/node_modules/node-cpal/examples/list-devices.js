/** Enumerate hosts and devices through CPAL's canonical API. */

let cpal;
try {
  cpal = require('../');
} catch (_) {
  cpal = require('node-cpal');
}

function formatSampleRates(minRate, maxRate) {
  return minRate === maxRate
    ? `${minRate} Hz`
    : `${minRate} - ${maxRate} Hz`;
}

function formatBufferSize(bufferSize) {
  return bufferSize.type === 'range'
    ? `${bufferSize.min} - ${bufferSize.max} frames`
    : 'unknown';
}

function getCapabilities(device, isInput) {
  try {
    return {
      configs: [
        ...(isInput
          ? device.supportedInputConfigs()
          : device.supportedOutputConfigs()),
      ],
      error: null,
    };
  } catch (error) {
    return { configs: [], error: error.message };
  }
}

function formatSupportedConfigs(label, capabilities) {
  if (capabilities.error) {
    return [`${label} capabilities: unavailable (${capabilities.error})`];
  }
  if (capabilities.configs.length === 0) {
    return [`${label} capabilities: none`];
  }

  return [
    `${label} capabilities:`,
    ...capabilities.configs.map(
      (config, index) =>
        `  #${index + 1}: ${formatSampleRates(
          config.minSampleRate(),
          config.maxSampleRate()
        )}, ${config.channels()} channels, ${config.sampleFormat()} format, buffer ${formatBufferSize(
          config.bufferSize()
        )}`
    ),
  ];
}

function sameDevice(left, right) {
  return Boolean(left && right && left.id().equals(right.id()));
}

function formatDefaultConfig(device, isInput) {
  try {
    const config = isInput
      ? device.defaultInputConfig()
      : device.defaultOutputConfig();
    return `${config.sampleRate()} Hz, ${config.channels()} channels, ${config.sampleFormat()} format`;
  } catch (error) {
    return `unavailable (${error.message})`;
  }
}

function formatDefaultDevice(device) {
  if (!device) return 'none';
  try {
    return device.description().name();
  } catch (error) {
    return `unavailable (${error.message})`;
  }
}

function printDevice(device, index, defaultInput, defaultOutput) {
  const description = device.description();
  const id = device.id();

  console.log(`Device #${index + 1}: ${description.name()}`);
  console.log(`  ID: ${id}`);
  console.log(`  Host: ${id.host().name()} (${id.host()})`);
  console.log(`  Direction: ${description.direction()}`);
  console.log(`  Type: ${description.deviceType()}`);
  console.log(`  Interface: ${description.interfaceType()}`);
  console.log(`  Manufacturer: ${description.manufacturer() || 'unknown'}`);
  console.log(`  Driver: ${description.driver() || 'unknown'}`);
  console.log(`  Address: ${description.address() || 'unknown'}`);
  console.log(`  Default input: ${sameDevice(device, defaultInput) ? 'yes' : 'no'}`);
  console.log(`  Default output: ${sameDevice(device, defaultOutput) ? 'yes' : 'no'}`);

  if (device.supportsInput()) {
    console.log(`  Default input config: ${formatDefaultConfig(device, true)}`);
  }
  if (device.supportsOutput()) {
    console.log(`  Default output config: ${formatDefaultConfig(device, false)}`);
  }

  const capabilities = [
    ...formatSupportedConfigs('Input', getCapabilities(device, true)),
    ...formatSupportedConfigs('Output', getCapabilities(device, false)),
  ];
  for (const line of capabilities) console.log(`  ${line}`);

  const extended = [...description.extended()];
  if (extended.length > 0) {
    console.log('  Extended details:');
    for (const line of extended) console.log(`    ${line}`);
  }
  console.log('');
}

function main() {
  const availableIds = cpal.availableHosts();
  const available = new Set(availableIds.map(String));

  console.log('=== Compiled Audio Hosts ===');
  for (const id of cpal.ALL_HOSTS) {
    console.log(
      `${id.name()} (${id}): ${available.has(String(id)) ? 'available' : 'unavailable'}`
    );
  }
  console.log('');

  for (const id of availableIds) {
    let host;
    let defaultInput;
    let defaultOutput;
    let devices = [];

    try {
      host = cpal.hostFromId(id);
      defaultInput = host.defaultInputDevice();
      defaultOutput = host.defaultOutputDevice();
      devices = [...host.devices()];

      console.log(`=== ${host.id().name()} Devices ===`);
      console.log(`Found ${devices.length} device(s)\n`);
      devices.forEach((device, index) =>
        printDevice(device, index, defaultInput, defaultOutput)
      );

      console.log(`Default input: ${formatDefaultDevice(defaultInput)}`);
      console.log(`Default output: ${formatDefaultDevice(defaultOutput)}`);
      console.log('');
    } catch (error) {
      console.error(`Could not inspect ${id.name()}: ${error.message}`);
    } finally {
      for (const device of devices) device.close();
      if (defaultInput) defaultInput.close();
      if (defaultOutput) defaultOutput.close();
      if (host) host.close();
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`[${error.code || 'ERROR'}] ${error.message}`);
  process.exitCode = 1;
}
