// flow-typed signature: 6551886e1a0321e01539298fc25f1f72
// flow-typed version: <<STUB>>/pikaday_v^1.8.0/flow_v0.132.0

/**
 * This is an autogenerated libdef stub for:
 *
 *   'pikaday'
 *
 * Fill this stub out by replacing all the `any` types.
 *
 * Once filled out, we encourage you to share your work with the
 * community by sending a pull request to:
 * https://github.com/flowtype/flow-typed
 */

declare module 'pikaday' {
  import type momemt$Moment from "moment";
  declare class Pikaday {
    constructor( { field: any, format: string, onSelect: () => void } ): Pikaday;
    isVisible(): boolean;
    hide(): void;
    setMoment(m: momemt$Moment): void;
  }
  declare export default typeof Pikaday;
  //declare module.exports: any;
}
