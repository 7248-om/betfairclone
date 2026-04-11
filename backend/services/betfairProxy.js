/**
 * @file services/betfairProxy.js
 * @description The ONLY authorized gateway for all Betfair API communication.
 *
 * ============================================================
 * ⚠️  CRITICAL ARCHITECTURE: ZERO-LEAK PROXY DESIGN ⚠️
 * ============================================================
 *
 * ALL requests to the Betfair API MUST be routed exclusively through this
 * module. This is non-negotiable. The reasons are:
 *
 *   1. UK LEGAL COMPLIANCE: Betfair's API is a UK-regulated service.
 *      All originating IP addresses must appear to come from within
 *      the United Kingdom. A UK residential or datacenter proxy
 *      (configured in the `UK_PROXY_URL` environment variable) is
 *      REQUIRED for this service to function.
 *
 *   2. SECRET PROTECTION: The Betfair `App Key` and `Session Token`
 *      (X-Authentication header) are server secrets. They must NEVER
 *      be exposed to the client (browser). This module is the single
 *      enforced point of contact, keeping credentials in process memory.
 *
 *   3. RATE LIMIT MANAGEMENT: Betfair enforces strict API rate limits.
 *      Centralizing all calls here makes it trivial to add request
 *      queuing and throttling (e.g., using a library like `bottleneck`)
 *      in one place.
 *
 *   4. CACHING: Raw Betfair responses are parsed and written to the
 *      local `Match` collection in MongoDB. The rest of the app reads
 *      from MongoDB — not from Betfair directly.
 *
 * ============================================================
 * HOW TO IMPLEMENT
 * ============================================================
 * Recommended HTTP client: `axios` with `axios-proxy-config` or `https-proxy-agent`.
 *
 * Example setup:
 * ```
 * const axios = require('axios');
 * const { HttpsProxyAgent } = require('https-proxy-agent');
 *
 * const proxyAgent = new HttpsProxyAgent(process.env.UK_PROXY_URL);
 *
 * const betfairClient = axios.create({
 *   baseURL: 'https://api.betfair.com/exchange/betting/json-rpc/v1',
 *   headers: {
 *     'X-Application': process.env.BETFAIR_APP_KEY,
 *     'X-Authentication': process.env.BETFAIR_SESSION_TOKEN,
 *     'Content-Type': 'application/json',
 *   },
 *   httpsAgent: proxyAgent,
 * });
 * ```
 *
 * ============================================================
 * FUNCTION STUBS (TO BE IMPLEMENTED)
 * ============================================================
 */

"use strict";

const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

/**
 * Fetches a list of live and upcoming events for a given sport from Betfair.
 * Should be called by a scheduled job (e.g., cron) every N minutes.
 * Results should be upserted into the local `Match` collection.
 *
 * @param {string} eventTypeId - The Betfair event type ID (e.g., "1" for Soccer).
 * @returns {Promise<Array>} - Array of raw Betfair event objects.
 */
const fetchLiveMatches = async (eventTypeId) => {
  // TODO: Implement using betfairClient above
  // Endpoint: listEvents + listMarketCatalogue
  throw new Error("betfairProxy.fetchLiveMatches() is not yet implemented.");
};

/**
 * Fetches current live odds (prices) for a specific Betfair market.
 * Used to keep the cached odds in the `Match.runners` array up to date.
 *
 * @param {string} marketId - The Betfair Market ID (e.g., "1.234567890").
 * @returns {Promise<Object>} - Raw Betfair market book data with prices.
 */
const fetchMarketOdds = async (marketId) => {
  try {
    const proxyUrl = process.env.UK_PROXY_URL;
    if (!proxyUrl) {
      console.error("[BetfairProxy] UK_PROXY_URL is missing. Aborting fetch to avoid IP exposure.");
      return null; // Fail-closed requirement
    }

    const proxyAgent = new HttpsProxyAgent(proxyUrl);

    const betfairClient = axios.create({
      baseURL: "https://api.betfair.com/exchange/betting/json-rpc/v1",
      headers: {
        "X-Application": process.env.BETFAIR_APP_KEY || "",
        "X-Authentication": process.env.BETFAIR_SESSION_TOKEN || "",
        "Content-Type": "application/json"
      },
      httpsAgent: proxyAgent,
      timeout: 5000 // Ensure we don't stall the poller indefinitely
    });

    const payload = {
      jsonrpc: "2.0",
      method: "SportsAPING/v1.0/listMarketBook",
      params: {
        marketIds: [marketId],
        priceProjection: {
          priceData: ["EX_BEST_OFFERS"],
          virtualise: true
        }
      },
      id: 1
    };

    const response = await betfairClient.post("", payload);

    if (response.data && response.data.error) {
      console.error("[BetfairProxy] API returned error:", response.data.error);
      return null;
    }

    return response.data.result;
  } catch (error) {
    console.error(`[BetfairProxy] Proxy connection failed or timed out for market ${marketId}. Error: ${error.message}`);
    // CRITICAL "FAIL-CLOSED" REQUIREMENT: NEVER attempt to retry with native IP address.
    return null;
  }
};

/**
 * Checks the settlement status of a market after an event has concluded.
 * Used by the settlement service to determine WON/LOST outcomes for open bets.
 *
 * @param {string} marketId - The Betfair Market ID to check.
 * @returns {Promise<Object>} - Settlement data including winner runner ID.
 */
const fetchMarketSettlement = async (marketId) => {
  // TODO: Implement using listSettledBets or listClearedOrders endpoint
  throw new Error(
    "betfairProxy.fetchMarketSettlement() is not yet implemented."
  );
};

module.exports = {
  fetchLiveMatches,
  fetchMarketOdds,
  fetchMarketSettlement,
};
