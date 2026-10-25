import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const artifactDir = "C:\\Users\\DELL\\.gemini\\antigravity\\brain\\8238d04f-93b4-4d35-a001-3e7c8e02e787";

if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

// Read .env.local for test user
const envPath = path.resolve(".env.local");
let env = {};
if (fs.existsSync(envPath)) {
  env = Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3155";
console.log(`[QA] Starting browser verification against ${BASE_URL} using Chrome: ${chromePath}`);

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ],
});

try {
  const page = await browser.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      console.log(`[QA HTTP ${res.status()}] ${res.url()}`);
    }
  });

  // 1. Desktop Landing Page (1440x900)
  console.log("\n--- Testing Desktop Landing Page (1440x900) ---");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 30000 });

  const desktopShotPath = path.join(artifactDir, "desktop-landing.png");
  await page.screenshot({ path: desktopShotPath, fullPage: true });
  console.log(`[QA] Saved desktop landing screenshot: ${desktopShotPath}`);

  // Check hydration & form
  const hasForm = await page.evaluate(() => !!document.querySelector("form"));
  console.log(`[QA] Form present on landing: ${hasForm}`);

  const landingText = await page.evaluate(() => document.body.innerText);
  const leakedOntology = /Research|Claim|Evidence|Observation/.test(landingText);
  console.log(`[QA] Internal ontology leaked on landing: ${leakedOntology}`);

  // Check horizontal overflow
  const desktopOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`[QA] Desktop horizontal scroll overflow: ${desktopOverflow}`);

  // 2. Mobile Landing Page (390x844)
  console.log("\n--- Testing Mobile Landing Page (390x844) ---");
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 30000 });

  const mobileShotPath = path.join(artifactDir, "mobile-landing.png");
  await page.screenshot({ path: mobileShotPath, fullPage: true });
  console.log(`[QA] Saved mobile landing screenshot: ${mobileShotPath}`);

  const mobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`[QA] Mobile horizontal scroll overflow: ${mobileOverflow}`);

  // 3. Sign In Flow
  console.log("\n--- Testing Authentication & Pursuit Dashboard ---");
  await page.setViewport({ width: 1440, height: 900, isMobile: false });
  await page.goto(BASE_URL, { waitUntil: "networkidle0", timeout: 30000 });

  const isSignInVisible = await page.evaluate(() => document.body.innerText.includes("Sign in"));
  if (isSignInVisible && env.STRYDE_TEST_USER_EMAIL && env.STRYDE_TEST_USER_PASSWORD) {
    console.log("[QA] Filling sign-in form...");
    // Use React-friendly property setters
    await page.evaluate((email, pass) => {
      const emailInput = document.querySelector('input[type="email"]');
      const passInput = document.querySelector('input[type="password"]');
      if (emailInput) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(emailInput, email);
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (passInput) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(passInput, pass);
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, env.STRYDE_TEST_USER_EMAIL, env.STRYDE_TEST_USER_PASSWORD);

    await page.evaluate(() => {
      const form = document.querySelector("form");
      if (form) form.requestSubmit();
    });

    console.log("[QA] Waiting for sign-in navigation...");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));
  }

  const authenticatedText = await page.evaluate(() => document.body.innerText);
  const isAuthenticated = !authenticatedText.includes("Sign in");
  console.log(`[QA] Authenticated: ${isAuthenticated}`);

  const dashboardShotPath = path.join(artifactDir, "desktop-dashboard.png");
  await page.screenshot({ path: dashboardShotPath, fullPage: true });
  console.log(`[QA] Saved dashboard screenshot: ${dashboardShotPath}`);

  // Find a pursuit button or link
  const pursuitButtons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    return btns
      .filter((b) => /COMPLETED|ACTIVE|DISCOVERING|IN_PROGRESS/i.test(b.innerText) || (b.getAttribute("href") && b.getAttribute("href").includes("/pursuits/")))
      .map((b) => ({ text: b.innerText.slice(0, 50), href: b.getAttribute("href") }));
  });
  console.log(`[QA] Found ${pursuitButtons.length} pursuit entries on dashboard`);

  if (pursuitButtons.length > 0) {
    console.log("\n--- Testing Pursuit Workspace Page ---");
    console.log("[QA] Clicking first pursuit button in divide-y container...");
    await page.evaluate(() => {
      const btn = document.querySelector(".divide-y button");
      if (btn) btn.click();
    });
    await page.waitForFunction(() => window.location.pathname.includes("/pursuits/"), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 4000));

    const pursuitUrl = page.url();
    console.log(`[QA] Navigated to pursuit: ${pursuitUrl}`);

    const pursuitShotPath = path.join(artifactDir, "desktop-pursuit.png");
    await page.screenshot({ path: pursuitShotPath, fullPage: true });
    console.log(`[QA] Saved desktop pursuit screenshot: ${pursuitShotPath}`);

    // Check desktop overflow on pursuit page
    const pursuitDesktopOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`[QA] Pursuit desktop horizontal scroll overflow: ${pursuitDesktopOverflow}`);

    // Test mobile pursuit
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await new Promise((r) => setTimeout(r, 2000));
    const mobilePursuitShotPath = path.join(artifactDir, "mobile-pursuit.png");
    await page.screenshot({ path: mobilePursuitShotPath, fullPage: true });
    console.log(`[QA] Saved mobile pursuit screenshot: ${mobilePursuitShotPath}`);

    const pursuitMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(`[QA] Pursuit mobile horizontal scroll overflow: ${pursuitMobileOverflow}`);

    // Check panels reachability and primary ontology leaks
    const panelCheck = await page.evaluate(() => {
      const pursuitContent = document.body.innerText;
      return {
        claims: /Evidence & claims|Claims/i.test(pursuitContent),
        memory: /What Stryde remembers|Memory/i.test(pursuitContent),
        artifacts: /Deliverables & artifacts|Artifacts/i.test(pursuitContent),
        autonomy: /What Stryde may do on its own|Autonomy/i.test(pursuitContent),
        composer: !!document.querySelector("textarea"),
      };
    });
    console.log("[QA] Contextual panels check:", panelCheck);
  }

  console.log("\n--- Browser Console & Error Summary ---");
  console.log(`[QA] Page errors count: ${pageErrors.length}`);
  if (pageErrors.length > 0) {
    console.log("[QA] Page errors:", pageErrors);
  }
  const realErrors = consoleMessages.filter((m) => m.type === "error" && !m.text.includes("favicon"));
  console.log(`[QA] Console errors count: ${realErrors.length}`);
  if (realErrors.length > 0) {
    console.log("[QA] Console errors:", realErrors);
  }

  console.log("\n[QA] Browser verification complete!");
} finally {
  await browser.close();
}
