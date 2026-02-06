declare module 'five-bells-condition' {
  export class PreimageSha256 {
    constructor();
    setPreimage(preimage: Buffer): void;
    getConditionBinary(): Buffer;
    serializeBinary(): Buffer;
  }
  
  export function validateFulfillment(
    fulfillment: Buffer | string,
    condition: Buffer | string
  ): boolean;
}
