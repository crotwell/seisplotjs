// @flow

export const kmPerDeg = 111.19;

export function degtokm(deg :number) :number {
  return deg * kmPerDeg;
}

export function kmtodeg(km :number) :number {
  return km / kmPerDeg;
}

type DistAzOutput = {
  delta: number,
  az: number,
  baz: number
}
/**
 * lat1 => Latitude of first point (+N, -S) in degrees
 * lon1 => Longitude of first point (+E, -W) in degrees
 * lat2 => Latitude of second point
 * lon2 => Longitude of second point
 *
 * Returns a simple object (DistAzOutput) with:
 ```
 *     delta       => Great Circle Arc distance in degrees
 *     az          => Azimuth of pt. 1 wrt pt. 2 in degrees
 *     baz         => Azimuth of pt. 2 wrt pt. 1 in degrees
 ```
 *
 * azimuth is if you stand at point 2 and measure angle between north
 *   and point 1. I.E. point 1 is the station and point 2 is the event.
 */
export function distaz(lat1 :number, lon1 :number, lat2 :number, lon2 :number) :DistAzOutput {
    let result = {
        stalat: lat1,
        stalon: lon1,
        evtlat: lat2,
        evtlon: lon2,
        delta: 0.0,
        az: 0.0,
        baz: 0.0
    };

    if ((lat1 == lat2)&&(lon1 == lon2)) {
        // don't do calc, just return zero for idential points
        result.delta = 0;
        result.az = 0;
        result.baz = 0;
        return result;
    }
    let scolat, slon, ecolat, elon;
    let a,b,c,d,e,aa,bb,cc,dd,ee,g,gg,h,hh,k,kk;
    let rhs1,rhs2,sph,rad,del,daz,dbaz;

    rad=2.*Math.PI/360.0;
    /*
     *
     * scolat and ecolat are the geocentric colatitudes
     * as defined by Richter (pg. 318)
     *
     * Earth Flattening of 1/298.257 take from Bott (pg. 3)
     *
     */
    sph=1.0/298.257;

    scolat=Math.PI/2.0 - Math.atan((1.-sph)*(1.-sph)*Math.tan(lat1*rad));
    ecolat=Math.PI/2.0 - Math.atan((1.-sph)*(1.-sph)*Math.tan(lat2*rad));
    slon=lon1*rad;
    elon=lon2*rad;
    /*
     *
     *  a - e are as defined by Bullen (pg. 154, Sec 10.2)
     *     These are defined for the pt. 1
     *
     */
    a=Math.sin(scolat)*Math.cos(slon);
    b=Math.sin(scolat)*Math.sin(slon);
    c=Math.cos(scolat);
    d=Math.sin(slon);
    e=-Math.cos(slon);
    g=-c*e;
    h=c*d;
    k=-Math.sin(scolat);
    /*
     *
     *  aa - ee are the same as a - e, except for pt. 2
     *
     */
    aa=Math.sin(ecolat)*Math.cos(elon);
    bb=Math.sin(ecolat)*Math.sin(elon);
    cc=Math.cos(ecolat);
    dd=Math.sin(elon);
    ee=-Math.cos(elon);
    gg=-cc*ee;
    hh=cc*dd;
    kk=-Math.sin(ecolat);
    /*
     *
     *  Bullen, Sec 10.2, eqn. 4
     *
     */
    del=Math.acos(a*aa + b*bb + c*cc);
    result.delta=del/rad;
    /*
     *
     *  Bullen, Sec 10.2, eqn 7 / eqn 8
     *
     *    pt. 1 is unprimed, so this is technically the baz
     *
     *  Calculate baz this way to avoid quadrant problems
     *
     */
    rhs1=(aa-d)*(aa-d)+(bb-e)*(bb-e)+cc*cc - 2.;
    rhs2=(aa-g)*(aa-g)+(bb-h)*(bb-h)+(cc-k)*(cc-k) - 2.;
    dbaz=Math.atan2(rhs1,rhs2);
    if (dbaz<0.0) {
        dbaz=dbaz+2*Math.PI;
    }
    result.baz=dbaz/rad;
    /*
     *
     *  Bullen, Sec 10.2, eqn 7 / eqn 8
     *
     *    pt. 2 is unprimed, so this is technically the az
     *
     */
    rhs1=(a-dd)*(a-dd)+(b-ee)*(b-ee)+c*c - 2.;
    rhs2=(a-gg)*(a-gg)+(b-hh)*(b-hh)+(c-kk)*(c-kk) - 2.;
    daz=Math.atan2(rhs1,rhs2);
    if(daz<0.0) {
        daz=daz+2*Math.PI;
    }
    result.az=daz/rad;
    /*
     *
     *   Make sure 0.0 is always 0.0, not 360.
     *
     */
    if(Math.abs(result.baz-360.) < .00001) result.baz=0.0;
    if(Math.abs(result.az-360.) < .00001) result.az=0.0;
    return result;
}
