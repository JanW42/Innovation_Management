import test from 'node:test';
import assert from 'node:assert/strict';
import { detectContracts, monthlyCostMinor, normalizeName, type TxLike } from '../lib/contracts.ts';

function tx(partial: Partial<TxLike> & { id: string; booking_date: string; amount_minor: number; counterparty: string }): TxLike {
  return { bank_account_id: 'acc1', ...partial } as TxLike;
}

test('monatliche Abbuchungen werden als Vertrag erkannt', () => {
  const txs = [
    tx({ id: '1', booking_date: '2026-01-05', amount_minor: -2490, counterparty: 'DAK Gesundheit', creditor_id: 'DE74123' }),
    tx({ id: '2', booking_date: '2026-02-05', amount_minor: -2490, counterparty: 'DAK Gesundheit', creditor_id: 'DE74123' }),
    tx({ id: '3', booking_date: '2026-03-06', amount_minor: -2490, counterparty: 'DAK Gesundheit', creditor_id: 'DE74123' })
  ];
  const found = detectContracts(txs);
  assert.equal(found.length, 1);
  assert.equal(found[0].interval, 'monthly');
  assert.equal(found[0].expectedAmountMinor, 2490);
  assert.equal(found[0].monthlyCostMinor, 2490);
  assert.equal(found[0].transactionIds.length, 3);
});

test('jährliche Zahlungen werden mit reduziertem Score vorgeschlagen', () => {
  const txs = [
    tx({ id: '1', booking_date: '2025-03-10', amount_minor: -6000, counterparty: 'ACME Versicherung' }),
    tx({ id: '2', booking_date: '2026-03-12', amount_minor: -6000, counterparty: 'ACME Versicherung' })
  ];
  const found = detectContracts(txs);
  assert.equal(found.length, 1);
  assert.equal(found[0].interval, 'annual');
  assert.equal(found[0].monthlyCostMinor, 500);
});

test('einmalige Zahlungen werden nicht vorgeschlagen', () => {
  const txs = [tx({ id: '1', booking_date: '2026-01-05', amount_minor: -2490, counterparty: 'Einmaler' })];
  assert.equal(detectContracts(txs).length, 0);
});

test('Gutschriften werden ignoriert', () => {
  const txs = [
    tx({ id: '1', booking_date: '2026-01-05', amount_minor: 5000, counterparty: 'Arbeitgeber' }),
    tx({ id: '2', booking_date: '2026-02-05', amount_minor: 5000, counterparty: 'Arbeitgeber' }),
    tx({ id: '3', booking_date: '2026-03-05', amount_minor: 5000, counterparty: 'Arbeitgeber' })
  ];
  assert.equal(detectContracts(txs).length, 0);
});

test('verschiedene Anbieter werden getrennt', () => {
  const txs = [
    tx({ id: '1', booking_date: '2026-01-05', amount_minor: -1000, counterparty: 'Anbieter A' }),
    tx({ id: '2', booking_date: '2026-02-05', amount_minor: -1000, counterparty: 'Anbieter A' }),
    tx({ id: '3', booking_date: '2026-01-05', amount_minor: -2000, counterparty: 'Anbieter B' }),
    tx({ id: '4', booking_date: '2026-02-05', amount_minor: -2000, counterparty: 'Anbieter B' })
  ];
  const found = detectContracts(txs);
  assert.equal(found.length, 2);
});

test('Name-Normalisierung vereinheitlicht Schreibweisen', () => {
  assert.equal(normalizeName('DAK  GE-sundheit'), normalizeName('DAK Gesundheit'));
});

test('Monatskosten bei vierteljährlich', () => {
  assert.equal(monthlyCostMinor(3000, 'quarterly'), 1000);
  assert.equal(monthlyCostMinor(6000, 'semiannual'), 1000);
});

