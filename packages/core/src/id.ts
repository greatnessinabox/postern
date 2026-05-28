/**
 * Branded ID constructors.
 *
 * The one place where casting to a branded type is correct: there is no
 * other way to mint a branded primitive. Every ID is a prefixed UUID so
 * it sorts by type and reads clearly in logs.
 */

import type {
  AccountId,
  BoostId,
  CommandId,
  HandleId,
  MessageId,
  PartId,
  SpaceId,
  ThreadId,
} from './types/index.ts'

// Web Crypto is global in Node 22+, browsers, and React Native (with a
// polyfill). Declared locally so the shared lib stays free of DOM globals.
declare const crypto: { randomUUID(): string }

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export const newAccountId = (): AccountId => uid('acc') as AccountId
export const newHandleId = (): HandleId => uid('hdl') as HandleId
export const newSpaceId = (): SpaceId => uid('spc') as SpaceId
export const newThreadId = (): ThreadId => uid('thr') as ThreadId
export const newMessageId = (): MessageId => uid('msg') as MessageId
export const newPartId = (): PartId => uid('prt') as PartId
export const newBoostId = (): BoostId => uid('bst') as BoostId
export const newCommandId = (): CommandId => uid('cmd') as CommandId
