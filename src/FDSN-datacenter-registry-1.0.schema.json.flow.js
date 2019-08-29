// @flow
export type RootType = {
  version: Object,
  datacenters: Array<{
    name: string,
    website: string,
    fullName?: string,
    summary?: string,
    repositories?: Array<{
      name: string,
      description?: string,
      website?: string,
      services?: Services,
      datasets?: Array<{
        network?: string,
        station?: string,
        location?: string,
        channel?: string,
        starttime?: string,
        endtime?: string,
        priority?: number,
        description?: string,
        url?: string,
        services?: Services
      }>
    }>
  }>
} & Object;
export type Services = Array<{
  name: string,
  description?: string,
  url?: string,
  compatibleWith?: string
}>;
