import { expect, test, vi } from 'vitest';
import { ChunkProcessor, ColorMap, ColorMapName, DataChunk, SpectrogramConfig, WindowFunctionType } from '../src/spectrogram.mjs';
import canvas from 'canvas';

import * as fftFunctions from "../src/fft.mjs";
import { Seismogram, SeismogramDisplayData } from '../src/seismogram.mjs';
import { SeismogramSegment } from '../src/seismogramsegment.mjs';
import { FFTResult } from '../src/fft.mjs';
import { SeismographConfig } from '../src/seismographconfig.mjs';


vi.stubGlobal('ImageData', canvas.ImageData);

test("SpectrogramConfig preserves inherited defaults", () => {
    const defaultConfig = new SpectrogramConfig();
    const defaultSeismographConfig = new SeismographConfig();
    expect(defaultConfig).toBeDefined();
    expect(defaultSeismographConfig).toBeDefined();

    // Check if SpectrogramConfig has all the default values of SeismographConfig
    expect({ ...defaultConfig }).toEqual(
        expect.objectContaining({
            ...defaultSeismographConfig,
            // Below are the properties that we *don't* want to check for equality, because
            // they are unique to each instance
            configId: expect.any(Number),
            margin: expect.objectContaining({
                ...defaultSeismographConfig.margin,
                toString: expect.any(Function),
            }),
            _yLabel: expect.any(String),
            _linkedAmplitudeScale: expect.objectContaining({
                ...defaultSeismographConfig._linkedAmplitudeScale,
                _scaleId: expect.any(Number),
            }),
            _linkedTimeScale: expect.objectContaining({
                ...defaultSeismographConfig._linkedTimeScale,
                _scaleId: expect.any(Number),
            }),
        }),
    );

    const uniqueSpectrogramConfigs = Object.fromEntries(
        Object.entries(defaultConfig).filter(([key]) => !(key in defaultSeismographConfig)),
    );
    expect(uniqueSpectrogramConfigs).toMatchInlineSnapshot(`
      {
        "fftSize": 256,
        "freqMax": 15,
        "freqMin": 0,
        "frequencyFormat": [Function],
        "maxDb": 120,
        "minChunkTime": 10,
        "minDb": 30,
        "overlapPerc": 0.86,
        "spectrogramColorMap": "jet",
        "windowSize": 256,
        "windowType": "hann",
      }
    `)
});

test('DataChunk correctly converts and stores times', () => {
    const chunk = new DataChunk('chunk1', 100, 200, 50); // sampleRate = 50 Hz
    expect(chunk.startTime).toBeCloseTo(2); // 100 / 50 Hz => 2s
    expect(chunk.endTime).toBeCloseTo(4);   // 200 / 50 Hz => 4s
});

test('ChunkProcessor correctly processes empty data', () => {
    const spectrogramConfig = new SpectrogramConfig();
    spectrogramConfig.fftSize = 512;
    spectrogramConfig.windowSize = 256;
    const chunkProcessor = new ChunkProcessor(spectrogramConfig, 100, 256);
    const out = chunkProcessor.process(new Float32Array(512).fill(0), 0, 512, spectrogramConfig, (val) => [val * 255, val * 255, val * 255]);
    expect(out.data.length).toBe(out.width * out.height * 4);
    for (let i = 0; i < out.data.length; i += 4) {
        expect(out.data[i]).toBe(0);
        expect(out.data[i + 1]).toBe(0);
        expect(out.data[i + 2]).toBe(0);
        expect(out.data[i + 3]).toBe(255);
    }
});

test('ChunkProcessor correctly processes sine data', () => {
    const spectrogramConfig = new SpectrogramConfig();
    spectrogramConfig.fftSize = 512;
    spectrogramConfig.windowSize = 256;
    const chunkProcessor = new ChunkProcessor(spectrogramConfig, 100, 256);
    let dataArr = []
    for (let i = 0; i < 512; i++) {
        dataArr.push(
            Math.sin(2 * Math.PI * 5 * (i / 512)) +
            Math.sin(2 * Math.PI * 4 * (i / 512)) +
            Math.sin(2 * Math.PI * 3 * (i / 512)) +
            Math.sin(2 * Math.PI * 2 * (i / 512)) +
            Math.sin(2 * Math.PI * 1 * (i / 512))
        );
    }
    const out = chunkProcessor.process(new Float32Array(dataArr), 0, 512, spectrogramConfig, (val) => [val * 255, val * 255, val * 255]);
    expect(out.data.length).toBe(out.width * out.height * 4);
    expect(out.width).toEqual(15);
    expect(out.height).toEqual(257);
    expect(out.data).toMatchSnapshot();
});

test("all window functions give the right output", () => {
    const windowTypes = ["hann", "hamming", "blackman", "rectangular"];
    for (let i = 0; i < windowTypes.length; i++) {
        const config = new SpectrogramConfig();
        config.fftSize = 4;
        config.windowSize = 4;
        config.overlapPerc = 0;
        config.windowType = windowTypes[i] as WindowFunctionType;

        const data = new Float32Array([1, 2, 3, 4]);
        const capturedInputs: SeismogramSegment[] = [];

        const processor = new ChunkProcessor(config, 100, config.windowSize);
        const fftForwardSpy = vi.spyOn(fftFunctions, 'fftForward');
        fftForwardSpy.mockImplementation((displayData: SeismogramDisplayData | Seismogram) => {
            capturedInputs.push(...displayData.segments);
            return FFTResult.createFromPackedFreq(new Float32Array(3), 4, 100);
        });

        processor.process(data, 0, 4, config, () => [0, 0, 0]);

        expect(capturedInputs[0].y).toMatchSnapshot();

        fftForwardSpy.mockRestore();
    }
});

test("all ColorMaps give the right output", () => {
    const colorMaps = ["viridis", "inferno", "grayscale", "jet", "hot", "cool", "spring", "summer", "autumn", "winter", "bone"];
    const colorInputs = [0, 0.25, 0.5, 0.75, 1];
    for (let i = 0; i < colorMaps.length; i++) {
        const colorMap = new ColorMap(colorMaps[i] as ColorMapName);
        const rgbValues = colorInputs.map(input => colorMap.getRGB(input));
        expect(rgbValues).toMatchSnapshot();
    }
});