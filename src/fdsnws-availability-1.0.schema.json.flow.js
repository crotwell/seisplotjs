// @flow
export type RootType = {
  created?: FdsnDateTime,
  version: Object,
  datasources: Array<Datasource>
} & Object;
export type FdsnDateTime = string;
export type Datasource = ({
  network: string,
  station: string,
  location: string,
  channel: string,
  quality?: string,
  samplerate?: number,
  timespans?: Array<Array<FdsnDateTime>>,
  earliest?: FdsnDateTime,
  latest?: FdsnDateTime,
  updated?: FdsnDateTime,
  timespanCount?: number,
  restriction?: string
} & Object) &
  (({ timespans: any } & Object) | ({ earliest: any, latest: any } & Object));
