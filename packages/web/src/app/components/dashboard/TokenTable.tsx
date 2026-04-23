import { X } from 'lucide-react';
import { Button } from '../ui/Button';

type TokenTableProps = {
  isOpen: boolean;
  onClose: () => void;
};

const tokenRows = [
  { token: 'surface/base', light: '#ffffff', dark: '#09090b' },
  { token: 'surface/subtle', light: '#fafafa', dark: '#18181b' },
  { token: 'border/default', light: '#e4e4e7', dark: '#27272a' },
  { token: 'text/primary', light: '#09090b', dark: '#fafafa' },
  { token: 'text/secondary', light: '#71717a', dark: '#a1a1aa' },
];

export function TokenTable({ isOpen, onClose }: TokenTableProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm dark:bg-black/60">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Reference Tokens</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Snapshot of the imported design language for discussion.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close token table</span>
          </Button>
        </div>

        <div className="overflow-x-auto p-5">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Token</th>
                <th className="py-2 pr-4 font-medium">Light</th>
                <th className="py-2 font-medium">Dark</th>
              </tr>
            </thead>
            <tbody>
              {tokenRows.map((row) => (
                <tr key={row.token} className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <td className="py-3 pr-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">{row.token}</td>
                  <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">{row.light}</td>
                  <td className="py-3 text-zinc-600 dark:text-zinc-400">{row.dark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
