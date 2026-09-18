import { expect, test, vi } from 'vitest';
import { ChunkProcessor, ColorMap, ColorMapName, DataChunk, SpectrogramConfig, WindowFunctionType } from '../src/spectrogram.mjs';
import canvas from 'canvas';

import * as fftFunctions from "../src/fft.mjs";
import { Seismogram, SeismogramDisplayData } from '../src/seismogram.mjs';
import { SeismogramSegment } from '../src/seismogramsegment.mjs';
import { FFTResult } from '../src/fft.mjs';

vi.stubGlobal('ImageData', canvas.ImageData);

test("SpectrogramConfig preserves inherited defaults", () => {
    const config = new SpectrogramConfig();
    expect(config).toBeDefined();
    // Gives correct defaults for both seismograph and spectrogram config
    expect(JSON.parse(JSON.stringify(config))).toMatchObject({
        configId: 1,
        isXAxis: true,
        isXAxisTop: false,
        xAxisTimeZone: null,
        isYAxisNice: true,
        isYAxis: true,
        isYAxisRight: false,
        yAxisNumTickHint: 8,
        xGridLines: false,
        yGridLines: false,
        gridLineColor: "gainsboro",
        _timeFormat: null,
        showTitle: true,
        _xLabel: "Time",
        xLabelOrientation: "horizontal",
        _xSublabel: "",
        xSublabelIsUnits: false,
        _yLabel: "Frequency",
        _yLabelRight: "",
        yLabelOrientation: "vertical",
        _ySublabel: "",
        ySublabelTrans: 15,
        ySublabelIsUnits: true,
        amplitudeMode: "minmax",
        doGain: true,
        windowAmp: true,
        resolutionScale: 2,
        _fixedAmplitudeScale: null,
        _fixedTimeScale: null,
        _linkedAmplitudeScale: { "_scaleId": 1, "_halfWidth": 0, "_graphSet": {}, "_recalcTimeoutID": null },
        _linkedTimeScale: { "_prev_zoom_k": 1, "_prev_zoom_x": 0, "_scaleId": 1, "_graphSet": {}, "_originalDuration": "PT0S", "_originalOffset": "PT0S", "_zoomedDuration": "PT0S", "_zoomedOffset": null },
        isRelativeTime: false,
        doMarkers: true,
        markerTextOffset: 0.85,
        markerTextAngle: 45,
        markerFlagpoleBase: "bottom",
        minHeight: 0,
        maxHeight: null,
        minWidth: 0,
        maxWidth: null,
        margin: { "top": 25, "right": 20, "bottom": 42, "left": 85 },
        segmentDrawCompressedCutoff: 10,
        maxZoomPixelPerSample: 20,
        wheelZoom: false,
        allowZoom: true,
        connectSegments: false,
        lineColors: ["skyblue", "olivedrab", "goldenrod", "firebrick", "darkcyan", "chocolate", "darkmagenta", "mediumseagreen", "rebeccapurple", "sienna", "orchid", "royalblue", "mediumturquoise", "chartreuse", "peru", "black"],
        lineWidth: 1,
        fftSize: 256,
        windowSize: 256,
        overlapPerc: 0.86,
        minChunkTime: 10,
        windowType: "hann",
        freqMin: 0,
        freqMax: 15,
        minDb: 30,
        maxDb: 120,
        spectrogramColorMap: "jet",
    });
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
        console.log(colorMaps[i])
        const rgbValues = colorInputs.map(input => colorMap.getRGB(input));
        expect(rgbValues).toMatchSnapshot();
    }
});