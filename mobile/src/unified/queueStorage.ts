import type { NewStoredQueueRecord, QueueStorage, StoredQueueRecord } from "../../../shared/controllers/domain/sourceWriteQueue";
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Persist one account's queue as an ordered snapshot; failed storage stays explicitly memory-only. */
export class NativeQueueStorage implements QueueStorage {
  persistent = true;
  private records: StoredQueueRecord[] = [];
  private nextId = 1;
  private tail: Promise<unknown>;
  constructor(private readonly save: (value: string) => Promise<void>, read: () => Promise<string | null>) {
    this.tail = read().then((raw) => {
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.some((record) => !record || !Number.isSafeInteger(record.id) || record.id < 1 || typeof record.input !== "string" || !record.init || !["pending", "retrying", "failed"].includes(record.status))) throw new Error("Invalid saved queue");
      this.records = parsed;
      this.nextId = Math.max(0, ...this.records.map((record) => record.id)) + 1;
    }).catch(() => { this.persistent = false; });
  }
  private change<T>(work: () => T): Promise<T> {
    const result = this.tail.then(async () => {
      const value = work();
      if (this.persistent) { try { await this.save(JSON.stringify(this.records)); } catch { this.persistent = false; } }
      return value;
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
  async list() { await this.tail; return clone(this.records); }
  add(record: NewStoredQueueRecord) { return this.change(() => { const value = { ...clone(record), id: this.nextId++ }; this.records.push(value); return clone(value); }); }
  update(id: number, patch: Partial<StoredQueueRecord>) { return this.change(() => { this.records = this.records.map((record) => record.id === id ? { ...record, ...clone(patch), id } : record); }); }
  remove(id: number) { return this.change(() => { this.records = this.records.filter((record) => record.id !== id); }); }
}
