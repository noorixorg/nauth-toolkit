#!/usr/bin/env node
// One-off: submit priority URLs to Bing using the session from your curl. Run once before token expires.

const fs = require('fs');
const path = require('path');

const PRIORITY_FILE = path.join(__dirname, '..', 'static', 'priority-urls-for-seo.txt');
const text = fs.readFileSync(PRIORITY_FILE, 'utf8');
const urls = [];
for (const line of text.split('\n')) {
  const m = line.match(/https:\/\/nauth\.dev\/[^\s]*/);
  if (m) urls.push(m[0]);
}
const body = JSON.stringify({ SiteUrl: 'https://nauth.dev/', UrlsToSubmit: [...new Set(urls)] });

(async () => {
const res = await fetch('https://www.bing.com/webmasters/api/submiturls/submit', {
  method: 'POST',
  headers: {
    'sec-ch-ua-full-version-list': '"Not(A:Brand";v="8.0.0.0", "Chromium";v="144.0.7559.134", "Google Chrome";v="144.0.7559.134"',
    'sec-ch-ua-platform': '"macOS"',
    'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-model': '""',
    'sec-ch-ua-mobile': '?0',
    'request-id': '|b34a0d78f51f448cbd2b09a4cbe9fe58.bc4c9056abfc4e74',
    'traceparent': '00-b34a0d78f51f448cbd2b09a4cbe9fe58-bc4c9056abfc4e74-01',
    'sec-ch-ua-arch': '"arm"',
    'sec-ch-ua-full-version': '"144.0.7559.134"',
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'content-type': 'application/json;charset=UTF-8',
    'x-csrf-token': 'c34ec4e52d034178b1049e22ba3c2f75',
    'Referer': 'https://www.bing.com/webmasters/urlinspection?siteUrl=https%3A%2F%2Fnauth.dev%2F&urlToInspect=https%253A%252F%252Fnauth.dev%252Fdocs%252Fconcepts%252Fchallenge-system',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'DNT': '1',
    'sec-ch-ua-platform-version': '"15.7.4"',
  },
  body,
});

console.log(res.status, res.statusText);
console.log(await res.text());
})();
