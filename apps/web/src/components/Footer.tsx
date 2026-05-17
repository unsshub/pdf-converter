'use client';

export default function Footer() {
  return (
    <footer className="bg-slate-900 dark:bg-slate-950 text-slate-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">
                PDF<span className="text-red-500">Converter</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              Every tool you need to use PDFs, at your fingertips. 
              Convert, merge, split, compress and edit your PDF files with incredible accuracy.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Convert</h3>
            <ul className="space-y-2">
              {['PDF to Word', 'PDF to Excel', 'PDF to PowerPoint', 'Word to PDF'].map((tool) => (
                <li key={tool}>
                  <a href="#" className="text-sm hover:text-white transition-colors">{tool}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Tools</h3>
            <ul className="space-y-2">
              {['Merge PDF', 'Split PDF', 'Compress PDF', 'Rotate PDF'].map((tool) => (
                <li key={tool}>
                  <a href="#" className="text-sm hover:text-white transition-colors">{tool}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">© PDFConverter 2026 - Your PDF Editor</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-sm hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
