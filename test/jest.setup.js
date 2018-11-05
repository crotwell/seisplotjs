
require('jest-extended');

let ratioTest = function(received, argument, digits, closeZero, closeZeroDigits) {
    if (argument === 0 || Math.abs(argument) < closeZero) {
      expect(received).toBeCloseTo(argument, closeZeroDigits);
      return {
        message: () => 'toBeCloseTo ok',
        pass: true
      };
    } else {
      let ratioError = (argument - received)/ argument;
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
}

 expect.extend({
   toBeCloseToRatio(received, argument, digits, closeZero=1e-10, closeZeroDigits=7) {
     return ratioTest(received, argument, digits, closeZero, closeZeroDigits)
   },
   arrayToBeCloseToRatio(received, argument, digits, closeZero=1e-10, closeZeroDigits=7) {
     if ( ! (Array.isArray(received) && Array.isArray(argument)) ) {
       return {
         message: () => 'expect two arrays',
         pass: false,
       };
     }
     if (received.length != argument.length) {
       return {
         message: () => 'expect arrays to be equal length: '+received.length+ "!=" +argument.length,
         pass: false,
       };
     }
     for(let i=0; i< received.length; i++) {
       let m = ratioTest(received[i], argument[i], digits, closeZero, closeZeroDigits);
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
   arrayToBeCloseTo(received, argument, digits) {
     if ( ! (Array.isArray(received) && Array.isArray(argument)) ) {
       return {
         message: () => 'expect two arrays',
         pass: false,
       };
     }
     if (received.length != argument.length) {
       return {
         message: () => 'expect arrays to be equal length: '+received.length+ "!=" +argument.length,
         pass: false,
       };
     }
     for(let i=0; i< received.length; i++) {
       let diff = (argument[i] - received[i]);
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
