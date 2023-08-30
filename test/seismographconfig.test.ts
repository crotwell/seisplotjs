// @flow

import {SeismographConfig} from '../src/seismographconfig.js';

test("simple seismographconfig clone", () => {
  const seisConfig = new SeismographConfig();

  seisConfig.isXAxis = false;
  seisConfig.isYAxis = false;
  seisConfig.timeFormat = function (date: Date): string { return date.toISOString();};
  seisConfig.relativeTimeFormat = function() { return "3e";};
  seisConfig.amplitudeFormat = function() { return "4e";};
  seisConfig._title = [ 'Bla bla'];
  seisConfig.xLabel = "BigTime";
  seisConfig.xLabelOrientation = "horizontal";
  seisConfig.xSublabel = "Nope";
  seisConfig.yLabel = "You Betcha";
  seisConfig.yLabelOrientation = "vertical";
  seisConfig.ySublabel = "Boo hoo";
  seisConfig.ySublabelTrans = 17;
  seisConfig.ySublabelIsUnits = false;
  seisConfig.doGain = false;
  seisConfig.fixedAmplitudeScale = [1,2];
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
  // margin toString function causes problems, so delete before compare
  delete seisConfig.margin.toString;
  delete cloned.margin.toString;
  expect(seisConfig).toEqual(cloned);
  seisConfig.yLabel = "Changed";
  expect(cloned.yLabel).not.toEqual(seisConfig.yLabel);
});


test("json round trip", () => {
  const seisConfig = new SeismographConfig();
  const jsonConfig = seisConfig.asJSON();
  console.log(JSON.stringify(jsonConfig, null, 2));
  const rtConfig = SeismographConfig.fromJSON(jsonConfig);

  Object.getOwnPropertyNames(seisConfig).forEach(p => {
    if (p === "margin") {
      // special to avoid toString
      expect(rtConfig.margin.top).toEqual(seisConfig.margin.top);
      expect(rtConfig.margin.bottom).toEqual(seisConfig.margin.bottom);
      expect(rtConfig.margin.left).toEqual(seisConfig.margin.left);
      expect(rtConfig.margin.right).toEqual(seisConfig.margin.right);
    } else if (! p.startsWith("_")) {
      // @ts-ignore
      expect(rtConfig[p]).toEqual(seisConfig[p]);
    }
  });
  expect(rtConfig.asJSON()).toEqual(jsonConfig);

});
