import type { BookmakerConfig } from "../types";

// Replace "YOUR_AFFILIATE_ID" values after signing up for each sportsbook's affiliate program.
// DraftKings: https://affiliates.draftkings.com
// FanDuel:    https://affiliates.fanduel.com
// BetMGM:     https://partners.betmgm.com
// Caesars:    https://affiliates.williamhill.com
// bet365:     https://affiliates.bet365.com

export const BOOKMAKERS: BookmakerConfig[] = [
  {
    key: "draftkings",
    title: "DraftKings",
    deepLink: "draftkings://",
    webUrl: "https://www.draftkings.com/affiliates/ref/YOUR_AFFILIATE_ID",
    affiliateParam: "affiliateId=YOUR_AFFILIATE_ID",
    bonus: "Bet $5, Get $200 in Bonus Bets",
    rating: 4.8,
    regions: ["us"],
  },
  {
    key: "fanduel",
    title: "FanDuel",
    deepLink: "fanduel://",
    webUrl: "https://account.fanduel.com/register?referralCode=YOUR_AFFILIATE_ID",
    affiliateParam: "pid=YOUR_AFFILIATE_ID",
    bonus: "No Sweat First Bet up to $1,000",
    rating: 4.7,
    regions: ["us"],
  },
  {
    key: "betmgm",
    title: "BetMGM",
    deepLink: "betmgm://",
    webUrl: "https://sports.betmgm.com/en/sports?bonus=YOUR_AFFILIATE_ID",
    affiliateParam: "bonus=YOUR_AFFILIATE_ID",
    bonus: "First Bet Offer up to $1,500",
    rating: 4.5,
    regions: ["us"],
  },
  {
    key: "caesars",
    title: "Caesars",
    deepLink: "caesarssportsbook://",
    webUrl: "https://sportsbook.caesars.com/us/az/bet?RID=YOUR_AFFILIATE_ID",
    affiliateParam: "RID=YOUR_AFFILIATE_ID",
    bonus: "First Bet on Caesars up to $1,000",
    rating: 4.4,
    regions: ["us"],
  },
  {
    key: "bet365",
    title: "bet365",
    deepLink: "bet365://",
    webUrl: "https://www.bet365.com/affiliates?affiliate=YOUR_AFFILIATE_ID",
    affiliateParam: "affiliate=YOUR_AFFILIATE_ID",
    bonus: "Bet $1, Get $200 in Bonus Bets",
    rating: 4.6,
    regions: ["us", "uk", "eu"],
  },
  {
    key: "betrivers",
    title: "BetRivers",
    deepLink: "betrivers://",
    webUrl: "https://www.betrivers.com/?page=register&rid=YOUR_AFFILIATE_ID",
    affiliateParam: "rid=YOUR_AFFILIATE_ID",
    bonus: "Second Chance Bet up to $500",
    rating: 4.1,
    regions: ["us"],
  },
  {
    key: "pointsbetus",
    title: "PointsBet",
    deepLink: "pointsbet://",
    webUrl: "https://pointsbet.com/signup/?ref=YOUR_AFFILIATE_ID",
    affiliateParam: "ref=YOUR_AFFILIATE_ID",
    bonus: "2x $500 Second Chance Bets",
    rating: 4.0,
    regions: ["us"],
  },
];

export const BOOKMAKER_BY_KEY: Record<string, BookmakerConfig> = Object.fromEntries(
  BOOKMAKERS.map((b) => [b.key, b])
);
