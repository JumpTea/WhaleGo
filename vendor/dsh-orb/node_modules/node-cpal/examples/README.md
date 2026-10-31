# node-cpal Examples

This directory contains examples demonstrating how to use the node-cpal library for audio operations in Node.js.

## Prerequisites

Before running these examples, make sure you have:

1. Node.js 22.0.0 or later installed
2. Installed node-cpal:
   ```bash
   npm install node-cpal
   ```

## Running the Examples

Each example is a standalone JavaScript file that can be run directly with Node.js:

```bash
node beep.js
node cpal-direct.js
node optional-backend.js jack
node list-devices.js
node audio-visualizer.js
node record-and-playback.js
```

Alternatively, you can use the provided npm scripts:

```bash
# First install dependencies
npm install

# Then run any example
npm run beep
npm run cpal-direct
npm run optional-backend -- jack
npm run list-devices
npm run audio-visualizer
npm run record-and-playback
```

## Examples Overview

All examples use the one-to-one CPAL API directly. Hosts, devices, and streams
own native resources, so each example closes all three explicitly.

### 1. Canonical CPAL stream (`cpal-direct.js`)

This example demonstrates the one-to-one CPAL API:

- Open the default `Host` and output `Device`
- Read the device's native `SupportedStreamConfig`
- Build a paused typed or raw `Stream` synchronously
- Play, close, and release the native handles explicitly

### 2. Beep (`beep.js`)

This example demonstrates how to:

- Create a simple beep sound (440 Hz sine wave)
- Fill CPAL's typed output buffer directly in the data callback
- Select a supported `f32` configuration from the output `Device`
- Play a tone for a specific duration
- Properly clean up audio resources

### 3. List Audio Devices (`list-devices.js`)

This example demonstrates how to:

- List all available audio hosts
- Enumerate all audio devices
- Get default input and output devices
- Display canonical descriptions, default configurations, and config ranges

### 4. Audio Visualizer (`audio-visualizer.js`)

This example demonstrates how to:

- Create a real-time audio visualizer in the terminal
- Use the default input device's native sample rate
- Process CPAL's typed input buffers to calculate volume levels
- Display a dynamic visualization of audio input
- Handle continuous audio streams

### 5. Record and Playback (`record-and-playback.js`)

This example demonstrates how to:

- Record audio from the default microphone for a specific duration
- Store the recorded audio in memory
- Resample and remix audio when input and output configurations differ
- Play back the recorded audio through the speakers
- Handle both input and output streams sequentially
- Supply recorded samples directly from CPAL's output callback

## Notes

- Some examples may require audio hardware (speakers, microphones) to work properly
- Input examples may require microphone permission from the operating system
- CPAL stream callbacks are real-time audio callbacks; production callbacks should avoid blocking work and allocations
- Error handling is included to demonstrate proper resource management
