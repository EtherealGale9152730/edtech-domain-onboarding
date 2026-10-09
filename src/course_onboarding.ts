import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const onboardingRequestSchema = z.object({
  requestId: z.string().uuid(),
  domain: z.string().min(3),
  verification: z.object({
    name: z.string().min(1),
    content: z.string().min(1),
  }),
  educatorEmail: z.string().email(),
  course: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    learners: z.array(
      z.object({
        id: z.string().min(1),
        deadline: z.string().datetime(),
        completedAt: z.string().datetime().nullable(),
      }),
    ),
  }),
  observedAt: z.string().datetime(),
});

export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;

export type EducatorReport = {
  courseId: string;
  courseTitle: string;
  learnerCount: number;
  overdueLearnerIds: string[];
  generatedAt: string;
};

export function buildEducatorReport(
  input: OnboardingRequest,
  domainVerified: boolean,
): EducatorReport | null {
  if (!domainVerified) return null;
  const observedAt = Date.parse(input.observedAt);
  const overdueLearnerIds = input.course.learners
    .filter((learner) => learner.completedAt === null && Date.parse(learner.deadline) < observedAt)
    .map((learner) => learner.id);
  if (overdueLearnerIds.length === 0) return null;
  return {
    courseId: input.course.id,
    courseTitle: input.course.title,
    learnerCount: input.course.learners.length,
    overdueLearnerIds,
    generatedAt: input.observedAt,
  };
}

export async function onboardCourseProvider(client: InfraiClient, input: OnboardingRequest) {
  const { zone_id } = await client.addDomain(input.domain, input.requestId);
  await client.upsertTxtRecord(
    zone_id,
    input.verification.name,
    input.verification.content,
    input.requestId,
  );
  const verification = await client.verifyDomain(input.domain);
  if (!verification.verified) {
    return {
      status: "verification_pending" as const,
      domain: input.domain,
      zoneId: zone_id,
      educator: null,
      report: null,
    };
  }
  const educator = await client.getUserByEmail(input.educatorEmail);

  return {
    status: "onboarded" as const,
    domain: input.domain,
    zoneId: zone_id,
    educator,
    report: buildEducatorReport(input, true),
  };
}
