
import { expect} from '@jest/globals';

const ratioTest = function(received: number, argument: number, digits: number, closeZero: number, closeZeroDigits: number) {
    if (argument === 0 || Math.abs(argument) < closeZero) {
      expect(received).toBeCloseTo(argument, closeZeroDigits);
      return {
        message: () => 'toBeCloseTo ok',
        pass: true
      };
    } else {
      const ratioError = (argument - received)/ argument;
      if ( Math.abs(ratioError) > Math.pow(10, -1*digits) ) {
        return {
          message: () => `expect ratio error of  (a-b)/a `+argument+' to '+received+` < 10e-`+digits+' but was '+ratioError,
          pass: false,
        };
      }
      return {
        message: () => `expect ratio error of (a-b)/a `+argument+' to '+received+` > 10e-`+digits+' but was '+ratioError,
        pass: true,
      };
    }
};

expect.extend({
   toBeCloseToRatio(received: number, argument: number, digits: number, closeZero=1e-10, closeZeroDigits=7) {
     return ratioTest(received, argument, digits, closeZero, closeZeroDigits);
   },
   arrayToBeCloseToRatio(received: Array<number> | Int32Array | Float32Array | Float64Array,
      argument: Array<number> | Int32Array | Float32Array | Float64Array,
      digits: number,
      closeZero=1e-10,
      closeZeroDigits=7
    ) {
     if ( ! (isArrayOrTypedArray(received) && isArrayOrTypedArray(argument)) ) {
       return {
         message: () => `expect two arrays ${isArrayOrTypedArray(received)} ${isArrayOrTypedArray(argument)}`,
         pass: false,
       };
     }
     if (received.length !== argument.length) {
       return {
         message: () => 'expect arrays to be equal length: '+received.length+ "!=" +argument.length,
         pass: false,
       };
     }
     for(let i=0; i< received.length; i++) {
       const m = ratioTest(received[i], argument[i], digits, closeZero, closeZeroDigits);
       if ( ! m.pass) {
         return {
           message: () => '(index: '+i+'/'+received.length+') '+m.message(),
           pass: m.pass,
         };
       }
     }
     return {
       message: () => 'arrayToBeCloseToRatio pass',
       pass: true,
     };
   },
   arrayToBeCloseTo(received: Array<number> | Int32Array | Float32Array | Float64Array,
      argument: Array<number> | Int32Array | Float32Array | Float64Array,
      digits: number) {
    if ( ! (isArrayOrTypedArray(received) && isArrayOrTypedArray(argument)) ) {
       return {
         message: () => `expect two arrays ${isArrayOrTypedArray(received)} ${isArrayOrTypedArray(argument)}`,
         pass: false,
       };
     }
     if (received.length !== argument.length) {
       return {
         message: () => 'expect arrays to be equal length: '+received.length+ "!=" +argument.length,
         pass: false,
       };
     }
     for(let i=0; i< received.length; i++) {
       const diff = (argument[i] - received[i]);
       if ( Math.abs(diff) > Math.pow(10, -1*digits) ) {
         return {
           message: () => 'at index '+i+'/'+received.length+' expect '+argument[i]+' to be '+received[i]+` within 10e-`+digits+' but was '+diff,
           pass: false,
         };
       }
     }
     return {
       message: () => 'arrayToBeCloseToRatio pass',
       pass: true,
     };
   },
 });

declare global {
   namespace jest {
     interface Matchers<R> {
       toBeCloseToRatio(argument: number, digits: number, closeZero?: number, closeZeroDigits?: number): R;
       arrayToBeCloseTo(argument: Array<number> | Int32Array | Float32Array | Float64Array, digits: number): R;
       arrayToBeCloseToRatio(argument: Array<number> | Int32Array | Float32Array | Float64Array, digits: number, closeZero?: number, closeZeroDigits?: number): R;
     }
   }
}

function isArrayOrTypedArray(a: any) {
   if (Array.isArray(a)) {return true; }
   if (a instanceof Float32Array) { return true;}
   if (a instanceof Int32Array) { return true;}
   if (a instanceof Float64Array) { return true;}
   return false;
 }
