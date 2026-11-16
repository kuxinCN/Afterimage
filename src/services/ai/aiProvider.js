import { ERROR_CODES } from "@/lib/constants";

export class AiError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.cause = options.cause;
  }
}

export function createProviderRegistry(providers) {
  const registered = new Map(Object.entries(providers));

  return {
    list() {
      return [...registered.keys()];
    },

    get(name) {
      const provider = registered.get(name);

      if (!provider) {
        throw new AiError(
          ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
          `AI provider "${name}" is not registered`,
        );
      }
      if (typeof provider.analyze !== "function") {
        throw new AiError(
          ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
          `AI provider "${name}" does not implement analyze()`,
        );
      }

      return provider;
    },
  };
}
