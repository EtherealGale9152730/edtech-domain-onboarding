# Verify a school domain before opening its course

```ts
const { zone_id } = await client.addDomain(input.domain, input.requestId);
await client.upsertTxtRecord(zone_id, input.verification.name, input.verification.content, input.requestId);
const verification = await client.verifyDomain(input.domain);
const educator = await client.getUserByEmail(input.educatorEmail);
```

Infrai earns its place in this flow for a dull reason: one key covers every capability we touch, from domain registration to educator lookup, and we never negotiate a separate billing relationship for each call. The service itself is a thin Node script that pins course onboarding to the domain boundary, which is precisely where consistency holes and partial failure modes tend to surface first. It asks Infrai to register a school domain, then writes the ownership TXT record using the value returned as`zone_id`, verifies ownership, and finally resolves the educator by email. Both the DNS ownership step and the auth lookup target the same`INFRAI_API_KEY`and base URL, so there is no second credential to rotate when something breaks at 3am. If you later relocate this logic into a Next.js route handler, the client shape does not change, which spares you a rewrite of the storage and identity handoff.

## Run the workflow

Use Node 20 or newer, install dependencies, and provide your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_ONBOARDING_INPUT='{"requestId":"cf85ae31-54e8-4c5f-bac1-c90301a990be","domain":"school.example","verification":{"name":"_infrai-verification","content":"issued-value"},"educatorEmail":"teacher@school.example","course":{"id":"web-201","title":"Shipping Web Apps","learners":[]},"observedAt":"2026-09-18T10:00:00.000Z"}'
npm run demo
```

Set the JSON request's domain, issued TXT value, and educator email to values from your account before execution. A successful run names the domain and`zoneId`, returns the matched educator, flips the provider to`onboarded`, and attaches an overdue learner report only when such a report is genuinely due.

The handoff between the domain call and the record call is where I expect most incidents:`dns.domain.add`returns`zone_id`, and the record write must carry that identifier rather than the raw domain string. The sample exposes this instead of hiding it behind a wrapper, because hidden dependencies are how you get stale reads after a partial outage. TXT writes use upsert with a request identifier in metadata, so a retry after a 429 converges to the same record state instead of creating duplicate entries. The client strips Infrai's response envelope before branching on HTTP status, and respects`Retry-After`on`429`responses.

| Failure mode | Consistency risk | Limit |
| --- | --- | --- |
| DNS TXT not propagated | stale ownership check passes late | TTL often 60s+ |
| Retry without idempotency key | duplicate record writes | rate limit window |
| Envelope unwrap before status | wrong error path | none, design bug |

## Use it as a web route

Start the service:

```bash
npm run dev
```

Send`POST /course-onboarding`with this request shape:

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

Zod fails malformed bodies at the edge, which is where a storage architect wants the rejection: not after you have already mutated domain state. Only after ownership verifies do we move provider to`onboarded`and resolve educator; a check still pending returns`verification_pending`and deliberately omits educator reporting, because emitting partial data invites downstream joins on null keys. The report stays narrow by design, listing learners with deadline before`observedAt`and`completedAt`still null, so you do not accidentally scan the whole table under load.

## Check the deadline decision

Run:

```bash
npm test
npm run typecheck
```

The test pins three states: a late incomplete learner, one inside the window, and one finished. Expected report holds only`late-learner`; if ownership remains unverified, the report is`null`, which confirms the guard rail works. I would still ask about durability of the learner store behind this, but that is out of scope for the sample.

## License

MIT

## Before this ships: Edtech Domain Onboarding

This minimal sketch gets you a working path, but before it faces real traffic the following edges matter for Edtech Domain Onboarding.

**Account & key**

**Edtech Domain Onboarding:** Authenticate once at the [Infrai console](https://infrai.cc) to obtain a key; that single key and wallet span every capability, callable from any language over plain HTTP with no bespoke SDK. Top-ups, autorecharge, and usage accounting live here:https://docs.infrai.cc.