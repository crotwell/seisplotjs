import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CanvasRenderer, ChunkProcessor, ColorMap, ColorMapName, DataChunk, SpectrogramConfig, WindowFunctionType } from '../src/spectrogram.mjs';
import canvas from 'canvas';

import * as fftFunctions from '../src/fft.mjs';
import { Seismogram, SeismogramDisplayData } from '../src/seismogram.mjs';
import { SeismogramSegment } from '../src/seismogramsegment.mjs';
import { FFTResult } from '../src/fft.mjs';
import { SeismographConfig } from '../src/seismographconfig.mjs';


vi.stubGlobal('ImageData', canvas.ImageData);

test('SpectrogramConfig preserves inherited defaults', () => {
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

test('ChunkProcessor produces predictable bands for aligned sine waves', () => {
    const config = new SpectrogramConfig();
    config.fftSize = 512;
    config.windowSize = 256;

    const sampleRate = 100;
    const processor = new ChunkProcessor(config, sampleRate, 256);

    // Integer bins for the 256-sample analysis window. Since the FFT is
    // zero-padded from 256 to 512, the corresponding FFT bins are doubled.
    const analysisWindowBins = [2, 6, 12, 24, 38];
    const frequencies = analysisWindowBins.map(
        (bin) => bin * sampleRate / config.windowSize,
    );

    // Add sine waves of each frequency calculated in analysisWindowBins into the input data
    const input = Float32Array.from({ length: 512 }, (_, i) => {
        const time = i / sampleRate;
        return frequencies.reduce(
            (sum, frequency) =>
                sum + Math.sin(2 * Math.PI * frequency * time),
            0,
        );
    });

    // Calculate the spectrogram for the input
    const out = processor.process(
        input,
        0,
        input.length,
        config,
        (value) => [value * 255, value * 255, value * 255],
    );

    // The output should be an RGBA array, with one set for each pixel
    expect(out.data.length).toBe(out.width * out.height * 4);
    // The width of the output is defined by the overlap and sample rate
    expect(out.width).toBe(15);
    // The height of the output is the output amount of bins, but only
    // the positive component, so it's halved
    expect(out.height).toBe(config.fftSize / 2 + 1);

    // Helper to get a pixel offset at the given coordinates
    const pixel = (x: number, y: number) =>
        out.data[(y * out.width + x) * 4];

    // Average each FFT bin across time slices. This avoids making the test
    // depend on small phase/window differences in individual columns
    const averageSpectrum = Array.from(
        { length: out.height },
        (_, fftBin) => {
            const row = out.height - 1 - fftBin;
            let total = 0;

            for (let x = 0; x < out.width; x++) {
                // We can get away with only using the red channel because all
                // pixel values are identical
                total += pixel(x, row);
            }

            return total / out.width;
        },
    );

    // Map the window size bins to the full size of the FFT size
    const expectedFftBins = analysisWindowBins.map(
        (bin) => bin * (config.fftSize / config.windowSize)
    );

    // Now that we have a frequency output, we want to check if the appropriate
    // frequency bins (the ones that correspond to the input sine waves) are bright
    for (const expectedBin of expectedFftBins) {
        const currRegionSize = 3
        // Calculate the peak brightness of the region of frequency bins where we
        // expect the sine wave frequency to be
        const currentRegionPeak = Math.max(
            ...averageSpectrum.slice(
                Math.max(expectedBin - Math.floor(currRegionSize / 2), 0),
                Math.min(expectedBin + Math.floor(currRegionSize / 2) + 1, config.fftSize)
            ),
        );

        // We slice 'neighbor' regions of bins (just nearby frequency bin regions that
        // should not be affected by the sine wave we're checking) to compare against, expecting
        // our region to be brighter than its neighbors
        const neighborBinOffset = 3
        const neighborBinSize = 2
        const neighboringBins = [
            ...averageSpectrum.slice(
                expectedBin - neighborBinOffset - neighborBinSize + 1,
                expectedBin - neighborBinOffset
            ),
            ...averageSpectrum.slice(
                expectedBin + neighborBinOffset,
                expectedBin + neighborBinOffset + neighborBinSize
            ),
        ];
        // Amidst all the neighbor points, our bin should have the brightest
        const neighboringPeak = Math.max(...neighboringBins);
        expect(currentRegionPeak).toBeGreaterThan(neighboringPeak);
    }
});

test('all window functions give the right output', () => {
    const windowTypes = ['hann', 'hamming', 'blackman', 'rectangular'];
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

test.each([
    'viridis',
    'inferno',
    'grayscale',
    'jet',
    'hot',
    'cool',
    'spring',
    'summer',
    'autumn',
    'winter',
    'bone'
])('%s ColorMap gives the right output', (mapName) => {
    const colorInputs = [0, 0.25, 0.5, 0.75, 1];
    const colorMap = new ColorMap(mapName as ColorMapName);
    const rgbValues = colorInputs.map(input => colorMap.getRGB(input));
    expect(rgbValues).toMatchSnapshot();
});

describe('CanvasRenderer.render', () => {
    const chunkWidth = 15;
    const chunkHeight = 257;
    beforeEach(() => {
        vi.restoreAllMocks();
        const bitmap = {
            width: chunkWidth,
            height: chunkHeight,
            close: vi.fn(),
        };

        const createImageBitmap = vi
            .fn()
            .mockResolvedValue(bitmap);

        vi.stubGlobal('createImageBitmap', createImageBitmap);
    });

    test('initializes the canvas and renders the processed spectrogram', async () => {
        // Arbitrary canvas size because zeros messes up the calculations
        const { canvas, context } = makeCanvasMock(100, 100);

        const process = vi
            .spyOn(ChunkProcessor.prototype, 'process')
            .mockReturnValue(new ImageData(chunkWidth, chunkHeight));

        const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, 256);

        const inputData = new Float32Array(2048).fill(0)
        const spectrogramConfig = new SpectrogramConfig();
        const sampleRate = 100
        spectrogramConfig.fftSize = 512;
        spectrogramConfig.windowSize = 256;

        await renderer.render(
            inputData,
            spectrogramConfig,
            sampleRate,
            0,
            0,
            inputData.length / sampleRate
        );

        expect(canvas.getContext).toHaveBeenCalled();
        // We have indeed processed chunks with ChunkProcessor
        expect(process).toHaveBeenCalled();
        // We have drawn data to the canvas
        expect(context.drawImage).toHaveBeenCalled();
    });

    test.each([
        { overlap: 0.25, expectedLength: 1152 },
        { overlap: 0.75, expectedLength: 1024 },
        { overlap: 0.95, expectedLength: 1001 },
    ])('overlap config gives correct behavior', async ({ overlap, expectedLength }) => {
        // Arbitrary canvas size because zeros messes up the calculations
        const { canvas } = makeCanvasMock(100, 100);

        const process = vi
            .spyOn(ChunkProcessor.prototype, 'process')
            .mockReturnValue(new ImageData(chunkWidth, chunkHeight));

        const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, 256);

        const inputData = new Float32Array(2048).fill(0)
        const spectrogramConfig = new SpectrogramConfig();
        const sampleRate = 100
        spectrogramConfig.fftSize = 512;
        spectrogramConfig.windowSize = 256;
        spectrogramConfig.overlapPerc = overlap;

        await renderer.render(
            inputData,
            spectrogramConfig,
            sampleRate,
            0,
            0,
            inputData.length / sampleRate
        );

        const [_, chunkSamplesStart, chunkSamplesEnd] = process.mock.calls[0];
        expect(chunkSamplesEnd - chunkSamplesStart).toBe(expectedLength);
        process.mockClear();
    });

    test('reusing cached chunks for the same request', async () => {
        // Arbitrary canvas size because zeros messes up the calculations
        const { canvas } = makeCanvasMock(100, 100);

        const process = vi
            .spyOn(ChunkProcessor.prototype, 'process')
            .mockReturnValue(new ImageData(chunkWidth, chunkHeight));

        const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, 256);

        const inputData = new Float32Array(2048).fill(0)
        const spectrogramConfig = new SpectrogramConfig();
        const sampleRate = 100
        spectrogramConfig.fftSize = 512;
        spectrogramConfig.windowSize = 256;

        await renderer.render(inputData, spectrogramConfig, sampleRate, 0, 0, 10);
        await renderer.render(inputData, spectrogramConfig, sampleRate, 0, 0, 10);

        expect(process).toHaveBeenCalledTimes(1);
    });
});

function makeCanvasMock(width: number, height: number) {
    const context = {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        restore: vi.fn(),
    };

    const canvas = {
        width,
        height,
        getContext: vi.fn(() => context),
    };

    return { canvas, context };
}