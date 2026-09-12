# Supporter list maintenance

SmoothScroll's README supporter section is updated by
`.github/workflows/update-supporters.yml` every six hours and can also be run
manually from the **Actions** tab.

## Setup

1. Create a read-only access token in the Buy Me a Coffee developer dashboard.
2. In GitHub, open **Settings → Secrets and variables → Actions**.
3. Add a repository secret named `BUY_ME_A_COFFEE_TOKEN`.
4. Open **Actions → Update Supporters → Run workflow** once to verify the setup.

The token must never be committed to the repository or printed in logs. The
current Buy Me a Coffee developer page marks this historical API as no longer
maintained and directs new integrations to webhooks, so this repository-only
updater is intentionally isolated and fails closed if the endpoint changes.

## Local use

With a token in the environment:

```powershell
$env:BUY_ME_A_COFFEE_TOKEN = 'your-token'
pnpm supporters:update
```

Use a fixture to test without contacting Buy Me a Coffee. `--dry-run` prints
the generated section and never changes `README.md`:

```powershell
pnpm supporters:update -- --fixture .\path\to\fixture.json --dry-run
```

Run the updater tests with:

```text
pnpm supporters:test
```

## Privacy contract

Only a provider-supplied public display name or public username may be
rendered. Missing public identity becomes `Anonymous`. The updater never
falls back to email or payer name, never renders supporter messages, and does
not persist email addresses, payment IDs, transaction IDs, IP addresses,
amounts, or avatars.

Names are treated as untrusted input and escaped before they are placed in
Markdown. A provider error, invalid response, missing token, or missing README
marker fails the workflow without changing the existing supporter section.

The first supporter is kept in `.github/supporters.json` using only public
display data. It deliberately contains no email or Buy Me a Coffee identifier,
so the first-supporter badge remains visible even if the API later returns
only recent records.
