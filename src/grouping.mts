import { SeismogramDisplayData } from "./seismogram.mjs";
import { isDef } from "./util.mjs";

/**
 * Groups seismic data into subarrays where members of each subarray are
 * from the same network/station, have the same band and gain/instrument code
 * and overlap in time. Note, in most cases the subarrays will have
 * 1, 2 or 3 elements, but this is not checked nor guaranteed.
 *
 * @param   sddList list of SeismogramDisplayData to split
 * @returns          array of array of data, organized by component of motion
 */
export function groupComponentOfMotion(
  sddList: Array<SeismogramDisplayData>,
): Array<Array<SeismogramDisplayData>> {
  let tmpSeisDataList = Array.from(sddList);

  const bifurcate = (
    arr: Array<SeismogramDisplayData>,
    filter: (arg0: SeismogramDisplayData) => boolean,
  ) =>
    arr.reduce(
      (
        acc: Array<Array<SeismogramDisplayData>>,
        val: SeismogramDisplayData,
      ) => (acc[filter(val) ? 0 : 1].push(val), acc),
      [[], []],
    );

  const byFriends = [];
  let first = tmpSeisDataList.shift();
  while (isDef(first)) {
    const isFriend = (sdddB: SeismogramDisplayData) =>
      isDef(first) /* dumb, typescript */ &&
      first.networkCode === sdddB.networkCode &&
      first.stationCode === sdddB.stationCode &&
      first.locationCode === sdddB.locationCode &&
      first.channelCode.slice(0, 2) === sdddB.channelCode.slice(0, 2) &&
      first.timeRange.overlaps(sdddB.timeRange);

    const splitArray = bifurcate(tmpSeisDataList, isFriend);
    const nextGroup = splitArray[0];
    nextGroup.unshift(first);
    byFriends.push(nextGroup);
    tmpSeisDataList = splitArray[1];
    first = tmpSeisDataList.shift();
  }

  return byFriends;
}
