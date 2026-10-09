import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { onboardingRequestSchema, onboardCourseProvider } from "./course_onboarding.js";
import { InfraiClient, InfraiError } from "./infrai_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");
const client = new InfraiClient(apiKey);

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/course-onboarding") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = onboardingRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await onboardCourseProvider(client, input);
    json(response, result.status === "onboarded" ? 201 : 202, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "Request could not be completed" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Course onboarding route listening on http://localhost:${process.env.PORT ?? 3000}`);
});
