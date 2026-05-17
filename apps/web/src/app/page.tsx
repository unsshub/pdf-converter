import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ToolCard from '@/components/ToolCard';
import { TOOLS } from '@pdf-converter/shared';

export default function HomePage() {
  return (
    <>
      <Header />
      
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-20 md:py-28">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight animate-fade-in-up">
              Every Tool You Need to
              <br />
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Work with PDFs
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8 animate-fade-in-up stagger-2">
              Convert, merge, split, compress, and edit your PDF files with incredible accuracy. 
              Fast, secure, and completely free.
            </p>

            <div className="max-w-xl mx-auto animate-fade-in-up stagger-3">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search for a tool... (e.g., PDF to Word)"
                  className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-transparent text-base"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
                All PDF Tools in One Place
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">
                Select a tool below to get started. Every tool is free and works right in your browser.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {TOOLS.map((tool, index) => (
                <ToolCard
                  key={tool.id}
                  title={tool.title}
                  description={tool.description}
                  icon={tool.icon}
                  color={tool.color}
                  href={tool.href}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 bg-slate-50 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm text-slate-400 mb-4">Powered by</p>
            <p className="text-lg font-semibold text-slate-600">
              Solid Documents Conversion Engine
            </p>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
              Industry-leading PDF conversion technology delivering incredible accuracy and preserving formatting, layouts, and fonts.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
