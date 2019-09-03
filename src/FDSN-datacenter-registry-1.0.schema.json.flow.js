// @flow

/* original json schema from
https://github.com/FDSN/datacenter-registry

{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "id": "http://www.fdsn.org/schemas/FDSN-datacenter-registry-1.0.schema.json",
    "description": "Data center registry exchange format",
    "definitions": {
        "services": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["name"],
                "properties": {
                    "name": {
                        "description": "Service name (no white space)",
                        "type": "string",
                        "pattern": "^[-_a-zA-Z0-9]+$"
                    },
                    "description": {
                        "description": "Description of service",
                        "type": "string"
                    },
                    "url": {
                        "description": "URL to web service, ideally with documentation",
                        "type": "string",
                        "format": "uri"
                    },
                    "compatibleWith": {
                        "description": "Description of service compatibility with a standard or alternate service (e.g. fdsnws-dataselect, fdsnws-station, fdsnws-event)",
                        "type": "string"
                    }
                }
            }
        }
    },
    "type": "object",
    "required": ["version", "datacenters"],
    "properties": {
        "version": {
            "description": "Data center registry message format version",
            "const": 1.0
        },
        "datacenters": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "name",
                    "website"
                ],
                "properties": {
                    "name": {
                        "description": "Data center name (no white space)",
                        "type": "string",
                        "pattern": "^[-_a-zA-Z0-9]+$"
                    },
                    "website": {
                        "description": "URL to data center website",
                        "type": "string",
                        "format": "uri"
                    },
                    "fullName": {
                        "description": "Full name of data center",
                        "type": "string"
                    },
                    "summary": {
                        "description": "Summary of data center",
                        "type": "string"
                    },
                    "repositories": {
                        "description": "Repositories of data center",
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": false,
                            "required": ["name"],
                            "properties": {
                                "name": {
                                    "description": "Repository name (no white space)",
                                    "type": "string",
                                    "pattern": "^[-_a-zA-Z0-9]+$"
                                },
                                "description": {
                                    "description": "Description of repository",
                                    "type": "string"
                                },
                                "website": {
                                    "description": "URL to repository website",
                                    "type": "string",
                                    "format": "uri"
                                },
                                "services": {"$ref": "#/definitions/services"},
                                "datasets": {
                                    "description": "Data sets offered by the data center",
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "additionalProperties": false,
                                        "properties": {
                                            "network": {"type": "string"},
                                            "station": {"type": "string"},
                                            "location": {"type": "string"},
                                            "channel": {"type": "string"},
                                            "starttime": {
                                                "type": "string",
                                                "format": "date-time"
                                            },
                                            "endtime": {
                                                "type": "string",
                                                "format": "date-time"
                                            },
                                            "priority": {
                                                "description": "Priority of data center for this data set, with 1 being highest",
                                                "type": "integer"
                                            },
                                            "description": {
                                                "description": "Description of data set",
                                                "type": "string"
                                            },
                                            "url": {
                                                "description": "URL to data set or summary page",
                                                "type": "string",
                                                "format": "uri"
                                            },
                                            "services": {
                                                "description": "Services for this data set, overriding repository service declarations",
                                                "$ref": "#/definitions/services"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

 */

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
