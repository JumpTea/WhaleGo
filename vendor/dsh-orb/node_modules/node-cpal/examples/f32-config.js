/** Select an f32 configuration from a canonical CPAL Device. */

function getF32StreamConfig(cpal, device, isInput) {
  const supportedConfigs = [
    ...(isInput
      ? device.supportedInputConfigs()
      : device.supportedOutputConfigs()),
  ];
  const defaultConfig = isInput
    ? device.defaultInputConfig()
    : device.defaultOutputConfig();

  if (defaultConfig.sampleFormat() === cpal.SampleFormat.F32) {
    return defaultConfig;
  }

  const floatConfigs = supportedConfigs.filter(
    (config) => config.sampleFormat() === cpal.SampleFormat.F32
  );
  if (floatConfigs.length === 0) {
    throw new Error('The selected device does not support f32 audio');
  }

  const defaultSampleRate = defaultConfig.sampleRate();
  const selectedConfig =
    floatConfigs.find(
      (config) =>
        config.channels() === defaultConfig.channels() &&
        config.containsRate(defaultSampleRate)
    ) || floatConfigs[0];

  return (
    selectedConfig.tryWithSampleRate(defaultSampleRate) ||
    selectedConfig.tryWithStandardSampleRate() ||
    selectedConfig.withMaxSampleRate()
  );
}

module.exports = { getF32StreamConfig };
