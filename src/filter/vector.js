//@flow


export const DtoR = Math.PI / 180;

export function rotate(seisA: model.Seismogram, azimuthA: number, seisB: model.Seismogram, azimuthB: number, azimuth: number) {
  if (seisA.y.length != seisB.y.length) {
    throw new Error("seisA and seisB should be of same lenght but was "
    +seisA.y.length+" "+seisB.y.length);
  }
  if (seisA.sampleRate != seisB.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisB.sampleRate);
  }
  if ((azimuthA + 90) % 360 != azimuthB % 360) {
    throw new Error("Expect azimuthB to be azimuthA + 90, but was "+azimuthA+" "+azimuthB);
  }
//  [   cos(theta)    -sin(theta)    0   ]
//  [   sin(theta)     cos(theta)    0   ]
//  [       0              0         1   ]
// seisB => x
// seisA => y
// sense of rotation is opposite for aziumth vs math
  const rotRadian = 1 * DtoR * (azimuth - azimuthA);
  const cosTheta = Math.cos(rotRadian);
  const sinTheta = Math.sin(rotRadian);
  let x = new Array(seisA.y.length);
  let y = new Array(seisA.y.length);
  for (var i = 0; i < seisA.y.length; i++) {
    x[i] = cosTheta * seisB.yAtIndex(i) - sinTheta * seisA.yAtIndex(i);
    y[i] = sinTheta * seisB.yAtIndex(i) + cosTheta * seisA.yAtIndex(i);
  }
  let outSeisRad = seisA.clone();
  outSeisRad.y = y;
  outSeisRad.channelCode = seisA.chanCode.slice(0,2)+"R";
  let outSeisTan = seisA.clone();
  outSeisTan.y = x;
  outSeisTan.channelCode = seisA.chanCode.slice(0,2)+"T";
  let out = {
    "radial": outSeisRad,
    "transverse": outSeisTan,
    "azimuthRadial": azimuth % 360,
    "azimuthTransverse": (azimuth + 90) % 360
  };
  return out;
}
export function vectorMagnitude(seisA: model.Seismogram, seisB: model.Seismogram, seisC: model.Seismogram) {
  if (seisA.y.length != seisB.y.length) {
    throw new Error("seisA and seisB should be of same lenght but was "
    +seisA.y.length+" "+seisB.y.length);
  }
  if (seisA.sampleRate != seisB.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisB.sampleRate);
  }
  if (seisA.y.length != seisC.y.length) {
    throw new Error("seisA and seisC should be of same lenght but was "
    +seisA.y.length+" "+seisC.y.length);
  }
  if (seisA.sampleRate != seisC.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisC.sampleRate);
  }
  let y = new Array(seisA.y.length);
  for (var i = 0; i < seisA.y.length; i++) {
    y[i] = Math.sqrt(seisA.yAtIndex(i) * seisA.yAtIndex(i)
      + seisB.yAtIndex(i) * seisB.yAtIndex(i)
      + seisC.yAtIndex(i) * seisC.yAtIndex(i));
  }
  let outSeis = seisA.clone();
  outSeis.y = y;
  outSeis.channelCode = seisA.chanCode.slice(0,2)+"M";
  return outSeis;
}
