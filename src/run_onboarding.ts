import { onboardingRequestSchema, onboardCourseProvider } from "./course_onboarding.js";
import { InfraiClient } from "./infrai_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the demo.");

const rawInput = process.env.INFRAI_ONBOARDING_INPUT;
if (!rawInput) throw new Error("Set INFRAI_ONBOARDING_INPUT to a JSON onboarding request.");
const input = onboardingRequestSchema.parse(JSON.parse(rawInput));

const result = await onboardCourseProvider(new InfraiClient(apiKey), input);
console.log(JSON.stringify(result, null, 2));
