
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

    declare export function Complex_init(real :number, imag :number) :Complex;
}
