const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5] as const;

function escapeLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

export class MetricsRegistry {
  private readonly requests = new Map<string, number>();
  private readonly durations = new Map<string, { count: number; sum: number; buckets: number[] }>();
  private readonly transitions = new Map<string, number>();
  private activeMockSessions = 0;

  incrementRequest(method: string): void {
    const key = method.toUpperCase().slice(0, 12);
    this.requests.set(key, (this.requests.get(key) ?? 0) + 1);
  }

  observeRequest(method: string, seconds: number): void {
    const key = method.toUpperCase().slice(0, 12);
    const sample = this.durations.get(key) ?? { count: 0, sum: 0, buckets: BUCKETS.map(() => 0) };
    sample.count += 1;
    sample.sum += Math.max(0, seconds);
    for (let index = 0; index < BUCKETS.length; index += 1) {
      if (seconds <= (BUCKETS[index] ?? 0)) sample.buckets[index] = (sample.buckets[index] ?? 0) + 1;
    }
    this.durations.set(key, sample);
  }

  transition(from: string, to: string): void {
    const key = `${from}:${to}`;
    this.transitions.set(key, (this.transitions.get(key) ?? 0) + 1);
  }

  setActiveMockSessions(count: number): void {
    this.activeMockSessions = Math.max(0, count);
  }

  render(): string {
    const lines = [
      "# HELP vaani_api_requests_total HTTP requests handled by the API.",
      "# TYPE vaani_api_requests_total counter",
    ];
    for (const [method, count] of this.requests) lines.push(`vaani_api_requests_total{method="${escapeLabel(method)}"} ${count}`);

    lines.push("# HELP vaani_api_request_duration_seconds API request duration in seconds.", "# TYPE vaani_api_request_duration_seconds histogram");
    for (const [method, sample] of this.durations) {
      for (let index = 0; index < BUCKETS.length; index += 1) {
        lines.push(`vaani_api_request_duration_seconds_bucket{method="${escapeLabel(method)}",le="${BUCKETS[index]}"} ${sample.buckets[index] ?? 0}`);
      }
      lines.push(`vaani_api_request_duration_seconds_bucket{method="${escapeLabel(method)}",le="+Inf"} ${sample.count}`);
      lines.push(`vaani_api_request_duration_seconds_sum{method="${escapeLabel(method)}"} ${sample.sum}`);
      lines.push(`vaani_api_request_duration_seconds_count{method="${escapeLabel(method)}"} ${sample.count}`);
    }

    lines.push("# HELP vaani_call_state_transitions_total Call state transitions in mock sessions.", "# TYPE vaani_call_state_transitions_total counter");
    for (const [key, count] of this.transitions) {
      const [from, to] = key.split(":");
      lines.push(`vaani_call_state_transitions_total{from="${escapeLabel(from ?? "")}",to="${escapeLabel(to ?? "")}"} ${count}`);
    }
    lines.push(
      "# HELP vaani_active_mock_sessions Active in-memory mock call sessions.",
      "# TYPE vaani_active_mock_sessions gauge",
      `vaani_active_mock_sessions ${this.activeMockSessions}`,
    );
    return `${lines.join("\n")}\n`;
  }
}
