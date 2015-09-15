/**
 * Philip Crotwell
 * University of South Carolina, 2014
 * http://www.seis.sc.edu
 */


  var parseDataRecords = function(arrayBuffer) {
	var dataRecords = []
	var offset = 0
	while (offset < arrayBuffer.byteLength) {
		var dataView = new DataView(arrayBuffer, offset)
		var dr = new DataRecord(dataView)
		dataRecords.push(dr)
		offset += dr.header.recordSize
	}
	return dataRecords
  };


function DataRecord(dataView) {
	this.header = new DataHeader(dataView)
    this.length = this.header.numSamples;
	
	this.data = new DataView(dataView.buffer, dataView.byteOffset+this.header.dataOffset, this.header.recordSize-this.header.dataOffset)
	this.decompress = function() {
	    var decompData = seedcodec.decompress(this.header.encoding, this.data, this.header.numSamples, this.header.littleEndian);
            decompData.header = this.header;
            return decompData;
	}
	this.decompData;
	this.codes = function() {
	    return this.header.netCode+"."+this.header.staCode+"."+this.header.locCode+"."+this.header.chanCode;
	}
}

function DataHeader(dataView) {
	var debugDR = "";
	this.seq = makeString(dataView, 0, 6);
	this.typeCode = dataView.getUint8(6)
	this.continuationCode = dataView.getUint8(7);
	this.staCode = makeString(dataView, 8, 5);
	this.locCode = makeString(dataView, 13, 2);
	this.chanCode = makeString(dataView, 15, 3);
	this.netCode = makeString(dataView, 18, 2);
	this.startBTime = new BTime(dataView, 20)
	var headerByteSwap = checkByteSwap(this.startBTime) 
	if (headerByteSwap) {
		this.startBTime = new BTime(dataView, 20, headerByteSwap);
	}
	this.numSamples = dataView.getInt16(30, headerByteSwap);
	this.sampRateFac = dataView.getInt16(32, headerByteSwap);
	this.sampRateMul = dataView.getInt16(34, headerByteSwap);
	//activityFlags = dataView.getUint8(36)
    //ioClockFlags = dataView.getUint8(37)
    //dataQualityFlags = dataView.getUint8(38)
	this.numBlockettes = dataView.getUint8(39)
    //timeCorrection = dataView.getInt32(40, headerByteSwap)
	this.dataOffset = dataView.getUint16(44, headerByteSwap);
	this.blocketteOffset = dataView.getUint16(46, headerByteSwap);
	var offset = this.blocketteOffset;
	this.blocketteList = [];
	this.recordSize = 4096
	for (var i=0; i< this.numBlockettes; i++) {
		var nextOffset = dataView.getUint16(offset+2, headerByteSwap);
		if (nextOffset == 0) {
			// last blockette
			nextOffset = this.dataOffset
		}
		if (nextOffset == 0) {
			nextOffset = offset; // zero length, probably an error...
		}
		var blockette = new Blockette(dataView, offset, nextOffset-offset);
		this.blocketteList.push(blockette);
		offset = nextOffset;
		if (blockette.type == 1000) {
			this.recordSize = 1 << blockette.dataRecordLengthByte;
			this.encoding = blockette.encoding;
			if (blockette.wordOrder == 0) {
				this.swapBytes = true
			} else {
				this.swapBytes = false
			}
			this.littleEndian = (blockette.wordOrder === 0);
		}
	}
	this.toString = function() {
		return this.netCode+"."+this.staCode+"."+this.locCode+"."+this.chanCode+" "+this.start.toISOString()+" "+this.encoding;
	}
	this.calcSampleRate = function() {
        var factor = this.sampRateFac;
        var multiplier = this.sampRateMul;
        var sampleRate = 10000.0; // default (impossible) value;
        if((factor * multiplier) != 0.0) { // in the case of log records
            sampleRate = Math.pow(Math.abs(factor),
                                  (factor / Math.abs(factor))) 
                         * Math.pow(Math.abs(multiplier),
                                  (multiplier / Math.abs(multiplier)));
        }
        return sampleRate;
    }
    this.sampleRate = this.calcSampleRate();
	this.start = this.startBTime.toDate();
    this.timeOfSample = function(i) {
        return new Date(this.start.getTime() + 1000*i/this.sampleRate);
    }
    this.end = this.timeOfSample(this.numSamples-1);
}

function Blockette(dataView, offset, length, headerByteSwap) {
	this.type = dataView.getUint16(offset, headerByteSwap);
	//console.error("blockette "+offset+" "+length+" "+this.type);
	// nextOffset = dataView.getUint16(offset+2, headerByteSwap)
	this.body = new DataView(dataView.buffer, dataView.byteOffset+offset, length);
	if (this.type == 1000) {
		this.encoding = this.body.getUint8(4);
		this.dataRecordLengthByte = this.body.getUint8(6);
		this.wordOrder = this.body.getUint8(5); 
	}
}

function makeString(dataView, offset, length) {
	var out = "";
	for (var i=offset; i<offset+length; i++) {
		out += String.fromCharCode(dataView.getUint8(i))
	}
	return out.trim();
}

function BTime(dataView, offset, byteSwap) {
	if (typeof byteSwap === 'undefined') { byteSwap = false; }
	this.length = 10;
	this.year = dataView.getInt16(offset, byteSwap);
	this.jday = dataView.getInt16(offset+2, byteSwap);
	this.hour = dataView.getInt8(offset+4);
	this.min = dataView.getInt8(offset+5);
	this.sec = dataView.getInt8(offset+6);
	// byte 7 unused, alignment
	this.tenthMilli = dataView.getInt16(offset+8, byteSwap);
	this.toString = function() {
		return this.year+"-"+this.jday+" "+this.hour+":"+this.min+":"+this.sec+"."+this.tenthMilli+" "+this.getDate().toISOString();
	}
	this.getDate = function() {
		return new Date(Date.UTC(this.year, 0, this.jday, this.hour, this.min, this.sec, this.tenthMilli/10));
	}
	this.toDate = this.getDate;
}


function checkByteSwap(bTime) {
	return bTime.year < 1960 || bTime.year > 2055;
}

  var areContiguous = function(dr1, dr2) {
    var h1 = dr1.header;
    var h2 = dr2.header;
    return h1.end.getTime() < h2.start.getTime() 
        && h1.end.getTime() + 1000*1.5/h1.sampleRate > h2.start.getTime();
};

/**
 * Merges data records into a arrary of float arrays. Each float array has
 * sampleRate, start, end, netCode, staCode, locCode, chanCode as well 
 * as the function timeOfSample(integer) set.
 * This assumes all data records are from the same channel.
 */
  var merge = function(drList) {
    var out = [];
    var prevDR, currDR;
    var current;
    drList.sort(function(a,b) {
        return a.header.start.getTime() - b.header.start.getTime();
    });
    var firstDR = drList[0];
    var assignMetaData = function(first, current) {
        current.sampleRate = first.header.sampleRate;
        current.start = first.header.start;
        current.timeOfSample = function(i) {
            return new Date(this.start.getTime() + 1000*i/this.sampleRate);
        }
        current.end = current.timeOfSample(current.length-1);
        current.netCode = first.header.netCode;
        current.staCode = first.header.staCode;
        current.locCode = first.header.locCode;
        current.chanCode = first.header.chanCode;
        current.codes = function()  {
            return this.netCode+"."+this.staCode+"."+this.locCode+"."+this.chanCode;
        };
        current.seisId = function() {
            return (this.codes()+"_"+this.start.toISOString()+"_"+this.end.toISOString()).replace(/\./g,'_').replace(/\:/g,'');
        };
    }
    for (var i=0; i<drList.length; i++) {
        currDR = drList[i];
        if (! current || ! areContiguous(prevDR, drList[i])) {
            if (current) {
                assignMetaData(firstDR, current);
                out.push(current);
            }
            firstDR = currDR;
            current = currDR.decompress();
        } else {
            current = current.concat(currDR.decompress());
        }
        prevDR = currDR;
    }
    if (current) {
        assignMetaData(firstDR, current);
        out.push(current);
    }
    for (i=0; i<out.length; i++) {
        current = out[i];
    }
    return out;
}

  var byChannel = function(drList) {
    var out = {};
    var key;
    for (var i=0; i<drList.length; i++) {
        var currDR = drList[i];
        key = currDR.codes();
        if (! out[key]) {
            out[key] = [currDR]; 
        } else {
            out[key].push(currDR);
        };
    }
    return out;
}

let miniseed = { parseDataRecords, byChannel, merge, seedcodec };
