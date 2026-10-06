# NabungFi on web, mobile and desktop

The same frontend supports a normal browser and an installed standalone window. The manifest has an app identity, approved N icons including a maskable icon, mobile and desktop preview screenshots, and Goals/Activity/Wallets shortcuts. Screenshots are labelled example goals and originate from the isolated component fixture. They are not customer balances.

In a supported browser, Settings offers Install app when the browser supplies a real install prompt. Desktop also has an install action in the app header. If an install prompt is not available, How to add the app provides browser-specific instructions. On iPhone/iPad, use Safari → Share → Add to Home Screen. Installation completion in a browser tab and a standalone app window have different messages. [Browser installation guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing).

## Offline and update behavior

Only same-origin public assets are cached. Authenticated requests, API traffic, non-GET requests and other origins bypass the service worker. Offline financial requests fail without being queued or replayed. A cold offline app launch displays the sign-in shell without requesting an uncached authentication SDK, keeps the intended goal URL, and disables sign-in. If the SDK has already been requested, losing connectivity does not unmount the running wallet controller.

A new worker waits. The user can activate it through Update after the current unresolved wallet lifecycle has been reconciled. The React external store also detects a waiting worker found between rendering and subscribing; this closes the missed-notification race on a new document. Old NabungFi public caches retire after explicit activation. Another application's cache is not deleted.

## Verified on 7 October 2026

- Unit coverage includes authenticated/API/mutation bypass, original financial intent, amount precision and independent goal eligibility.
- The production fixture test installs the actual generated worker, reloads offline, rejects an offline mutation, finds no private API responses in its cache, blocks Update while the fixture has a pending wallet operation, and activates only after explicit consent.
- The actual normal production build test launches the protected app route offline after visiting only the public landing. It retains a readable login page and target URL with zero account API requests and zero page errors.
- The same release test renders the actual emitted CSS in both route/base loading orders at three widths. Scoped app styles keep the approved yellow selection, warm pocket surface and full-width mobile dock even when a shared stylesheet arrives later.
- Browser tests cover goal filters without changing the portfolio, correct selected identity, balance hiding, install cancellation/completion, standalone presentation and unobscured form errors at 375/768/1280px.
- An independent visitor understood the product and indefinite per-goal commitment from the UI alone. Its gas-label and form-error findings were repaired and independently rechecked. Its separate production probe confirmed the update-store race and three corrected fresh navigations.

No test in this UI pass signs a transaction or proves real DeFi yield. Synthetic appinstalled/display-mode cases are distinct from installing on a physical phone or desktop OS. Physical-device installation, OAuth return in an installed mobile window and browser-signed financial acceptance remain separate device checks.

## Reproduce

```sh
pnpm --filter @nabungfi/web test
pnpm --filter @nabungfi/web test:browser
pnpm --filter @nabungfi/web build
pnpm --filter @nabungfi/web test:pwa
pnpm --filter @nabungfi/web test:pwa:release
```

The browser channel defaults to installed Edge for the standalone worker checks; set PW_BROWSER_CHANNEL when another supported test browser is available. All worker fixture builds and diagnostics stay under ignored `.local`. Component harness code is not an entry in the normal release build.
