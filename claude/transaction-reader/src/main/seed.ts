import type { TransactionRecord } from '../shared/types'

/**
 * Demo records persisted on first run (when no master.json exists yet) so the
 * override visualization in the grid has something concrete to show. Each
 * record is dated about five years in the past so it sorts well below any
 * real imported data, and every record is marked ignored so it never appears
 * as actual spending.
 *
 * Each record exercises a different override pattern: single string field,
 * multi-field, numeric, and a previously-empty field gaining a value.
 */
export function makeSeedRecords(): TransactionRecord[] {
  return [
    {
      key:
        '5/15/2021\tStarbucks\tCoffee\tChase Card (...1234)\tSTARBUCKS #5678\t\t-5.42\t\tShared',
      original: {
        date: '2021-05-15',
        merchant: 'Starbucks',
        category: 'Coffee',
        account: 'Chase Card (...1234)',
        originalStatement: 'STARBUCKS #5678',
        notes: '',
        amount: -5.42,
        tags: '',
        owner: 'Shared',
      },
      overrides: {
        category: 'Restaurants & Bars',
      },
      ignored: true,
    },
    {
      key:
        '5/16/2021\tShell\tGas\tChase Card (...1234)\tSHELL OIL 23\t\t-42.10\t\tShared',
      original: {
        date: '2021-05-16',
        merchant: 'Shell',
        category: 'Gas',
        account: 'Chase Card (...1234)',
        originalStatement: 'SHELL OIL 23',
        notes: '',
        amount: -42.10,
        tags: '',
        owner: 'Shared',
      },
      overrides: {
        merchant: 'Shell Service Station',
      },
      ignored: true,
    },
    {
      key:
        '5/18/2021\tNA\t\tAmazon\tAcme Wireless Mouse, 2-pack\t\t-27.99\t\t',
      original: {
        date: '2021-05-18',
        merchant: 'NA',
        category: '',
        account: 'Amazon',
        originalStatement: 'Acme Wireless Mouse, 2-pack',
        notes: '',
        amount: -27.99,
        tags: '',
        owner: '',
      },
      overrides: {
        merchant: 'Amazon',
        category: 'Shopping',
      },
      ignored: true,
    },
    {
      key:
        '5/20/2021\tEmployer Co\tPaychecks\tEric Checking (...0539)\tPAYROLL DEPOSIT\t\t3500\t\tShared',
      original: {
        date: '2021-05-20',
        merchant: 'Employer Co',
        category: 'Paychecks',
        account: 'Eric Checking (...0539)',
        originalStatement: 'PAYROLL DEPOSIT',
        notes: '',
        amount: 3500,
        tags: '',
        owner: 'Shared',
      },
      overrides: {
        amount: 3450,
      },
      ignored: true,
    },
    {
      key:
        '5/22/2021\tLocal Bistro\tRestaurants & Bars\tChase Card (...1234)\tLOCAL BISTRO\t\t-78.30\t\tShared',
      original: {
        date: '2021-05-22',
        merchant: 'Local Bistro',
        category: 'Restaurants & Bars',
        account: 'Chase Card (...1234)',
        originalStatement: 'LOCAL BISTRO',
        notes: '',
        amount: -78.30,
        tags: '',
        owner: 'Shared',
      },
      overrides: {
        notes: 'Birthday dinner with family',
      },
      ignored: true,
    },
  ]
}
