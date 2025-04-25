import * as monaco from 'monaco-editor'

class CeebluePluginExample extends HTMLElement {
  #editor: monaco.editor.IStandaloneCodeEditor | undefined = undefined;
  #wrapper: HTMLElement | undefined = undefined;
  #observer: MutationObserver | undefined = undefined;

  connectedCallback () {
    const codeEl = this.querySelector('pre code');
    const initial = (codeEl
      ? codeEl.textContent
      : this.textContent?.trim()) || '';

    this.#wrapper = document.createElement('div')
    Object.assign(this.#wrapper.style, {
      display: 'grid',
      gap: '1rem',
      gridTemplateColumns: '1fr',
      fontFamily: 'system-ui, sans-serif',
      marginTop: '1rem'
    })

    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        .ceeblue-plugin-example-wrapper {
          grid-template-columns: 1fr;
        }
      }
    `
    document.head.appendChild(style)
    this.#wrapper.classList.add('ceeblue-plugin-example-wrapper')

    const frame = Object.assign(document.createElement('iframe'), {
      style: 'width:100%;aspect-ratio:16/9.2;border:1px solid #ccc;border-radius:6px;'
    })
    const editorBox = Object.assign(document.createElement('div'), {
      style: 'height:400px;border:1px solid #ccc;border-radius:6px;'
    })
    this.#wrapper.append(frame, editorBox)

    this.insertAdjacentElement('afterend', this.#wrapper)
    this.style.display = 'none';

    // Initialize editor with theme based on current document class
    const isDark = document.documentElement.classList.contains('dark')
    this.#editor = monaco.editor.create(editorBox, {
      value: initial,
      language: 'html',
      theme: isDark ? 'vs-dark' : 'vs',
      automaticLayout: true
    })

    // VitePress theme change observer
    this.#observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark')
          monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs')
        }
      })
    })

    this.#observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    const render = () => (frame.srcdoc = this.#editor?.getValue() || '')
    render()
    this.#editor.onDidChangeModelContent(render)
  }

  disconnectedCallback () {
    this.#observer?.disconnect()
    this.#editor?.dispose()
    this.#wrapper?.remove()
  }
}

customElements.define('ceeblue-plugin-example', CeebluePluginExample)
export default CeebluePluginExample