'use client';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function DocsPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/docs/user-manual.md')
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erreur chargement doc:', err);
        setContent('# Documentation\n\nDocumentation non disponible pour le moment.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #e5ebe8', borderTopColor: '#2d7a3e', 
          borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        <p style={{ marginTop: '1rem', color: '#6b7c74' }}>Chargement de la documentation...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem', background: 'white', minHeight: '100vh' }}>
      <div style={{ borderBottom: '1px solid #e5ebe8', marginBottom: '2rem', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a1f1d', margin: 0 }}>
          📖 Guide Utilisateur - Campagnes WhatsApp
        </h1>
        <p style={{ color: '#6b7c74', marginTop: '0.5rem' }}>
          Documentation complète de la plateforme NumericExport
        </p>
      </div>
      
      <div className="markdown-body" style={{ lineHeight: 1.6, color: '#1a1f1d' }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>

      <style jsx global>{`
        .markdown-body h1 { font-size: 1.8rem; margin: 1.5rem 0 1rem; color: #2d7a3e; }
        .markdown-body h2 { font-size: 1.5rem; margin: 1.2rem 0 0.8rem; padding-bottom: 0.3rem; border-bottom: 1px solid #e5ebe8; }
        .markdown-body h3 { font-size: 1.2rem; margin: 1rem 0 0.5rem; }
        .markdown-body h4 { font-size: 1rem; margin: 0.8rem 0 0.4rem; color: #1976d2; }
        .markdown-body p { margin: 0.8rem 0; line-height: 1.6; }
        .markdown-body code { background: #f8faf9; padding: 0.2rem 0.4rem; border-radius: 6px; font-family: monospace; font-size: 0.9em; }
        .markdown-body pre { background: #f8faf9; padding: 1rem; border-radius: 8px; overflow-x: auto; }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
        .markdown-body th, .markdown-body td { border: 1px solid #e5ebe8; padding: 0.5rem; text-align: left; }
        .markdown-body th { background: #f8faf9; font-weight: 600; }
        .markdown-body ul, .markdown-body ol { margin: 0.8rem 0; padding-left: 1.5rem; }
        .markdown-body li { margin: 0.3rem 0; }
        .markdown-body blockquote { border-left: 4px solid #2d7a3e; margin: 1rem 0; padding-left: 1rem; color: #6b7c74; }
        .markdown-body hr { border: none; border-top: 1px solid #e5ebe8; margin: 2rem 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
