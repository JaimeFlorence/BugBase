// Performance monitoring utilities

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Only run in browser environment
    if (typeof window === 'undefined' || !window.performance) return;

    // Web Vitals Observer
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      this.observeMetric('largest-contentful-paint', (entries) => {
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('LCP', lastEntry.renderTime || lastEntry.loadTime, 'ms');
      });

      // First Input Delay (FID)
      this.observeMetric('first-input', (entries) => {
        const firstEntry = entries[0];
        this.recordMetric('FID', firstEntry.processingStart - firstEntry.startTime, 'ms');
      });

      // Cumulative Layout Shift (CLS)
      this.observeMetric('layout-shift', (entries) => {
        let clsScore = 0;
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsScore += entry.value;
          }
        });
        this.recordMetric('CLS', clsScore, 'score');
      });

      // Long Tasks
      this.observeMetric('longtask', (entries) => {
        entries.forEach((entry) => {
          this.recordMetric('Long Task', entry.duration, 'ms');
          console.warn(`Long task detected: ${entry.duration}ms`);
        });
      });
    }

    // Navigation Timing
    if (window.performance.timing) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const timing = window.performance.timing;
          const navigationStart = timing.navigationStart;

          this.recordMetric(
            'Page Load Time',
            timing.loadEventEnd - navigationStart,
            'ms'
          );
          this.recordMetric(
            'DOM Content Loaded',
            timing.domContentLoadedEventEnd - navigationStart,
            'ms'
          );
          this.recordMetric(
            'Time to First Byte',
            timing.responseStart - navigationStart,
            'ms'
          );
        }, 0);
      });
    }
  }

  private observeMetric(type: string, callback: (entries: PerformanceEntry[]) => void) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ entryTypes: [type] });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`Failed to observe ${type}:`, error);
    }
  }

  recordMetric(name: string, value: number, unit: string) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 ${name}: ${value.toFixed(2)}${unit}`);
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalytics(metric);
    }
  }

  private sendToAnalytics(metric: PerformanceMetric) {
    // Implement your analytics integration here
    // Example: Google Analytics, Sentry, custom endpoint
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'performance', {
        event_category: 'Web Vitals',
        event_label: metric.name,
        value: Math.round(metric.value),
        metric_unit: metric.unit,
      });
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name);
  }

  getAverageMetric(name: string): number | null {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return null;

    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  clearMetrics() {
    this.metrics = [];
  }

  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.metrics = [];
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export const getPerformanceMonitor = (): PerformanceMonitor => {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
};

// React hook for component render performance
export const useRenderMetrics = (componentName: string) => {
  const renderCount = useRef(0);
  const renderStartTime = useRef<number>(0);

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = performance.now() - renderStartTime.current;

    if (renderCount.current > 1) {
      getPerformanceMonitor().recordMetric(
        `${componentName} Re-render`,
        renderTime,
        'ms'
      );

      if (renderTime > 16.67) {
        // More than one frame (60fps)
        console.warn(
          `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`
        );
      }
    }

    renderStartTime.current = performance.now();
  });

  return {
    renderCount: renderCount.current,
  };
};

// Measure async operation performance
export const measureAsync = async <T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    getPerformanceMonitor().recordMetric(name, duration, 'ms');
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    getPerformanceMonitor().recordMetric(`${name} (failed)`, duration, 'ms');
    throw error;
  }
};

// Bundle size tracking
export const trackBundleSize = () => {
  if (typeof window === 'undefined' || !window.performance) return;

  const resources = performance.getEntriesByType('resource');
  const jsResources = resources.filter((r) => r.name.endsWith('.js'));
  const cssResources = resources.filter((r) => r.name.endsWith('.css'));

  const totalJsSize = jsResources.reduce((acc, r: any) => acc + (r.transferSize || 0), 0);
  const totalCssSize = cssResources.reduce((acc, r: any) => acc + (r.transferSize || 0), 0);

  getPerformanceMonitor().recordMetric('JS Bundle Size', totalJsSize / 1024, 'KB');
  getPerformanceMonitor().recordMetric('CSS Bundle Size', totalCssSize / 1024, 'KB');
  getPerformanceMonitor().recordMetric(
    'Total Bundle Size',
    (totalJsSize + totalCssSize) / 1024,
    'KB'
  );
};

// Memory usage tracking
export const trackMemoryUsage = () => {
  if (typeof window === 'undefined' || !(window.performance as any).memory) return;

  const memory = (window.performance as any).memory;
  getPerformanceMonitor().recordMetric(
    'JS Heap Used',
    memory.usedJSHeapSize / 1048576,
    'MB'
  );
  getPerformanceMonitor().recordMetric(
    'JS Heap Total',
    memory.totalJSHeapSize / 1048576,
    'MB'
  );
};

// Network performance tracking
export const trackNetworkPerformance = () => {
  if (typeof window === 'undefined' || !('connection' in navigator)) return;

  const connection = (navigator as any).connection;
  getPerformanceMonitor().recordMetric('Network RTT', connection.rtt || 0, 'ms');
  getPerformanceMonitor().recordMetric(
    'Network Downlink',
    connection.downlink || 0,
    'Mbps'
  );
};

// Initialize performance monitoring
export const initializePerformanceMonitoring = () => {
  // Start monitoring
  const monitor = getPerformanceMonitor();

  // Track initial metrics after page load
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        trackBundleSize();
        trackMemoryUsage();
        trackNetworkPerformance();
      }, 1000);
    });

    // Track memory usage periodically
    setInterval(() => {
      trackMemoryUsage();
    }, 30000); // Every 30 seconds
  }

  return monitor;
};

// React Performance Profiler wrapper
import { Profiler, ProfilerOnRenderCallback, useRef, useEffect } from 'react';

export const PerformanceProfiler: React.FC<{
  id: string;
  children: React.ReactNode;
}> = ({ id, children }) => {
  const onRender: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    if (actualDuration > 16.67) {
      // Log slow renders
      console.warn(`Slow ${phase} in ${id}: ${actualDuration.toFixed(2)}ms`);
    }

    getPerformanceMonitor().recordMetric(
      `${id} ${phase}`,
      actualDuration,
      'ms'
    );
  };

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
};