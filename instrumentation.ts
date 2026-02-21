import { registerOTel } from "@vercel/otel";

export function register() {
    // Register OpenTelemetry
    registerOTel("quantinuum-docs");
}
