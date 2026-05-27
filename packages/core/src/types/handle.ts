/**
 * Handle: a person, identified across multiple addresses.
 *
 * marquis@cleverer.tech, marquis@ted.com, marquis@gmail.com all map
 * to one Handle. The user corresponds with Handles; the addresses are
 * routing details.
 */

import type { EmailAddress, HandleId } from './common.ts'

export interface Handle {
  readonly id: HandleId
  readonly displayName: string
  readonly addresses: readonly EmailAddress[]
  readonly threadCount: number
  readonly lastContactedAt?: Date
  readonly avatarUrl?: string
  readonly notes?: string
}
