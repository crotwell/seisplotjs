// @flow
export type RootType = {
  version: Object,
  datacenters: Array<{
    name: string,
    website: string,
    fullName?: string,
    summary?: string,
    repositories: Array<Repository>
  }>
} & Object;
export type Repository = {
  name: string,
  description?: string,
  website?: string,
  services: Array<Service>,
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
    services?: Array<Service>
  }>
};
export type Service = {
  name: string,
  description?: string,
  url?: string,
  compatibleWith?: string
};
