import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"

const ModelsResponse = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String,
    }),
  ),
})

const decodeModelsResponse = Schema.decodeUnknownEffect(ModelsResponse)

test("the model response decoder works with Effect", async () => {
  const result = await Effect.runPromise(
    Effect.tryPromise(() => Promise.resolve({ data: [{ id: "qwen/qwen3-32b" }] })).pipe(
      Effect.flatMap(decodeModelsResponse),
    ),
  )

  expect(result.data[0].id).toBe("qwen/qwen3-32b")
})
