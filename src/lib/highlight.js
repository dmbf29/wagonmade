import hljs from 'highlight.js/lib/core'
import ruby from 'highlight.js/lib/languages/ruby'
import erb from 'highlight.js/lib/languages/erb'
import javascript from 'highlight.js/lib/languages/javascript'
import scss from 'highlight.js/lib/languages/scss'
import yaml from 'highlight.js/lib/languages/yaml'
import xml from 'highlight.js/lib/languages/xml'

hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('erb', erb)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('scss', scss)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('xml', xml)

const BY_EXT = { rb: 'ruby', erb: 'erb', js: 'javascript', scss: 'scss', css: 'scss', yml: 'yaml', yaml: 'yaml', html: 'xml' }

export function highlight(code, filename = '') {
  const lang = BY_EXT[filename.split('.').pop()] || (/<%|<\/?[a-z]/.test(code) ? 'erb' : /\bdef |\bend\b/.test(code) ? 'ruby' : 'javascript')
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
  } catch {
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  }
}
