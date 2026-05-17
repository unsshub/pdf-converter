'use client';

interface ConversionProgressProps {
  progress: number;
  status: string;
  fileName: string;
  fileSize: number;
  accentColor?: string;
}

export default function ConversionProgress({ 
  progress, 
  status, 
  fileName, 
  fileSize,
  accentColor = '#2B579A' 
}: ConversionProgressProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'PENDING': return 'Preparing your file...';
      case 'PROCESSING': return 'Converting PDF to Word...';
      case 'COMPLETED': return 'Conversion complete!';
      case 'FAILED': return 'Conversion failed';
      default: return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'COMPLETED':
        return (
          <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'FAILED':
        return (
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 animate-spin" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={accentColor} strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{fileName}</p>
            <p className="text-xs text-slate-400">{formatFileSize(fileSize)}</p>
          </div>
          {getStatusIcon()}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">{getStatusText()}</span>
            <span className="text-slate-500">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ 
                width: `${progress}%`,
                backgroundColor: status === 'FAILED' ? '#EF4444' : status === 'COMPLETED' ? '#10B981' : accentColor,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
