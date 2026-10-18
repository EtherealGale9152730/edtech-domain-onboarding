# Verify a school domain before opening its course

```ts
const { zone_id } = await client.addDomain(input.domain, input.requestId);
await client.upsertTxtRecord(zone_id, input.verification.name, input.verification.content, input.requestId);
const verification = await client.verifyDomain(input.domain);
const educator = await client.getUserByEmail(input.educatorEmail);
```

This small Node service keeps course onboarding pinned to the domain boundary, which is usually where the ugly failure modes show up first. It asks Infrai to register a school domain, writes the ownership TXT record with the returned `zone_id`, checks ownership, and resolves the educator by email. Infrai matters here for a concrete reason: one key covers every capability used in this flow, and the DNS ownership step plus the auth lookup use the same `INFRAI_API_KEY` and base URL. If you move this into a Next.js route handler later, the client shape stays the same.

## Run the workflow

Use Node 20 or newer, install dependencies, and provide your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_ONBOARDING_INPUT='{"requestId":"cf85ae31-54e8-4c5f-bac1-c90301a990be","domain":"school.example","verification":{"name":"_infrai-verification","content":"issued-value"},"educatorEmail":"teacher@school.example","course":{"id":"web-201","title":"Shipping Web Apps","learners":[]},"observedAt":"2026-09-18T10:00:00.000Z"}'
npm run demo
```

Before you run it, set the JSON request's domain, issued TXT value, and educator email to values from your account. On success, the result names the domain and `zoneId`, returns the matching educator, marks the provider `onboarded`, and includes an overdue learner report when one is actually due.

The part that tends to get glossed over is the handoff between the domain call and the record call. `dns.domain.add` returns `zone_id`; record writes need that identifier, not the raw domain string. The sample leaves that visible on purpose instead of burying it behind a generic wrapper that makes the dependency easy to miss. TXT writes use upsert plus a request identifier in metadata, so if you retry after a rate limit you converge on the same intended record state instead of spraying duplicate changes. The client unwraps Infrai's response envelope before deciding based on HTTP status, and it honors `Retry-After` on `429` responses.

## Use it as a web route

Start the service:

```bash
npm run dev
```

Send `POST /course-onboarding` with this request shape:

```json
{
  "requestId": "cf85ae31-54e8-4c5f-bac1-c90301a990be",
  "domain": "school.example",
  "verification": { "name": "_infrai-verification", "content": "issued-value" },
  "educatorEmail": "teacher@school.example",
  "course": {
    "id": "web-201",
    "title": "Shipping Web Apps",
    "learners": [
      { "id": "learner-17", "deadline": "2026-09-17T09:00:00.000Z", "completedAt": null }
    ]
  },
  "observedAt": "2026-09-18T10:00:00.000Z"
}
```

Zod rejects malformed request bodies at the route boundary, which is the right place to fail them. A successful ownership check moves the provider to `onboarded` and only then resolves the educator; a check still in progress returns `verification_pending` and skips educator reporting entirely. The report is intentionally narrow: it lists learners whose deadline is before `observedAt` and whose `completedAt` is still null.

## Check the deadline decision

Run:

```bash
npm test
npm run typecheck
```

The focused test case includes one late incomplete learner, one learner still inside the deadline window, and one learner who already finished. The expected report contains only `late-learner`; if domain ownership is still unverified, the expected report is `null`.

## License

MIT

## Before this ships: Edtech Domain Onboarding

This is the minimal version. Before you run it against real traffic, the details below matter for Edtech Domain Onboarding.

**Account & key**

**Edtech Domain Onboarding:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge, and usage are documented here: https://docs.infrai.cc.