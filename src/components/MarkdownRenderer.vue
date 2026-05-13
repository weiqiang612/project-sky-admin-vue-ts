<template>
  <div
    class="markdown-renderer"
    v-html="renderedContent"
  />
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

@Component({
  name: 'MarkdownRenderer',
})
export default class extends Vue {
  @Prop({ required: true, type: String }) readonly content!: string

  private md: MarkdownIt | null = null
  private renderedContent = ''

  private get markdownIt(): MarkdownIt {
    if (!this.md) {
      this.md = new MarkdownIt({
        html: false,
        linkify: true,
        breaks: true,
        langPrefix: 'language-',
        highlight: (str: string, lang: string): string => {
          if (lang && hljs.getLanguage(lang)) {
            try {
              const highlighted = hljs.highlight(str, {
                language: lang,
                ignoreIllegals: true,
              }).value
              return this.wrapCodeBlock(str, highlighted, lang)
            } catch (_) {
              /* fallthrough */
            }
          }
          return this.wrapCodeBlock(str, this.md!.utils.escapeHtml(str), '')
        },
      })

      // 覆写图片渲染：使用原生 <img>（v-html 不支持 Vue 组件）
      this.md.renderer.rules.image = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const src = token.attrGet('src') || ''
        const alt = token.content || ''

        return `<span class="markdown-renderer__image-wrapper">
          <img
            class="markdown-renderer__image"
            src="${this.md!.utils.escapeHtml(src)}"
            alt="${this.md!.utils.escapeHtml(alt)}"
            loading="lazy"
            onclick="window.open(this.src, '_blank')"
          />
        </span>`
      }
    }
    return this.md
  }

  @Watch('content', { immediate: true })
  private onContentChange(content: string) {
    if (!content) {
      this.renderedContent = ''
      return
    }
    this.renderedContent = this.markdownIt.render(content)
  }

  private wrapCodeBlock(raw: string, highlighted: string, lang: string) {
    const langLabel = lang
      ? `<span class="markdown-renderer__code-lang">${lang}</span>`
      : ''
    return `<div class="markdown-renderer__code-block">
      <div class="markdown-renderer__code-header">
        ${langLabel}
        <button
          class="markdown-renderer__copy-btn"
          data-code="${this.md!.utils.escapeHtml(raw)}"
          onclick="(function(btn){
            var code = btn.getAttribute('data-code');
            navigator.clipboard.writeText(code).catch(function(){});
            btn.textContent = 'Copied!';
            setTimeout(function(){ btn.textContent = 'Copy'; }, 2000);
          })(this)"
        >Copy</button>
      </div>
      <pre class="markdown-renderer__code-pre"><code class="markdown-renderer__code-content">${highlighted}</code></pre>
    </div>`
  }
}
</script>

<style lang="scss">
.markdown-renderer {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  color: #111;

  // —— 段落 ——
  p {
    margin: 0 0 8px;
    &:last-child {
      margin-bottom: 0;
    }
  }

  // —— 标题 ——
  h1, h2, h3, h4, h5, h6 {
    margin: 12px 0 6px;
    font-weight: 600;
    line-height: 1.3;
    color: #111;
  }
  h1 { font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  h2 { font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
  h3 { font-size: 15px; }
  h4, h5, h6 { font-size: 14px; }

  // —— 列表 ——
  ul, ol {
    margin: 4px 0 8px;
    padding-left: 20px;
    &:last-child { margin-bottom: 0; }
  }
  li {
    margin-bottom: 2px;
    &:last-child { margin-bottom: 0; }
  }

  // —— 行内代码 ——
  code {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12.5px;
    padding: 1px 5px;
    border-radius: 4px;
    background: #f4f4f4;
    color: #d63384;
  }

  // —— 代码块 ——
  &__code-block {
    margin: 8px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e0e0e0;
    font-size: 12.5px;
    &:last-child { margin-bottom: 0; }
  }

  &__code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: #1e1e1e;
    border-bottom: 1px solid #333;
  }

  &__code-lang {
    font-size: 11px;
    color: #999;
    text-transform: uppercase;
  }

  &__copy-btn {
    padding: 2px 10px;
    font-size: 11px;
    font-family: inherit;
    border: 1px solid #555;
    border-radius: 4px;
    background: transparent;
    color: #ccc;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    &:hover {
      background: #444;
      color: #fff;
    }
  }

  &__code-pre {
    margin: 0;
    padding: 12px;
    background: #1e1e1e;
    overflow-x: auto;
  }

  &__code-content {
    background: transparent !important;
    padding: 0 !important;
    border-radius: 0 !important;
    color: #d4d4d4 !important;
    font-family: Consolas, 'Courier New', monospace !important;
    font-size: 12.5px;
    line-height: 1.5;
  }

  // —— 引用 ——
  blockquote {
    margin: 8px 0;
    padding: 4px 12px;
    border-left: 3px solid #2d5bdb;
    background: #f8f9ff;
    border-radius: 0 4px 4px 0;
    color: #555;
    p { margin: 4px 0; }
  }

  // —— 表格 ——
  table {
    width: 100%;
    margin: 8px 0;
    border-collapse: collapse;
    font-size: 12.5px;
    &:last-child { margin-bottom: 0; }
  }
  th, td {
    padding: 6px 10px;
    border: 1px solid #e0e0e0;
    text-align: left;
  }
  th {
    background: #f5f5f5;
    font-weight: 600;
  }
  tr:nth-child(even) td {
    background: #fafafa;
  }

  // —— 链接 ——
  a {
    color: #2d5bdb;
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }

  // —— 图片 ——
  &__image-wrapper {
    display: block;
    margin: 8px 0;
    line-height: 0;
    &:last-child { margin-bottom: 0; }
  }

  &__image {
    max-width: 100%;
    max-height: 240px;
    border-radius: 8px;
    cursor: zoom-in;
  }

  // —— 水平线 ——
  hr {
    margin: 12px 0;
    border: none;
    border-top: 1px solid #e0e0e0;
  }

  // —— 强调 ——
  strong { font-weight: 600; }
  em { font-style: italic; }
}
</style>
