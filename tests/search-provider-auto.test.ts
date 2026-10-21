import assert from "node:assert/strict";
import test from "node:test";
import { getSearchProviderChain, getSearchProvider, getExaSearchProvider } from "../lib/search-provider.ts";

function setEnv(overrides: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test("R-8 provider configuration: supports STRYDE_SEARCH_PROVIDER=auto per .env.example contract", () => {
  const restore = setEnv({
    EXA_API_KEY: "mock-exa-key",
    FIRECRAWL_API_KEY: "mock-firecrawl-key",
    STRYDE_SEARCH_PROVIDER: "auto",
  });

  try {
    const chain = getSearchProviderChain();
    assert.deepEqual(chain.map((p) => p.name), ["exa", "firecrawl"]);

    const primary = getSearchProvider();
    assert.equal(primary.name, "exa");

    const exa = getExaSearchProvider();
    assert.equal(exa.name, "exa");
  } finally {
    restore();
  }
});

test("R-8 provider configuration: auto falls back to firecrawl when only FIRECRAWL_API_KEY is configured", () => {
  const restore = setEnv({
    EXA_API_KEY: undefined,
    FIRECRAWL_API_KEY: "mock-firecrawl-key",
    STRYDE_SEARCH_PROVIDER: "auto",
  });

  try {
    const chain = getSearchProviderChain();
    assert.deepEqual(chain.map((p) => p.name), ["firecrawl"]);

    const primary = getSearchProvider();
    assert.equal(primary.name, "firecrawl");
  } finally {
    restore();
  }
});

test("R-8 provider configuration: rejects unsupported search providers cleanly", () => {
  const restore = setEnv({
    STRYDE_SEARCH_PROVIDER: "google_custom_search",
  });

  try {
    assert.throws(() => getSearchProviderChain(), /Unsupported STRYDE_SEARCH_PROVIDER: google_custom_search/);
    assert.throws(() => getExaSearchProvider(), /Unsupported STRYDE_SEARCH_PROVIDER: google_custom_search/);
  } finally {
    restore();
  }
});
