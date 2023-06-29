
export interface Location {
  latitude: number;
  longitude: number;
}

export function inArea(bounds: Array<Location>, point: Location): boolean {
    let lonA: number;
    let latA: number;
    let lonB: number;
    let latB: number;
    let inside = 0;
    for(let i = 0; i < bounds.length; i++) {
        lonA = bounds[i].longitude - point.longitude;
        latA = bounds[i].latitude - point.latitude;
        lonB = bounds[(i + 1) % bounds.length].longitude - point.longitude;
        latB = bounds[(i + 1) % bounds.length].latitude - point.latitude;
        const check = polygonPointCheck(lonA, latA, lonB, latB);
        if(check === 4) {
            return true;
        }
        inside += check;
    }
    return (inside != 0);
}

export function polygonPointCheck(lonA: number,
                                  latA: number,
                                  lonB: number,
                                  latB: number): number {
    if(latA * latB > 0) {
        return 0;
    }
    if((lonA * latB !== lonB * latA) || (lonA * lonB > 0)) {
        if(latA * latB < 0) {
            if(latA > 0) {
                if(latA * lonB >= lonA * latB) {
                    return 0;
                }
                return -2;
            }
            if(lonA * latB >= latA * lonB) {
                return 0;
            }
            return 2;
        }
        if(latB === 0) {
            if(latA === 0) {
                return 0;
            } else if(lonB > 0) {
                return 0;
            } else if(latA > 0) {
                return -1;
            }
            return 1;
        } else if(lonA > 0) {
            return 0;
        } else if(latB > 0) {
            return 1;
        }
        return -1;
    }
    return 4;
}
