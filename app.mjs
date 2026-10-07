import { SAMPLE, checkPurchase, forecast, formatMoney, safeToSpend } from "./model.mjs";

const PAGES = new Set(["home", "money-map", "forecast", "afford", "feedback"]);
const FEEDBACK_IDS = ["feedback-clear", "feedback-confusing", "feedback-missing"];
const $ = (selector) => document.querySelector(selector);
const text = (selector, value) => { $(selector).textContent = value; };
let activeResult = null;

function currentPage() {
  const candidate = window.location.hash.slice(1);
  return PAGES.has(candidate) ? candidate : "home";
}

function navigate() {
  const page = currentPage();
  for (const section of document.querySelectorAll("[data-view]")) {
    section.hidden = section.dataset.view !== page;
  }
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (link.dataset.nav === page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.title = `${page === "home" ? "Home" : $("[data-view='" + page + "'] h1").textContent} · Flow fictional demo`;
  window.scrollTo({ top: 0, behavior: "auto" });
  $("#main").focus({ preventScroll: true });
}

function renderHome() {
  text("[data-safe-amount]", formatMoney(safeToSpend().amountCents));
}

function dateLabel(date) {
  if (date === SAMPLE.today) return "Oct 6";
  if (date === SAMPLE.safeThrough) return "Oct 15";
  return "Oct 16";
}

function addTimelineRow(list, row, isLow) {
  const item = document.createElement("li");
  if (row.kind === "scenario") item.classList.add("timeline-scenario");
  if (isLow) item.classList.add("timeline-low");

  const date = document.createElement("span");
  date.className = "timeline-date";
  date.textContent = dateLabel(row.date);

  const title = document.createElement("span");
  title.className = "timeline-title";
  const label = document.createElement("strong");
  label.textContent = row.label;
  title.append(label);
  const change = document.createElement("small");
  change.textContent = row.kind === "start"
    ? "Starting cash"
    : `${row.changeCents < 0 ? "−" : "+"}${formatMoney(Math.abs(row.changeCents))}`;
  title.append(change);

  const amount = document.createElement("span");
  amount.className = "timeline-amount";
  const balance = document.createElement("strong");
  balance.textContent = formatMoney(row.balanceCents);
  amount.append(balance);
  const caption = document.createElement("small");
  caption.textContent = "projected cash";
  amount.append(caption);

  item.append(date, title, amount);
  list.append(item);
}

function renderForecast() {
  const purchaseCents = activeResult?.purchase.cents ?? 0;
  const base = forecast();
  const result = forecast(purchaseCents);
  text("[data-forecast-low]", formatMoney(result.lowCents));

  const scenarioNote = $("[data-scenario-note]");
  scenarioNote.hidden = !activeResult;
  if (activeResult) {
    scenarioNote.textContent = `Showing the possible ${activeResult.purchase.label.toLowerCase()} purchase. Without it, the low point would be ${formatMoney(base.lowCents)}. This preview is not recorded.`;
  }

  const warning = $("[data-forecast-warning]");
  warning.hidden = !result.belowBuffer;
  if (result.belowBuffer) {
    warning.textContent = `Watch: projected cash falls ${formatMoney(SAMPLE.bufferCents - result.lowCents)} below the protected ${formatMoney(SAMPLE.bufferCents)} buffer on October 16, before expected pay.`;
  }

  const list = $("[data-forecast-list]");
  list.replaceChildren();
  for (const row of result.rows) {
    addTimelineRow(list, row, row.date === result.lowDate && row.balanceCents === result.lowCents);
  }
}

function renderPurchaseResult() {
  const card = $("#purchase-result");
  card.hidden = !activeResult;
  if (!activeResult) return;
  const result = activeResult;
  text("[data-result-headline]", result.fitsCurrentPlan ? "Fits your current plan" : "Doesn't fit your current plan");
  text(
    "[data-result-description]",
    result.fitsCurrentPlan
      ? `After this fictional purchase, ${formatMoney(result.afterCents)} remains through October 15.`
      : `This fictional purchase would exceed today's Safe-to-Spend by ${formatMoney(Math.max(0, -result.afterCents))}. Flow would ask you to review what needs to change.`,
  );
  text("[data-result-before]", formatMoney(result.beforeCents));
  text("[data-result-after]", formatMoney(result.afterCents));
  text("[data-result-low]", formatMoney(result.scenarioLowCents));

  const warning = $("[data-result-warning]");
  warning.hidden = !result.belowBuffer;
  if (result.belowBuffer) {
    warning.textContent = `Watch the later forecast: its low point is ${formatMoney(result.scenarioLowCents)} on October 16, below your ${formatMoney(SAMPLE.bufferCents)} buffer.`;
  }

  const credit = $("[data-credit-message]");
  credit.hidden = result.payment !== "credit";
  if (result.payment === "credit") {
    credit.textContent = `The fictional card has ${formatMoney(result.creditAvailableCents)} of credit available. Flow does not treat that borrowing capacity as spendable cash. This short demo reserves the same purchase amount from today's plan either way.`;
  }
}

function feedbackValues() {
  return FEEDBACK_IDS.map((id) => $("#" + id).value.trim());
}

function feedbackText(values) {
  return [
    "Flow fictional demo feedback",
    "",
    `What felt clear or useful?\n${values[0] || "(no answer)"}`,
    `What was confusing or made you pause?\n${values[1] || "(no answer)"}`,
    `What did you expect to do but could not?\n${values[2] || "(no answer)"}`,
  ].join("\n\n");
}

$("#purchase-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  activeResult = checkPurchase(data.get("purchase"), data.get("payment"));
  renderPurchaseResult();
  renderForecast();
  $("#purchase-result").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#purchase-form").addEventListener("change", () => {
  activeResult = null;
  renderPurchaseResult();
  renderForecast();
});

$("#reset-demo").addEventListener("click", () => {
  if (!window.confirm("Reset this fictional demo? This clears the purchase preview and any feedback typed on this page.")) return;
  activeResult = null;
  $("#purchase-form").reset();
  for (const id of FEEDBACK_IDS) $("#" + id).value = "";
  $("#feedback-status").textContent = "";
  $("#feedback-fallback").hidden = true;
  renderPurchaseResult();
  renderForecast();
  if (currentPage() === "home") navigate();
  else window.location.hash = "#home";
});

$("#copy-feedback").addEventListener("click", async () => {
  const values = feedbackValues();
  const status = $("#feedback-status");
  if (values.every((value) => !value)) {
    status.textContent = "Write at least one answer before copying.";
    return;
  }
  const message = feedbackText(values);
  try {
    await navigator.clipboard.writeText(message);
    status.textContent = "Copied. You can now paste this into a message to the person who shared the demo.";
    $("#feedback-fallback").hidden = true;
  } catch {
    const fallback = $("#feedback-fallback");
    fallback.hidden = false;
    $("#feedback-copy-box").value = message;
    $("#feedback-copy-box").focus();
    $("#feedback-copy-box").select();
    status.textContent = "Automatic copying was unavailable. Select and copy the text below.";
  }
});

window.addEventListener("hashchange", navigate);
renderHome();
renderForecast();
navigate();
