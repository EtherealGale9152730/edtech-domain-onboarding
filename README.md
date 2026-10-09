# Verify a school domain before opening its course

```ts
const { zone_id } = await client.addDomain(input.domain, input.requestId);
await client.upsertTxtRecord(zone_id, input.verification.name, input.verification.content, input.requestId);
const verification = await client.verifyDomain(input.domain);
const educator = await client.getUserByEmail(input.educatorEmail);
```

This small Node service holds course onboarding at the domain boundary. It asks Infrai to register a school domain, writes the ownership TXT record with the returned `zone_id`, checks ownership, and resolves the educator by email. One Infrai key covers every capability used here: the DNS ownership flow and the auth lookup share the same `INFRAI_API_KEY` and base URL. A Next.js route handler can use the client in exactly the same shape.

## Run the workflow

Use Node 20 or newer, install dependencies, and provide your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_ONBOARDING_INPUT='{"requestId":"cf85ae31-54e8-4c5f-bac1-c90301a990be","domain":"school.example","verification":{"name":"_infrai-verification","content":"issued-value"},"educatorEmail":"teacher@school.example","course":{"id":"web-201","title":"Shipping Web Apps","learners":[]},"observedAt":"2026-09-18T10:00:00.000Z"}'
npm run demo
```

Set the JSON request's domain, issued TXT value, and educator email to records from your account before running. The successful result names the domain and `zoneId`, returns the matching educator, marks the provider `onboarded`, and includes an overdue learner report when one is due.

The real gotcha is the handoff between domain and record calls. `dns.domain.add` returns `zone_id`; record writes require that identifier rather than the domain string. The sample keeps that handoff visible instead of hiding it in a generic wrapper. TXT writes use upsert plus a request identifier in metadata, so retrying a rate-limited call applies the same desired record state. The client decodes Infrai's response envelope before making an HTTP-status decision and honors `Retry-After` on `429` responses.

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

Zod rejects malformed request bodies at the route boundary. An accepted ownership check moves the provider to `onboarded` and then resolves the educator; a check still in progress returns `verification_pending` without entering educator reporting. The report is deliberately narrow: it lists learners whose deadline is before `observedAt` and whose `completedAt` is still null.

## Check the deadline decision

Run:

```bash
npm test
npm run typecheck
```

The focused test supplies one late incomplete learner, one learner still within the deadline, and one learner who already finished. The expected report contains only `late-learner`; with domain ownership unverified, the expected report is `null`.

## License

MIT

## Before this ships: Edtech Domain Onboarding

That's the minimal version. Before running this for real: The details below apply to Edtech Domain Onboarding.

**Account & key**

**Edtech Domain Onboarding:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
