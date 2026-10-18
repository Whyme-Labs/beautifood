/** A catalog's shape with every string literal widened, so a translation must match keys, not text. */
export type Widen<T> = T extends string ? string : { -readonly [K in keyof T]: Widen<T[K]> };
