import { Effect, Schema } from "effect"
import { ModelV2 } from "../../model"
import { define } from "../internal"

const providerID = "hackclub"
const providerName = "Hack Club AI"
const baseURL = "https://ai.hackclub.com/proxy/v1"
const fallbackModelID = "qwen/qwen3-32b"

const ModelsResponse = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String,
    }),
  ),
})

const decodeModelsResponse = Schema.decodeUnknownEffect(ModelsResponse)

const fetchModelIDs = Effect.fn("HackClubAI.fetchModelIDs")(function* () {
  const response = yield* Effect.tryPromise(() => fetch(`${baseURL}/models`, { signal: AbortSignal.timeout(5000) }))
  if (!response.ok) return [fallbackModelID]
  return yield* Effect.tryPromise(() => response.json()).pipe(
    Effect.flatMap(decodeModelsResponse),
    Effect.map((payload) => payload.data.map((model) => model.id)),
    Effect.map((modelIDs) => (modelIDs.length > 0 ? modelIDs : [fallbackModelID])),
    Effect.catch(() => Effect.succeed([fallbackModelID])),
  )
})

export const HackClubAIPlugin = define({
  id: providerID,
  effect: Effect.fn(function* (ctx) {
    yield* ctx.integration.transform(
      Effect.fn(function* (integrations) {
        integrations.update(providerID, (integration) => (integration.name = providerName))
        integrations.method.update({
          integrationID: providerID,
          method: { type: "key" },
        })
        integrations.method.update({
          integrationID: providerID,
          method: { type: "env", names: ["HACK_CLUB_AI_API_KEY"] },
        })
      }),
    )

    yield* ctx.catalog.transform(
      Effect.fn(function* (catalog) {
        const modelIDs = yield* fetchModelIDs().pipe(Effect.catch(() => Effect.succeed([fallbackModelID])))
        catalog.provider.update(providerID, (provider) => {
          provider.name = providerName
          provider.api = {
            type: "aisdk",
            package: "@openrouter/ai-sdk-provider",
            url: baseURL,
          }
          provider.request.body.baseUrl = baseURL
        })
        for (const modelID of modelIDs) {
          catalog.model.update(providerID, ModelV2.ID.make(modelID), (model) => {
            model.name = modelID
            model.api = {
              id: ModelV2.ID.make(modelID),
              type: "aisdk",
              package: "@openrouter/ai-sdk-provider",
              url: baseURL,
            }
            model.capabilities = {
              tools: true,
              input: ["text"],
              output: ["text"],
            }
            model.cost = [{ input: 0, output: 0, cache: { read: 0, write: 0 } }]
            model.limit = { context: 0, output: 0 }
          })
        }
      }),
    )
  }),
})
