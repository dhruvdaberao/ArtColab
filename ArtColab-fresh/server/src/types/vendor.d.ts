declare module 'bcryptjs' {
  export function hash(data: string, saltOrRounds: number | string): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;

  const bcrypt: {
    hash: typeof hash;
    compare: typeof compare;
  };

  export default bcrypt;
}

declare module 'jsonwebtoken' {
  export type SignOptions = {
    expiresIn?: string | number;
  };

  export interface JwtLike {
    sign(payload: object | string, secretOrPrivateKey: string, options?: SignOptions): string;
    verify(token: string, secretOrPublicKey: string): unknown;
  }

  const jwt: JwtLike;

  export default jwt;
}
