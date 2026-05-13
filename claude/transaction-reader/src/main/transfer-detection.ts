import type { TransactionRecord } from '../shared/types'
import { effectiveValue } from '../shared/records'

const DEFAULT_WINDOW_DAYS = 3
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface TransferPair {
  fresh: TransactionRecord
  partner: TransactionRecord
}

export interface DetectTransfersResult {
  fresh: TransactionRecord[]
  pairs: TransferPair[]
}

export interface DetectTransfersOptions {
  /** How many days apart the two legs of a transfer may be. Defaults to 3. */
  windowDays?: number
}

/**
 * Flag freshly-imported transfer pairs as ignored.
 *
 * A "transfer" is a record that pairs with another record where the effective
 * amounts are equal in magnitude and opposite in sign, the effective accounts
 * differ, and the effective dates fall within `windowDays` of each other.
 *
 * Candidates include both other fresh records and existing master records.
 * When a fresh record pairs with an existing one, only the fresh side is
 * marked ignored — the existing record is not modified (transfer detection
 * is a one-shot pass over freshly-imported data).
 *
 * Pairing is greedy and 1-to-1: once a record (fresh or existing) is the
 * partner of one pair it can't be the partner of another.
 *
 * The input arrays and their record objects are not mutated. A new array of
 * fresh records is returned with the relevant `ignored` flags flipped.
 */
export function detectTransfers(
  fresh: readonly TransactionRecord[],
  existing: readonly TransactionRecord[],
  options: DetectTransfersOptions = {},
): DetectTransfersResult {
  const windowMs = (options.windowDays ?? DEFAULT_WINDOW_DAYS) * MS_PER_DAY

  const freshOut = fresh.map((r) => ({ ...r }))
  const freshSet = new Set(freshOut)
  const candidates: TransactionRecord[] = [...freshOut, ...existing]
  const claimed = new Set<TransactionRecord>()
  const pairs: TransferPair[] = []

  for (const fr of freshOut) {
    if (claimed.has(fr)) continue
    const partner = findPartner(fr, candidates, claimed, windowMs)
    if (partner !== null) {
      fr.ignored = true
      if (freshSet.has(partner)) {
        partner.ignored = true
      }
      claimed.add(fr)
      claimed.add(partner)
      pairs.push({ fresh: fr, partner })
    }
  }

  return { fresh: freshOut, pairs }
}

function findPartner(
  record: TransactionRecord,
  candidates: readonly TransactionRecord[],
  claimed: ReadonlySet<TransactionRecord>,
  windowMs: number,
): TransactionRecord | null {
  const amount = effectiveValue(record, 'amount')
  const account = effectiveValue(record, 'account')
  const dateMs = Date.parse(effectiveValue(record, 'date'))

  for (const c of candidates) {
    if (c === record) continue
    if (claimed.has(c)) continue
    if (effectiveValue(c, 'amount') !== -amount) continue
    if (effectiveValue(c, 'account') === account) continue
    const cMs = Date.parse(effectiveValue(c, 'date'))
    if (Math.abs(cMs - dateMs) > windowMs) continue
    return c
  }
  return null
}
