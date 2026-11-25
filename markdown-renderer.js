// Render assistant Markdown using DOM nodes only.
window.HealMealMarkdownRenderer = new (class {
// Render the small, useful Markdown subset returned by the assistant with DOM
// nodes only.  Model output is never inserted as HTML, so it cannot run scripts.
renderMarkdown(container, markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    let index = 0;
    const isSpecial = (line, next) => /^(#{1,4})\s+/.test(line) || /^\s*([-*])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line) || /^\s{0,3}([-*_])\1\1+\s*$/.test(line) || (line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next || ''));

    while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) { index++; continue; }

        if (/^\s{0,3}([-*_])\1\1+\s*$/.test(line)) {
            container.appendChild(document.createElement('hr')); index++; continue;
        }
        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
            const el = document.createElement(`h${heading[1].length + 1}`);
            this.appendInlineMarkdown(el, heading[2]); container.appendChild(el); index++; continue;
        }
        if (line.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] || '')) {
            const table = document.createElement('table');
            const header = this.tableCells(line);
            const thead = table.createTHead(); const headerRow = thead.insertRow();
            header.forEach(cell => { const th = document.createElement('th'); this.appendInlineMarkdown(th, cell); headerRow.appendChild(th); });
            const tbody = table.createTBody(); index += 2;
            while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                const row = tbody.insertRow(); const cells = this.tableCells(lines[index]);
                header.forEach((_, cellIndex) => { const td = row.insertCell(); this.appendInlineMarkdown(td, cells[cellIndex] || ''); });
                index++;
            }
            const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; wrapper.appendChild(table); container.appendChild(wrapper); continue;
        }
        const listMatch = line.match(/^\s*([-*])\s+(.+)$/) || line.match(/^\s*(\d+)[.)]\s+(.+)$/);
        if (listMatch) {
            const ordered = /^\s*\d+[.)]\s+/.test(line); const list = document.createElement(ordered ? 'ol' : 'ul');
            while (index < lines.length) {
                const match = ordered ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/) : lines[index].match(/^\s*[-*]\s+(.+)$/);
                if (!match) break;
                const li = document.createElement('li'); this.appendInlineMarkdown(li, match[1]); list.appendChild(li); index++;
            }
            container.appendChild(list); continue;
        }
        const paragraph = [];
        while (index < lines.length && lines[index].trim() && !isSpecial(lines[index], lines[index + 1])) paragraph.push(lines[index++].trim());
        const p = document.createElement('p'); this.appendInlineMarkdown(p, paragraph.join(' ')); container.appendChild(p);
    }
}

tableCells(line) {
    return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

appendInlineMarkdown(element, value) {
    const token = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|<br\s*\/?>)/gi;
    let last = 0; let match;
    while ((match = token.exec(value)) !== null) {
        if (match.index > last) element.append(document.createTextNode(value.slice(last, match.index)));
        if (match[2] && match[3]) { const a = document.createElement('a'); a.href = match[3]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = match[2]; element.appendChild(a); }
        else if (match[4] || match[5]) { const strong = document.createElement('strong'); strong.textContent = match[4] || match[5]; element.appendChild(strong); }
        else if (match[6]) { const code = document.createElement('code'); code.textContent = match[6]; element.appendChild(code); }
        else if (match[7] || match[8]) { const em = document.createElement('em'); em.textContent = match[7] || match[8]; element.appendChild(em); }
        else { element.appendChild(document.createElement('br')); }
        last = token.lastIndex;
    }
    if (last < value.length) element.append(document.createTextNode(value.slice(last)));
}

toPlainText(markdown) {
    return String(markdown || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`#>|]/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/\|/g, ', ').replace(/\s+/g, ' ').trim();
}
})();
