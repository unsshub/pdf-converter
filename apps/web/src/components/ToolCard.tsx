'use client';

import Link from 'next/link';

interface ToolCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  href: string;
  index?: number;
}

function ToolIcon({ icon, color }: { icon: string; color: string }) {
  const iconMap: Record<string, JSX.Element> = {
    'file-word': (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 9h6M9 17h4" />
      </svg>
    ),
    'file-excel': (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11l2 2 4-4" />
      </svg>
    ),
    'file-powerpoint': (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <circle cx="12" cy="14" r="3" />
      </svg>
    ),
    'file-pdf': (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 8h6M9 16h4" />
      </svg>
    ),
    'merge': (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H5a2 2 0 00-2 2v3m18 0V6a2 2 0 00-2-2h-3m0 14h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M12 9v6" />
      </svg>
    ),
    'split': (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-8 18v-4m8 4v-4M3 8h4m10 0h4M3 16h4m10 0h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16" strokeDasharray="3 3" />
      </svg>
    ),
    'compress': (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14" />
      </svg>
    ),
    'rotate': (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  };

  return iconMap[icon] || iconMap['file-pdf'];
}

export default function ToolCard({ title, description, icon, color, href, index = 0 }: ToolCardProps) {
  return (
    <Link 
      href={href}
      className={`group relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:border-transparent hover:-translate-y-1 transition-all duration-300 animate-fade-in-up stagger-${index + 1}`}
      style={{
        ['--tool-color' as string]: color,
      }}
    >
      <div 
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
        style={{ background: `${color}15` }}
      />
      
      <div 
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
        style={{ backgroundColor: `${color}15` }}
      >
        <ToolIcon icon={icon} color={color} />
      </div>

      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1 group-hover:text-slate-900 dark:group-hover:text-slate-100">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        {description}
      </p>

      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
