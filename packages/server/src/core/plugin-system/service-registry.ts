// 插件通过 declaration merging 扩展此接口：
//   declare module '../registry/service-registry.js' {
//     interface ServiceMap { 'my-service': MyService; }
//   }
export interface ServiceMap {}

export type ServiceKey = keyof ServiceMap;

export class ServiceRegistry {
  private services = new Map<string, unknown>();

  register<K extends string>(key: K, service: K extends ServiceKey ? ServiceMap[K] : unknown): void {
    if (this.services.has(key)) throw new Error(`Service '${key}' already registered`);
    this.services.set(key, service);
  }

  get<K extends ServiceKey>(key: K): ServiceMap[K] {
    const s = this.services.get(key as string);
    if (!s) throw new Error(`Service '${key}' not registered`);
    return s as ServiceMap[K];
  }

  tryGet<K extends ServiceKey>(key: K): ServiceMap[K] | undefined {
    return this.services.get(key as string) as ServiceMap[K] | undefined;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  list(): string[] {
    return Array.from(this.services.keys());
  }
}
