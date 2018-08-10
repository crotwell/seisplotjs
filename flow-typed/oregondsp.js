
declare module "oregondsp" {
  declare export default type "com" = {
    declare type "oregondsp" = {
      declare type "signalProcessing" = {
        declare type "filter" = {
          declare type "iir" = {
            declare type "Complex" = {
              real: number;
              imag: number;
            };
            declare function Complex_init(real :number, imag :number) :Complex;
          }
        }
      }
    }
  }
}
