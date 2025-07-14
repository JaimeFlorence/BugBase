import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface ToasterProps {
  toasts?: Toast[];
}

let toastCount = 0;
const toasts: Toast[] = [];
const listeners: Array<(toasts: Toast[]) => void> = [];

export function toast(props: Omit<Toast, 'id'>) {
  const id = String(toastCount++);
  const toast = { ...props, id };
  
  toasts.push(toast);
  listeners.forEach((listener) => listener([...toasts]));
  
  const duration = props.duration || 5000;
  
  setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index > -1) {
      toasts.splice(index, 1);
      listeners.forEach((listener) => listener([...toasts]));
    }
  }, duration);
}

export function Toaster({ toasts: externalToasts }: ToasterProps) {
  const [internalToasts, setInternalToasts] = useState<Toast[]>([]);
  
  useEffect(() => {
    listeners.push(setInternalToasts);
    return () => {
      const index = listeners.indexOf(setInternalToasts);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);
  
  const activeToasts = externalToasts || internalToasts;
  
  const removeToast = (id: string) => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index > -1) {
      toasts.splice(index, 1);
      listeners.forEach((listener) => listener([...toasts]));
    }
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {activeToasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'relative flex items-start gap-3 rounded-lg border p-4 pr-8 shadow-lg transition-all',
            'animate-in slide-in-from-bottom-2',
            {
              'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100':
                toast.type === 'success',
              'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100':
                toast.type === 'error',
              'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100':
                toast.type === 'warning',
              'border-border bg-background text-foreground': !toast.type || toast.type === 'default',
            }
          )}
        >
          <div className="flex-1">
            <div className="font-semibold">{toast.title}</div>
            {toast.description && (
              <div className="mt-1 text-sm opacity-90">{toast.description}</div>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}