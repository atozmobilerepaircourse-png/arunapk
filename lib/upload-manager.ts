let _xhr: XMLHttpRequest | null = null;
let _progress = 0;
let _message = '';
let _fileName = '';
let _isUploading = false;
const _listeners: Set<() => void> = new Set();

function notify() {
  _listeners.forEach(fn => fn());
}

export const UploadManager = {
  start(xhr: XMLHttpRequest, fileName: string) {
    _xhr = xhr;
    _isUploading = true;
    _progress = 0;
    _message = 'Starting upload...';
    _fileName = fileName;
    notify();
  },

  update(progress: number, message: string) {
    _progress = progress;
    _message = message;
    notify();
  },

  finish() {
    _xhr = null;
    _isUploading = false;
    _progress = 100;
    notify();
    setTimeout(() => {
      _progress = 0;
      _message = '';
      _fileName = '';
      notify();
    }, 2000);
  },

  cancel() {
    if (_xhr) { _xhr.abort(); _xhr = null; }
    _isUploading = false;
    _progress = 0;
    _message = '';
    _fileName = '';
    notify();
  },

  isUploading: () => _isUploading,
  getProgress: () => _progress,
  getMessage: () => _message,
  getFileName: () => _fileName,

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
