export interface Disposable {
  dispose(): void | Promise<void>;
}

export class DisposableScope implements Disposable {
  private readonly disposables: Disposable[] = [];

  add<T extends Disposable | null | undefined>(disposable: T): T {
    if (disposable) {
      this.disposables.push(disposable);
    }
    return disposable;
  }

  async dispose(): Promise<void> {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      if (!disposable) continue;
      await disposable.dispose();
    }
  }
}
