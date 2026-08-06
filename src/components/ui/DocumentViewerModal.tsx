import { X, Download, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  title: string;
  fileName?: string;
  url: string | null;
  loading: boolean;
  error: string;
  previewable: boolean;
  onClose: () => void;
  onDownload: () => void;
}

export function DocumentViewerModal({ title, fileName, url, loading, error, previewable, onClose, onDownload }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
          {fileName && <p className="text-xs text-gray-400 truncate">{fileName}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onDownload}
            disabled={!url}
            className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
            title="Download"
          >
            <Download size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-gray-900">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 size={28} className="animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm text-gray-200 max-w-sm">{error}</p>
          </div>
        )}

        {!loading && !error && url && (
          previewable ? (
            <iframe src={url} title={title} className="absolute inset-0 w-full h-full border-0 bg-white" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm text-gray-200 max-w-sm">Preview isn't available for this file type.</p>
              <button
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-white text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Download size={12} /> Download file
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
