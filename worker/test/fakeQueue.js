// In-memory stand-in for a BullMQ Queue, with the one behavior the coordination logic relies on:
// add() with a jobId that already exists is ignored. Tests can set a job's state to simulate
// "failed", "active", a job that vanished, etc.
const registry = new Map();

class FakeQueue {
  constructor(name) { this.name = name; this.jobs = new Map(); this.addCalls = 0; }
  async add(name, data, opts = {}) {
    this.addCalls++;
    const id = opts.jobId ?? `auto-${this.addCalls}`;
    if (!this.jobs.has(id)) this.jobs.set(id, { id, name, data, opts, state: 'waiting', failedReason: undefined });
    return this.jobs.get(id);
  }
  async getJob(id) {
    const j = this.jobs.get(id);
    return j && { ...j, getState: async () => j.state };
  }
  setState(id, state, failedReason) { Object.assign(this.jobs.get(id), { state, failedReason }); }
  async close() {}
}

export function fakeQueue(name) {
  if (!registry.has(name)) registry.set(name, new FakeQueue(name));
  return registry.get(name);
}
// Empty queues IN PLACE rather than discarding them: modules like the aggregator create their
// Queue once at import time and keep that object for the life of the test file.
export function resetFakeQueues() {
  for (const q of registry.values()) { q.jobs.clear(); q.addCalls = 0; }
}
