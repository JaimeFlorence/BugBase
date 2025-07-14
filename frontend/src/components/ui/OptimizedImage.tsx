import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallback?: string;
  blur?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fallback = '/placeholder.png',
  blur = true,
  priority = false,
  className,
  onLoad,
  onError,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  // Preload image when in view
  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    
    img.onload = () => {
      setIsLoading(false);
      setImageSrc(src);
      onLoad?.();
    };
    
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      setImageSrc(fallback);
      onError?.();
    };
    
    img.src = src;
  }, [src, fallback, isInView, onLoad, onError]);

  // Handle direct image errors
  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(fallback);
      onError?.();
    }
  };

  // Generate WebP source if supported
  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  const supportsWebP = src !== webpSrc;

  return (
    <picture className={cn('relative block', className)}>
      {/* WebP source for modern browsers */}
      {supportsWebP && isInView && (
        <source srcSet={webpSrc} type="image/webp" />
      )}
      
      {/* Original format fallback */}
      <img
        ref={imgRef}
        src={isInView ? imageSrc : undefined}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        onError={handleError}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          {
            'opacity-0': isLoading && blur,
            'opacity-100': !isLoading || !blur,
            'blur-sm': isLoading && blur,
          },
          className
        )}
        {...props}
      />
      
      {/* Loading placeholder */}
      {isLoading && blur && (
        <div
          className={cn(
            'absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse',
            className
          )}
        />
      )}
    </picture>
  );
};

// Avatar-specific optimized image component
export const OptimizedAvatar: React.FC<{
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ src, alt, size = 'md', className }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  const initials = alt
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium',
          sizeClasses[size],
          className
        )}
      >
        {initials}
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className={cn('rounded-full', sizeClasses[size], className)}
      fallback={`https://ui-avatars.com/api/?name=${encodeURIComponent(alt)}&size=128`}
    />
  );
};

// Thumbnail-specific optimized image component
export const OptimizedThumbnail: React.FC<{
  src: string;
  alt: string;
  aspectRatio?: '16/9' | '4/3' | '1/1';
  className?: string;
}> = ({ src, alt, aspectRatio = '16/9', className }) => {
  const aspectClasses = {
    '16/9': 'aspect-video',
    '4/3': 'aspect-4/3',
    '1/1': 'aspect-square',
  };

  // Generate thumbnail URL if using a known image service
  const thumbnailSrc = src.includes('cloudinary')
    ? src.replace('/upload/', '/upload/c_thumb,w_400,h_300/')
    : src;

  return (
    <div className={cn('overflow-hidden rounded-md', aspectClasses[aspectRatio], className)}>
      <OptimizedImage
        src={thumbnailSrc}
        alt={alt}
        className="w-full h-full object-cover"
      />
    </div>
  );
};