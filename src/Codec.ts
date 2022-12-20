/**
 * @since 1.0.0
 */

import type { Left, Right } from "@fp-ts/data/Either"
import * as E from "@fp-ts/data/Either"
import { identity, pipe } from "@fp-ts/data/Function"
import type { Json } from "@fp-ts/data/Json"
import { parse, stringify } from "@fp-ts/data/Json"
import type { Option } from "@fp-ts/data/Option"
import type { NonEmptyReadonlyArray } from "@fp-ts/data/ReadonlyArray"
import type { Both, These } from "@fp-ts/data/These"
import type { Arbitrary } from "@fp-ts/schema/Arbitrary"
import { arbitraryFor } from "@fp-ts/schema/Arbitrary"
import type { Literal } from "@fp-ts/schema/AST"
import type { DecodeError } from "@fp-ts/schema/DecodeError"
import type { Decoder } from "@fp-ts/schema/Decoder"
import { decoderFor } from "@fp-ts/schema/Decoder"
import type { Encoder } from "@fp-ts/schema/Encoder"
import { encoderFor } from "@fp-ts/schema/Encoder"
import type { Guard } from "@fp-ts/schema/Guard"
import { guardFor } from "@fp-ts/schema/Guard"
import * as I from "@fp-ts/schema/internal/common"
import type { Pretty } from "@fp-ts/schema/Pretty"
import * as P from "@fp-ts/schema/Pretty"
import type { Provider } from "@fp-ts/schema/Provider"
import { empty } from "@fp-ts/schema/Provider"
import type { Schema } from "@fp-ts/schema/Schema"
import * as S from "@fp-ts/schema/Schema"

/**
 * @since 1.0.0
 */
export interface Codec<A>
  extends Schema<A>, Decoder<unknown, A>, Encoder<unknown, A>, Guard<A>, Arbitrary<A>, Pretty<A>
{
  readonly parseOrThrow: (
    text: string,
    format?: (errors: NonEmptyReadonlyArray<DecodeError>) => string
  ) => A
  readonly stringify: (value: A) => string
  readonly of: (value: A) => A
}

/**
 * @since 1.0.0
 */
export type Infer<S extends Schema<any>> = Parameters<S["A"]>[0]

// ---------------------------------------------
// constructors
// ---------------------------------------------

/**
 * @since 1.0.0
 */
export const make = <A>(
  schema: Schema<A>,
  decode: Decoder<unknown, A>["decode"],
  encode: Encoder<unknown, A>["encode"],
  is: Guard<A>["is"],
  arbitrary: Arbitrary<A>["arbitrary"],
  pretty: Pretty<A>["pretty"]
): Codec<A> =>
  ({
    ast: schema.ast,
    decode,
    encode,
    is,
    arbitrary,
    pretty,
    parseOrThrow: (
      text: string,
      format?: (errors: NonEmptyReadonlyArray<DecodeError>) => string
    ) => {
      const json = parse(text)
      if (E.isLeft(json)) {
        throw new Error(`Cannot parse JSON from: ${text}`)
      }
      const result = decode(json.right)
      if (!I.isFailure(result)) {
        return result.right
      }
      const message = `Cannot decode JSON` +
        (format ? `, errors: ${format(result.left)}` : ``)
      throw new Error(message)
    },
    stringify: (value: A) => {
      const json = stringify(encode(value))
      if (E.isLeft(json)) {
        throw new Error(`Cannot encode JSON, error: ${String(json.left)}`)
      }
      return json.right
    },
    of: identity
  }) as any

/**
 * @since 1.0.0
 */
export const success: <A>(a: A) => These<never, A> = I.success

/**
 * @since 1.0.0
 */
export const failure: (
  e: DecodeError
) => These<NonEmptyReadonlyArray<DecodeError>, never> = I.failure

/**
 * @since 1.0.0
 */
export const failures: (
  es: NonEmptyReadonlyArray<DecodeError>
) => These<NonEmptyReadonlyArray<DecodeError>, never> = I.failures

/**
 * @since 1.0.0
 */
export const warning: <A>(
  e: DecodeError,
  a: A
) => These<NonEmptyReadonlyArray<DecodeError>, A> = I.warning

/**
 * @since 1.0.0
 */
export const warnings: <A>(
  es: NonEmptyReadonlyArray<DecodeError>,
  a: A
) => These<NonEmptyReadonlyArray<DecodeError>, A> = I.warnings

/**
 * @since 1.0.0
 */
export const isSuccess: <E, A>(self: These<E, A>) => self is Right<A> = I.isSuccess

/**
 * @since 1.0.0
 */
export const isFailure: <E, A>(self: These<E, A>) => self is Left<E> = I.isFailure

/**
 * @since 1.0.0
 */
export const isWarning: <E, A>(self: These<E, A>) => self is Both<E, A> = I.isWarning

/**
 * @since 1.0.0
 */
export const provideCodecFor = (provider: Provider) => {
  const prettyFor = P.providePrettyFor(provider)
  return <A>(schema: Schema<A>): Codec<A> =>
    make(
      schema,
      decoderFor(schema).decode,
      encoderFor(schema).encode,
      guardFor(schema).is,
      arbitraryFor(schema).arbitrary,
      prettyFor(schema).pretty
    )
}

/**
 * @since 1.0.0
 */
export const codecFor: <A>(schema: Schema<A>) => Codec<A> = provideCodecFor(empty())

/**
 * @since 1.0.0
 */
export const literal = <A extends ReadonlyArray<Literal>>(
  ...a: A
): Codec<A[number]> => codecFor(S.literal(...a))

/**
 * @since 1.0.0
 */
export const uniqueSymbol = <S extends symbol>(symbol: S): Codec<S> =>
  codecFor(S.uniqueSymbol(symbol))

/**
 * @since 1.0.0
 */
export const enums = <A extends { [x: string]: string | number }>(
  nativeEnum: A
): Codec<A[keyof A]> => codecFor(S.enums(nativeEnum))

// ---------------------------------------------
// filters
// ---------------------------------------------

/**
 * @since 1.0.0
 */
export const minLength = (minLength: number) =>
  <A extends { length: number }>(self: Schema<A>): Codec<A> =>
    codecFor(S.minLength(minLength)(self))

/**
 * @since 1.0.0
 */
export const maxLength = (maxLength: number) =>
  <A extends { length: number }>(self: Schema<A>): Codec<A> =>
    codecFor(S.maxLength(maxLength)(self))

/**
 * @since 1.0.0
 */
export const lessThan = (min: number) =>
  <A extends number>(self: Schema<A>): Codec<A> => codecFor(S.lessThan(min)(self))

/**
 * @since 1.0.0
 */
export const lessThanOrEqualTo = (min: number) =>
  <A extends number>(self: Schema<A>): Codec<A> => codecFor(S.lessThanOrEqualTo(min)(self))

/**
 * @since 1.0.0
 */
export const greaterThan = (max: number) =>
  <A extends number>(self: Schema<A>): Codec<A> => codecFor(S.greaterThan(max)(self))

/**
 * @since 1.0.0
 */
export const greaterThanOrEqualTo = (max: number) =>
  <A extends number>(self: Schema<A>): Codec<A> => codecFor(S.greaterThanOrEqualTo(max)(self))

/**
 * @since 1.0.0
 */
export const int = <A extends number>(self: Schema<A>): Codec<A> => codecFor(S.int(self))

// ---------------------------------------------
// combinators
// ---------------------------------------------

/**
 * @since 1.0.0
 */
export const union = <Members extends ReadonlyArray<Schema<any>>>(
  ...members: Members
): Codec<Infer<Members[number]>> => codecFor(S.union(...members))

/**
 * @since 1.0.0
 */
export const keyof = <A>(schema: Schema<A>): Codec<keyof A> => codecFor(S.keyof(schema))

/**
 * @since 1.0.0
 */
export const tuple = <Elements extends ReadonlyArray<Schema<any>>>(
  ...elements: Elements
): Codec<{ readonly [K in keyof Elements]: Infer<Elements[K]> }> =>
  codecFor(S.tuple<Elements>(...elements))

/**
 * @since 1.0.0
 */
export const rest = <R>(rest: Schema<R>) =>
  <A extends ReadonlyArray<any>>(self: Schema<A>): Codec<readonly [...A, ...Array<R>]> =>
    codecFor(S.rest(rest)(self))

/**
 * @since 1.0.0
 */
export const element = <E>(element: Schema<E>) =>
  <A extends ReadonlyArray<any>>(self: Schema<A>): Codec<readonly [...A, E]> =>
    codecFor(S.element(element)(self))

/**
 * @since 1.0.0
 */
export const optionalElement = <E>(element: Schema<E>) =>
  <A extends ReadonlyArray<any>>(self: Schema<A>): Codec<readonly [...A, E?]> =>
    codecFor(S.optionalElement(element)(self))

/**
 * @since 1.0.0
 */
export const array = <A>(item: Schema<A>): Codec<ReadonlyArray<A>> => codecFor(S.array(item))

/**
 * @since 1.0.0
 */
export const nonEmptyArray = <A>(
  item: Schema<A>
): Codec<readonly [A, ...Array<A>]> => codecFor(S.nonEmptyArray(item))

/**
 * @since 1.0.0
 */
export const optional: <A>(schema: Schema<A>) => S.FieldSchema<A, true> = I.optional

/**
 * @since 1.0.0
 */
export const struct = <Fields extends Record<PropertyKey, Schema<any>>>(
  fields: Fields
): Codec<
  S.Spread<
    & { readonly [K in Exclude<keyof Fields, S.OptionalKeys<Fields>>]: Infer<Fields[K]> }
    & { readonly [K in S.OptionalKeys<Fields>]?: Infer<Fields[K]> }
  >
> => codecFor(S.struct(fields))

/**
 * @since 1.0.0
 */
export const pick = <A, Keys extends ReadonlyArray<keyof A>>(...keys: Keys) =>
  (self: Schema<A>): Codec<{ readonly [P in Keys[number]]: A[P] }> =>
    codecFor(pipe(self, S.pick(...keys)))

/**
 * @since 1.0.0
 */
export const omit = <A, Keys extends ReadonlyArray<keyof A>>(...keys: Keys) =>
  (self: Schema<A>): Codec<{ readonly [P in Exclude<keyof A, Keys[number]>]: A[P] }> =>
    codecFor(pipe(self, S.omit(...keys)))

/**
 * @since 1.0.0
 */
export const partial = <A>(self: Schema<A>): Codec<Partial<A>> => codecFor(S.partial(self))

/**
 * @since 1.0.0
 */
export const stringIndexSignature = <A>(value: Schema<A>): Codec<{ readonly [x: string]: A }> =>
  codecFor(S.symbolIndexSignature(value))

/**
 * @since 1.0.0
 */
export const symbolIndexSignature = <A>(value: Schema<A>): Codec<{ readonly [x: symbol]: A }> =>
  codecFor(S.symbolIndexSignature(value))

/**
 * @since 1.0.0
 */
export const extend = <B>(
  that: Schema<B>
) => <A>(self: Schema<A>): Codec<A & B> => codecFor(S.extend(that)(self))

/**
 * @since 1.0.0
 */
export const lazy = <A>(f: () => Schema<A>): Codec<A> => codecFor(S.lazy(f))

/**
 * @since 1.0.0
 */
export const filter = <A>(
  id: unknown,
  decode: Decoder<A, A>["decode"]
) => (schema: Schema<A>): Codec<A> => codecFor(S.filter(id, decode)(schema))

/**
 * @since 1.0.0
 */
export const filterWith = <Config, A>(
  id: unknown,
  decode: (config: Config) => Decoder<A, A>["decode"]
) =>
  (config: Config) =>
    (schema: Schema<A>): Codec<A> => codecFor(S.filterWith(id, decode)(config)(schema))

/**
 * @since 1.0.0
 */
export const refine = <A, B extends A>(
  id: unknown,
  decode: Decoder<A, B>["decode"]
) => (schema: Schema<A>): Codec<B> => codecFor(S.refine(id, decode)(schema))

// ---------------------------------------------
// data
// ---------------------------------------------

const _undefined: Codec<undefined> = codecFor(S.undefined)

const _void: Codec<void> = codecFor(S.void)

export {
  /**
   * @since 1.0.0
   */
  _undefined as undefined,
  /**
   * @since 1.0.0
   */
  _void as void
}

/**
 * @since 1.0.0
 */
export const string: Codec<string> = codecFor(S.string)

/**
 * @since 1.0.0
 */
export const number: Codec<number> = codecFor(S.number)

/**
 * @since 1.0.0
 */
export const boolean: Codec<boolean> = codecFor(S.boolean)

/**
 * @since 1.0.0
 */
export const bigint: Codec<bigint> = codecFor(S.bigint)

/**
 * @since 1.0.0
 */
export const symbol: Codec<symbol> = codecFor(S.symbol)

/**
 * @since 1.0.0
 */
export const unknown: Codec<unknown> = codecFor(S.unknown)

/**
 * @since 1.0.0
 */
export const any: Codec<any> = codecFor(S.any)

/**
 * @since 1.0.0
 */
export const never: Codec<never> = codecFor(S.never)

/**
 * @since 1.0.0
 */
export const json: Codec<Json> = codecFor(S.json)

/**
 * @since 1.0.0
 */
export const option = <A>(value: Schema<A>): Codec<Option<A>> => codecFor(S.option(value))
