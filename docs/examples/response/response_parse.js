import * as sp from '../../seisplotjs_3.1.1_standalone.mjs';

export const SIS_NS = "http://anss-sis.scsn.org/xml/ext-stationxml/3.0";
export const STAML_NS = sp.stationxml.STAML_NS;

/* SIS uses a different style of metadata, based on StationXML, but with
 * additions. So a separate parsing is needed to find the response.
 */
export function parse_sis_xml(sisxml) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(sisxml, "application/xml");
  const top = sisxml.documentElement;
  if (! top) {throw new Error("No documentElement in XML");}
  let hard_resp = top.getElementsByTagNameNS(SIS_NS, 'HardwareResponse');
  let resp_dict_group = hard_resp[0].getElementsByTagNameNS(SIS_NS, 'ResponseDictGroup');
  let stages = [];
  let resp_dict = new Map();
  let rd_array = Array.from(resp_dict_group[0].getElementsByTagNameNS(SIS_NS, "ResponseDict"));
  rd_array.forEach(rdict => {
    const resp_el = rdict.firstElementChild;
    let name = resp_el.getAttribute("name");
    if (resp_el.localName === 'FIR') {
      // add fake Gain
      let gain = sisxml.createElementNS(STAML_NS, "StageGain");
      let gval = sisxml.createElementNS(STAML_NS, "Value");
      gval.append(sisxml.createTextNode("1.0"));
      gain.append(gval);
      let gfreq = sisxml.createElementNS(STAML_NS, "Frequency");
      gfreq.append(sisxml.createTextNode("0.0"));
      gain.append(gfreq);
      resp_el.append(gain);
      let stage = sp.stationxml.convertToStage(rdict);
      resp_dict.set(name, stage.filter);
    } else if (resp_el.localName === 'FilterSequence') {
      let s_array = Array.from(resp_el.getElementsByTagNameNS(SIS_NS, "FilterStage"));
      s_array.forEach(fs => {
        let seqNum = fs.getElementsByTagNameNS(SIS_NS, "SequenceNumber")[0].textContent;
        let sis_filter_ref = fs.getElementsByTagNameNS(SIS_NS, "Filter")[0];
        let fname = sis_filter_ref.getElementsByTagNameNS(SIS_NS, "Name")[0].textContent;

        let sis_filter = resp_dict.get(fname);
        let decimationXml = fs.getElementsByTagNameNS(SIS_NS, 'Decimation');
        let decimation = null;
        if (decimationXml.length > 0) {
          decimation = sp.stationxml.convertToDecimation(decimationXml[0]);
        }
        let gainXml = fs.getElementsByTagNameNS(SIS_NS, 'Gain');
        let gain = null;
        if (gainXml.length > 0) {
          gain = sp.stationxml.convertToGain(gainXml[0]);
        } else {
          throw new Error("Did not find Gain in stage number "+seqNum+" "+fname);
        }
        stages.push(new sp.stationxml.Stage(sis_filter, decimation, gain));
      });
    }
  });
  return stages;
}
