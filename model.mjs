/**
 * A deliberately small, browser-only model for the fictional usability demo.
 * It mirrors the documented 1h and 8d sample outcomes, not the full Flow
 * calculation engine. All amounts are integer USD cents.
 */
export const SAMPLE = Object.freeze({
  today: "2026-10-06",
  safeThrough: "2026-10-15",
  forecastThrough: "2026-10-16",
  currency: "USD",
  cashCents: 250_000,
  rentCents: 120_000,
  currentGroceriesCents: 12_000,
  nextGroceriesCents: 15_000,
  bufferCents: 100_000,
  expectedPayCents: 215_000,
  creditAvailableCents: 50_000,
});

export const PURCHASES = Object.freeze([
  { id: "coffee", label: "Coffee with a friend", cents: 5_000 },
  { id: "shoes", label: "A pair of shoes", cents: 12_000 },
  { id: "repair", label: "A repair", cents: 25_000 },
]);

export function formatMoney(cents) {
  if (!Number.isSafeInteger(cents)) throw new TypeError("Amount must be an integer number of cents.");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: SAMPLE.currency }).format(cents / 100);
}

export function safeToSpend() {
  const reservedCents = SAMPLE.rentCents + SAMPLE.currentGroceriesCents + SAMPLE.bufferCents;
  return {
    cashCents: SAMPLE.cashCents,
    reservedCents,
    amountCents: SAMPLE.cashCents - reservedCents,
    through: SAMPLE.safeThrough,
  };
}

/** Outflows precede expected income on the same date, as in Flow's forecast. */
export function forecast(purchaseCents = 0) {
  if (!Number.isSafeInteger(purchaseCents) || purchaseCents < 0) {
    throw new RangeError("Purchase must be a nonnegative integer number of cents.");
  }

  const rows = [
    { date: SAMPLE.today, label: "Checking balance", kind: "start", changeCents: SAMPLE.cashCents, balanceCents: SAMPLE.cashCents },
    { date: SAMPLE.today, label: "Groceries reserved in the accepted plan", kind: "out", changeCents: -SAMPLE.currentGroceriesCents, balanceCents: 0 },
  ];
  if (purchaseCents > 0) {
    rows.push({ date: SAMPLE.today, label: "Possible purchase · scenario only", kind: "scenario", changeCents: -purchaseCents, balanceCents: 0 });
  }
  rows.push(
    { date: SAMPLE.safeThrough, label: "Rent due", kind: "out", changeCents: -SAMPLE.rentCents, balanceCents: 0 },
    { date: SAMPLE.forecastThrough, label: "Next period groceries · planned", kind: "out", changeCents: -SAMPLE.nextGroceriesCents, balanceCents: 0 },
    { date: SAMPLE.forecastThrough, label: "Expected pay · forecast only", kind: "income", changeCents: SAMPLE.expectedPayCents, balanceCents: 0 },
  );

  let runningCents = 0;
  let lowCents = Number.POSITIVE_INFINITY;
  let lowDate = SAMPLE.today;
  for (const row of rows) {
    runningCents += row.changeCents;
    row.balanceCents = runningCents;
    if (runningCents < lowCents) {
      lowCents = runningCents;
      lowDate = row.date;
    }
  }
  return { rows, lowCents, lowDate, belowBuffer: lowCents < SAMPLE.bufferCents };
}

/** This limited demo checks one cash-sized purchase today, even if credit is selected. */
export function checkPurchase(purchaseId, payment = "debit") {
  const purchase = PURCHASES.find((item) => item.id === purchaseId);
  if (!purchase) throw new RangeError("Unknown fictional purchase.");
  if (payment !== "debit" && payment !== "credit") throw new RangeError("Unknown payment method.");
  const current = safeToSpend();
  const afterCents = current.amountCents - purchase.cents;
  const baseForecast = forecast();
  const scenarioForecast = forecast(purchase.cents);
  return {
    purchase,
    payment,
    beforeCents: current.amountCents,
    afterCents,
    fitsCurrentPlan: afterCents >= 0 && scenarioForecast.lowCents >= 0,
    baseLowCents: baseForecast.lowCents,
    scenarioLowCents: scenarioForecast.lowCents,
    belowBuffer: scenarioForecast.belowBuffer,
    creditAvailableCents: payment === "credit" ? SAMPLE.creditAvailableCents : null,
  };
}
