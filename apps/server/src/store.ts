import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deserialize, publicState, sampleModel, serialize, transition, type Action, type Model } from "@nabungfi/shared";

export class DemoStore {
  private model: Model;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly file: string;
  private constructor(file: string, model: Model) { this.file = file; this.model = model; }
  static async open(file: string) {
    let model: Model;
    try { model = deserialize(await readFile(file, "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("The saved demo state is invalid; preserve it for inspection before resetting.", { cause: error });
      model = sampleModel();
    }
    return new DemoStore(file, model);
  }
  view() { return publicState(this.model); }
  apply(action: Action, requestId: string, expectedGoalId = this.model.goal.id) {
    const operation = this.queue.then(async () => {
      const next = transition(this.model, action, requestId, new Date().toISOString(), expectedGoalId);
      if (next !== this.model) {
        await mkdir(dirname(this.file), { recursive: true });
        const temporary = this.file + ".pending";
        await writeFile(temporary, serialize(next), { encoding: "utf8", mode: 0o600 });
        await rename(temporary, this.file);
        this.model = next;
      }
      return this.view();
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
