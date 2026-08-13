const STORAGE_KEY = "markit.documents.v1";
const ACTIVE_KEY = "markit.activeDocument.v1";
const THEME_KEY = "markit.theme.v1";

const initialMarkdown = `# Meu projeto

Esse projeto foi desenvolvido utilizando **React**.

## Tecnologias

- React
- TypeScript
- Node.js
`;

const fallbackDocuments = [
  {
    id: crypto.randomUUID(),
    title: "meu-projeto.md",
    content: initialMarkdown,
    updatedAt: Date.now(),
  },
];

const elements = {
  editor: document.querySelector("#editor"),
  preview: document.querySelector("#preview"),
  fileName: document.querySelector("#fileName"),
  saveStatus: document.querySelector("#saveStatus"),
  documentList: document.querySelector("#documentList"),
  searchDocuments: document.querySelector("#searchDocuments"),
  newDocument: document.querySelector("#newDocument"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  exportButton: document.querySelector("#exportButton"),
  copyHtmlButton: document.querySelector("#copyHtmlButton"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  themeButton: document.querySelector("#themeButton"),
  lineNumbers: document.querySelector("#lineNumbers"),
  characterCount: document.querySelector("#characterCount"),
  cursorPosition: document.querySelector("#cursorPosition"),
  toast: document.querySelector("#toast"),
};

let documents = loadDocuments();
let activeId = localStorage.getItem(ACTIVE_KEY) || documents[0].id;
let saveTimer;

function loadDocuments() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : fallbackDocuments;
  } catch {
    return fallbackDocuments;
  }
}

function saveDocuments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  localStorage.setItem(ACTIVE_KEY, activeId);
}

function activeDocument() {
  return documents.find((document) => document.id === activeId) || documents[0];
}

function setActiveDocument(id) {
  activeId = id;
  const doc = activeDocument();
  elements.editor.value = doc.content;
  elements.fileName.value = doc.title;
  renderAll();
  saveDocuments();
}

function renderAll() {
  renderPreview();
  renderLineNumbers();
  renderDocuments();
  updateStats();
}

function renderDocuments() {
  const query = elements.searchDocuments.value.trim().toLowerCase();
  const filtered = documents
    .filter((document) => document.title.toLowerCase().includes(query))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  elements.documentList.innerHTML = "";

  filtered.forEach((doc) => {
    const item = document.createElement("button");
    item.className = `document-item${doc.id === activeId ? " active" : ""}`;
    item.type = "button";
    item.addEventListener("click", () => setActiveDocument(doc.id));

    item.innerHTML = `
      <span class="document-icon" aria-hidden="true">▧</span>
      <span>
        <span class="document-title"></span>
        <span class="document-date">${formatDate(doc.updatedAt)}</span>
      </span>
      <span class="delete-document" role="button" tabindex="0" title="Excluir">×</span>
    `;

    item.querySelector(".document-title").textContent = doc.title;
    item.querySelector(".delete-document").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteDocument(doc.id);
    });

    elements.documentList.appendChild(item);
  });
}

function deleteDocument(id) {
  if (documents.length === 1) {
    showToast("Mantenha pelo menos um documento.");
    return;
  }

  documents = documents.filter((document) => document.id !== id);
  if (activeId === id) {
    activeId = documents[0].id;
    setActiveDocument(activeId);
  }
  saveDocuments();
  renderDocuments();
  showToast("Documento removido.");
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();

  if (Date.now() - timestamp < 60_000) return "Agora mesmo";
  if (sameDay) {
    return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function renderLineNumbers() {
  const lines = elements.editor.value.split("\n").length;
  elements.lineNumbers.innerHTML = Array.from({ length: lines }, (_, index) => `<div>${index + 1}</div>`).join("");
}

function updateStats() {
  const { selectionStart, value } = elements.editor;
  const beforeCursor = value.slice(0, selectionStart);
  const line = beforeCursor.split("\n").length;
  const col = beforeCursor.length - beforeCursor.lastIndexOf("\n");

  elements.cursorPosition.textContent = `Ln ${line}, Col ${col}`;
  elements.characterCount.textContent = `${value.length} caracteres`;
}

function scheduleSave() {
  elements.saveStatus.textContent = "Salvando...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const doc = activeDocument();
    doc.content = elements.editor.value;
    doc.title = normalizeFileName(elements.fileName.value);
    doc.updatedAt = Date.now();
    saveDocuments();
    elements.saveStatus.textContent = "Salvo localmente";
    renderDocuments();
  }, 240);
}

function normalizeFileName(name) {
  const cleanName = name.trim() || "documento.md";
  return /\.(md|markdown)$/i.test(cleanName) ? cleanName : `${cleanName}.md`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
}

function parseMarkdown(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let listType = null;
  let inCode = false;
  let codeBuffer = [];
  let tableBuffer = [];

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const flushCode = () => {
    if (codeBuffer.length) {
      html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
      codeBuffer = [];
    }
  };

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      tableBuffer.forEach((line) => html.push(`<p>${inlineMarkdown(line)}</p>`));
      tableBuffer = [];
      return;
    }

    const rows = tableBuffer.filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line));
    const tableRows = rows.map((line, index) => {
      const cells = line
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => `<${index === 0 ? "th" : "td"}>${inlineMarkdown(cell.trim())}</${index === 0 ? "th" : "td"}>`)
        .join("");
      return `<tr>${cells}</tr>`;
    });

    html.push(`<table><tbody>${tableRows.join("")}</tbody></table>`);
    tableBuffer = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        closeList();
        flushTable();
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      return;
    }

    if (line.includes("|") && /^\s*\|?.+\|.+\|?\s*$/.test(line)) {
      closeList();
      tableBuffer.push(line);
      return;
    }

    flushTable();

    if (!line.trim()) {
      closeList();
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      html.push("<hr />");
      return;
    }

    if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      return;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);

    if (unordered || ordered) {
      const nextListType = ordered ? "ol" : "ul";
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        html.push(`<${listType}>`);
      }
      const content = unordered ? unordered[1] : ordered[1];
      const checked = content.match(/^\[( |x)]\s+(.+)$/i);
      if (checked) {
        const isChecked = checked[1].toLowerCase() === "x" ? " checked" : "";
        html.push(`<li><input type="checkbox" disabled${isChecked} /> ${inlineMarkdown(checked[2])}</li>`);
      } else {
        html.push(`<li>${inlineMarkdown(content)}</li>`);
      }
      return;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  });

  closeList();
  flushTable();
  if (inCode) flushCode();

  return html.join("\n");
}

function renderPreview() {
  elements.preview.innerHTML = parseMarkdown(elements.editor.value);
}

function insertAroundSelection(before, after = before) {
  const { selectionStart, selectionEnd, value } = elements.editor;
  const selected = value.slice(selectionStart, selectionEnd);
  const nextValue = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(selectionEnd)}`;

  elements.editor.value = nextValue;
  elements.editor.focus();
  elements.editor.setSelectionRange(selectionStart + before.length, selectionEnd + before.length);
  handleEditorInput();
}

function insertAtSelection(text) {
  const { selectionStart, selectionEnd, value } = elements.editor;
  elements.editor.value = `${value.slice(0, selectionStart)}${text}${value.slice(selectionEnd)}`;
  elements.editor.focus();
  elements.editor.setSelectionRange(selectionStart + text.length, selectionStart + text.length);
  handleEditorInput();
}

function prefixSelection(prefix) {
  const { selectionStart, selectionEnd, value } = elements.editor;
  const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const end = selectionEnd;
  const selected = value.slice(start, end);
  const nextSelected = selected
    .split("\n")
    .map((line) => (line.trim() ? `${prefix}${line}` : line))
    .join("\n");

  elements.editor.value = `${value.slice(0, start)}${nextSelected}${value.slice(end)}`;
  elements.editor.focus();
  elements.editor.setSelectionRange(selectionStart + prefix.length, selectionEnd + prefix.length);
  handleEditorInput();
}

function handleEditorInput() {
  renderPreview();
  renderLineNumbers();
  updateStats();
  scheduleSave();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove("visible"), 2200);
}

function createDocument(title = "novo-documento.md", content = "# Novo documento\n\nComece seu README aqui.\n") {
  const doc = {
    id: crypto.randomUUID(),
    title,
    content,
    updatedAt: Date.now(),
  };

  documents.unshift(doc);
  activeId = doc.id;
  saveDocuments();
  setActiveDocument(activeId);
  showToast("Documento criado.");
}

function exportMarkdown() {
  const doc = activeDocument();
  const blob = new Blob([elements.editor.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = normalizeFileName(doc.title);
  link.click();
  URL.revokeObjectURL(url);
  showToast("Arquivo .md exportado.");
}

async function copyHtml() {
  const html = parseMarkdown(elements.editor.value);
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(html);
  } else {
    const helper = document.createElement("textarea");
    helper.value = html;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  showToast("HTML copiado para a área de transferência.");
}

function importMarkdown(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    createDocument(file.name, String(reader.result || ""));
    showToast("Arquivo importado.");
  });
  reader.readAsText(file);
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
}

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  localStorage.setItem(THEME_KEY, theme);
}

document.querySelectorAll("[data-wrap]").forEach((button) => {
  button.addEventListener("click", () => insertAroundSelection(button.dataset.wrap));
});

document.querySelectorAll("[data-insert]").forEach((button) => {
  button.addEventListener("click", () => insertAtSelection(button.dataset.insert.replaceAll("\\n", "\n")));
});

document.querySelectorAll("[data-prefix]").forEach((button) => {
  button.addEventListener("click", () => prefixSelection(button.dataset.prefix));
});

document.querySelectorAll("[data-cheat]").forEach((button) => {
  button.addEventListener("click", () => insertAtSelection(button.dataset.cheat));
});

elements.editor.addEventListener("input", handleEditorInput);
elements.editor.addEventListener("click", updateStats);
elements.editor.addEventListener("keyup", updateStats);
elements.editor.addEventListener("scroll", () => {
  elements.lineNumbers.scrollTop = elements.editor.scrollTop;
});

elements.fileName.addEventListener("input", scheduleSave);
elements.fileName.addEventListener("blur", () => {
  elements.fileName.value = normalizeFileName(elements.fileName.value);
  scheduleSave();
});

elements.searchDocuments.addEventListener("input", renderDocuments);
elements.newDocument.addEventListener("click", () => createDocument());
elements.importButton.addEventListener("click", () => elements.importFile.click());
elements.importFile.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importMarkdown(file);
  event.target.value = "";
});
elements.exportButton.addEventListener("click", exportMarkdown);
elements.copyHtmlButton.addEventListener("click", copyHtml);
elements.fullscreenButton.addEventListener("click", toggleFullscreen);
elements.themeButton.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("light") ? "dark" : "light";
  applyTheme(nextTheme);
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    scheduleSave();
    showToast("Documento salvo localmente.");
  }
});

applyTheme(localStorage.getItem(THEME_KEY) || "dark");
setActiveDocument(activeId);
