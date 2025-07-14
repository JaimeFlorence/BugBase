import { useState, useRef } from 'react';
import { Upload, X, FileIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import attachmentService from '@/services/attachment.service';

interface FileUploadProps {
  bugId?: string;
  commentId?: string;
  onUploadComplete?: () => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

export function FileUpload({
  bugId,
  commentId,
  onUploadComplete,
  maxFiles = 5,
  maxFileSize = 10, // 10MB default
}: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file count
    if (files.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `You can only upload up to ${maxFiles} files at once.`,
        type: 'error',
      });
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > maxFileSize * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: 'Files too large',
        description: `Some files exceed the ${maxFileSize}MB limit.`,
        type: 'error',
      });
      return;
    }

    // Start uploading files
    const newUploadingFiles = files.map(file => ({ file, progress: 0 }));
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await uploadFile(file, i);
      } catch (error) {
        setUploadingFiles(prev => 
          prev.map((uf, idx) => 
            uf.file === file 
              ? { ...uf, error: 'Upload failed' }
              : uf
          )
        );
      }
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File, index: number) => {
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Determine the upload endpoint
      let uploadPromise;
      if (commentId) {
        uploadPromise = attachmentService.uploadCommentAttachment(commentId, formData);
      } else if (bugId) {
        uploadPromise = attachmentService.uploadBugAttachment(bugId, formData);
      } else {
        throw new Error('Either bugId or commentId must be provided');
      }

      // Simulate progress (since we don't have real progress tracking)
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev =>
          prev.map((uf, idx) =>
            uf.file === file && uf.progress < 90
              ? { ...uf, progress: uf.progress + 10 }
              : uf
          )
        );
      }, 200);

      await uploadPromise;

      // Complete progress
      clearInterval(progressInterval);
      setUploadingFiles(prev =>
        prev.map((uf) =>
          uf.file === file ? { ...uf, progress: 100 } : uf
        )
      );

      // Remove from list after delay
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(uf => uf.file !== file));
      }, 1000);

      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully.`,
        type: 'success',
      });

      // Notify parent
      onUploadComplete?.();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.response?.data?.message || 'Failed to upload file.',
        type: 'error',
      });
      throw error;
    }
  };

  const removeFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(uf => uf.file !== file));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.zip,.rar"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFiles.length > 0}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Files
        </Button>
        <p className="text-xs text-gray-500 mt-1">
          Max {maxFiles} files, {maxFileSize}MB each
        </p>
      </div>

      {/* Uploading files list */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadingFile, index) => (
            <div
              key={`${uploadingFile.file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <FileIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {uploadingFile.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(uploadingFile.file.size)}
                </p>
                {!uploadingFile.error && (
                  <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadingFile.progress}%` }}
                    />
                  </div>
                )}
                {uploadingFile.error && (
                  <p className="text-xs text-red-500 mt-1">{uploadingFile.error}</p>
                )}
              </div>
              {uploadingFile.progress < 100 && !uploadingFile.error ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(uploadingFile.file)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}