// flow-typed signature: b3fda4e5560c49bb389bce8aef29c709
// flow-typed version: <<STUB>>/oregondsp_v^1.2.2/flow_v0.132.0

/* USC */
/**
 * Just export Complex as that seeems to be the one thing that flow complains
 * about for seisplotjs.
 * @type {[type]}
 */
 declare module "oregondsp/com/oregondsp/signalProcessing/filter/iir" {
     declare export class Complex {
       //real: number;
       //imag: number;
       constructor(real: number, imag: number): Complex;
       real(): number;
       imag(): number;
       abs(): number;
       angle(): number;
       times(c: Complex): Complex;
       plus(c: Complex): Complex;
       conjugate(): Complex;
       toString(): string;
     }
     declare export class IIRFilter {
       filterInPlace(a: Float32Array): void;
     }

     declare export function Complex_init(real :number, imag :number) :Complex;
 }
/**
 * This is an autogenerated libdef stub for:
 *
 *   'oregondsp'
 *
 * Fill this stub out by replacing all the `any` types.
 *
 * Once filled out, we encourage you to share your work with the
 * community by sending a pull request to:
 * https://github.com/flowtype/flow-typed
 */

declare module 'oregondsp' {
  declare module.exports: any;
}