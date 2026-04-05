export const SimulationStore = {
  currentSimData: null as any,
  listeners: new Set<Function>(),
  set(data: any) {
    this.currentSimData = data;
    this.listeners.forEach(l => l(data));
  },
  subscribe(listener: Function) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
};
