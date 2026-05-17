export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_MIME_TYPES = ['application/pdf'];
export const ALLOWED_EXTENSIONS = ['.pdf'];
export const UPLOAD_DIR = './uploads';
export const OUTPUT_DIR = './outputs';

export const API_ROUTES = {
  UPLOAD: '/api/upload',
  CONVERT: (id: string) => `/api/convert/${id}`,
  STATUS: (id: string) => `/api/status/${id}`,
  DOWNLOAD: (id: string) => `/api/download/${id}`,
} as const;

export const TOOLS = [
  {
    id: 'pdf-to-word',
    title: 'PDF to Word',
    description: 'Easily convert your PDF files into easy to edit DOC and DOCX documents.',
    icon: 'file-word',
    color: '#2B579A',
    href: '/pdf-to-word',
  },
  {
    id: 'pdf-to-excel',
    title: 'PDF to Excel',
    description: 'Pull data straight from PDFs into Excel spreadsheets.',
    icon: 'file-excel',
    color: '#217346',
    href: '/pdf-to-excel',
  },
  {
    id: 'pdf-to-ppt',
    title: 'PDF to PowerPoint',
    description: 'Convert your PDFs to PowerPoint presentations.',
    icon: 'file-powerpoint',
    color: '#D24726',
    href: '/pdf-to-ppt',
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'Make DOC and DOCX files easy to read by converting them to PDF.',
    icon: 'file-pdf',
    color: '#E74C3C',
    href: '/word-to-pdf',
  },
  {
    id: 'merge-pdf',
    title: 'Merge PDF',
    description: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    icon: 'merge',
    color: '#E67E22',
    href: '/merge-pdf',
  },
  {
    id: 'split-pdf',
    title: 'Split PDF',
    description: 'Separate one page or a whole set for easy conversion into independent PDF files.',
    icon: 'split',
    color: '#9B59B6',
    href: '/split-pdf',
  },
  {
    id: 'compress-pdf',
    title: 'Compress PDF',
    description: 'Reduce file size while optimizing for maximal PDF quality.',
    icon: 'compress',
    color: '#1ABC9C',
    href: '/compress-pdf',
  },
  {
    id: 'rotate-pdf',
    title: 'Rotate PDF',
    description: 'Rotate your PDFs the way you need them.',
    icon: 'rotate',
    color: '#3498DB',
    href: '/rotate-pdf',
  },
] as const;
