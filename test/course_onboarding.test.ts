import { describe, expect, it } from "vitest";
import { buildEducatorReport, onboardingRequestSchema } from "../src/course_onboarding.js";

const request = onboardingRequestSchema.parse({
  requestId: "cf85ae31-54e8-4c5f-bac1-c90301a990be",
  domain: "school.example",
  verification: { name: "_infrai-verification", content: "issued-value" },
  educatorEmail: "teacher@school.example",
  course: {
    id: "web-201",
    title: "Shipping Web Apps",
    learners: [
      { id: "late-learner", deadline: "2026-09-17T09:00:00.000Z", completedAt: null },
      { id: "on-time-learner", deadline: "2026-09-20T09:00:00.000Z", completedAt: null },
      {
        id: "finished-learner",
        deadline: "2026-09-16T09:00:00.000Z",
        completedAt: "2026-09-15T12:00:00.000Z",
      },
    ],
  },
  observedAt: "2026-09-18T10:00:00.000Z",
});

describe("educator deadline report", () => {
  it("reports only incomplete learners past their deadline after domain verification", () => {
    expect(buildEducatorReport(request, true)?.overdueLearnerIds).toEqual(["late-learner"]);
    expect(buildEducatorReport(request, false)).toBeNull();
  });
});
