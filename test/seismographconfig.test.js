// @flow

import {SeismographConfig, DRAW_BOTH} from '../src/seismographconfig.js';
import  {moment, StartEndDuration} from '../src/util.js';

test("simple seismographconfig clone", () => {
  let seisConfig = new SeismographConfig();

  seisConfig.drawingType = DRAW_BOTH;
  seisConfig.isXAxis = false;
  seisConfig.isYAxis = false;
  seisConfig.xScaleFormat = function() { return "3e";};
  seisConfig.yScaleFormat = "4e";
  seisConfig._title = [ 'Bla bla'];
  seisConfig.xLabel = "BigTime";
  seisConfig.xLabelOrientation = "horizontal";
  seisConfig.xSublabel = "Nope";
  seisConfig.yLabel = "You Betcha";
  seisConfig.yLabelOrientation = "vertical";
  seisConfig.ySublabel = "Boo hoo";
  seisConfig.ySublabelTrans = 17;
  seisConfig.ySublabelIsUnits = false;
  seisConfig.doRMean = false;
  seisConfig.doGain = false;
  seisConfig.fixedYScale = [1,2];
  seisConfig.markerTextOffset = .80;
  seisConfig.markerTextAngle = 47;
  seisConfig.markerFlagpoleBase = "center"; // bottom or center
  seisConfig.minHeight=110;
  seisConfig.margin = {top: 10, right: 10, bottom: 52, left: 75, toString: function() {return "t:"+this.top+" l:"+this.left+" b:"+this.bottom+" r:"+this.right;}};
  seisConfig.segmentDrawCompressedCutoff=11;
  seisConfig.maxZoomPixelPerSample = 21;

  seisConfig.wheelZoom = false;
  seisConfig.connectSegments = true;
  seisConfig.lineColors = [
     "red",
     "blue",
     "green",
     "black"];
  seisConfig.lineWidth = 2;
  const cloned = seisConfig.clone();
  Object.getOwnPropertyNames(seisConfig).forEach( name => {
    if (name !== 'margin') {
      // $FlowFixMe
      expect(cloned[name]).toEqual(seisConfig[name]);
    } else {
      expect(cloned.margin.top).toEqual(seisConfig.margin.top);
    }
  });
  seisConfig.drawingType = DRAW_BOTH;
  seisConfig.yLabel = "Changed";
  expect(cloned.yLabel).not.toEqual(seisConfig.yLabel);
});
