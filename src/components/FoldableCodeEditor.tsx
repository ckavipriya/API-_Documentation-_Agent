import React, { useState, useEffect, useMemo } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Minimize2, 
  Maximize2, 
  Code, 
  Edit3, 
  Check, 
  HelpCircle,
  Eye
} from "lucide-react";

interface FoldRegion {
  start: number; // 0-indexed line
  end: number;   // 0-indexed line
  type: "brace" | "indent";
}

interface FoldableCodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  isEditable: boolean;
  filePath: string;
  highlightedLine?: number;
}

export function FoldableCodeEditor({
  code,
  onChange,
  isEditable,
  filePath,
  highlightedLine,
}: FoldableCodeEditorProps) {
  // Toggle between 'foldable' (interactive viewer) and 'raw' (edit mode)
  const [editorMode, setEditorMode] = useState<"foldable" | "raw">("foldable");
  const [localCode, setLocalCode] = useState(code);
  const [collapsedLineStarts, setCollapsedLineStarts] = useState<Set<number>>(new Set());

  // Scroll to highlighted line
  useEffect(() => {
    if (highlightedLine) {
      const element = document.getElementById(`code-line-${highlightedLine}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedLine]);

  // Keep local code in sync with external changes
  useEffect(() => {
    setLocalCode(code);
  }, [code]);

  // Reset folds when switching files
  useEffect(() => {
    setCollapsedLineStarts(new Set());
  }, [filePath]);

  // Split code into array of lines
  const lines = useMemo(() => localCode.split("\n"), [localCode]);

  // Determine language mode
  const isPython = useMemo(() => {
    return filePath.endsWith(".py") || (localCode.includes("def ") && !localCode.includes("{"));
  }, [filePath, localCode]);

  // Calculate indentation level
  const getIndentationLevel = (line: string): number => {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    return match[1].replace(/\t/g, "    ").length;
  };

  // Detect foldable regions based on braces or Python indents
  const regions = useMemo<FoldRegion[]>(() => {
    const detectedRegions: FoldRegion[] = [];
    if (lines.length <= 2) return detectedRegions;

    if (isPython) {
      // Python Indentation-based detection
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        // Look for block initiators ending in colon
        if (
          trimmed.endsWith(":") &&
          (trimmed.startsWith("def ") ||
            trimmed.startsWith("class ") ||
            trimmed.startsWith("if ") ||
            trimmed.startsWith("elif ") ||
            trimmed.startsWith("else") ||
            trimmed.startsWith("for ") ||
            trimmed.startsWith("while ") ||
            trimmed.startsWith("try") ||
            trimmed.startsWith("except ") ||
            trimmed.startsWith("with "))
        ) {
          const startIndent = getIndentationLevel(line);
          let endLine = i;

          // Find where this indentation block ends
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            const nextTrimmed = nextLine.trim();

            if (!nextTrimmed) continue; // Skip empty lines for ending check
            if (nextTrimmed.startsWith("#")) continue; // Skip comment lines

            const nextIndent = getIndentationLevel(nextLine);
            if (nextIndent <= startIndent) {
              endLine = j - 1;
              break;
            }
            endLine = j;
          }

          if (endLine - i >= 1) {
            detectedRegions.push({
              start: i,
              end: endLine,
              type: "indent",
            });
          }
        }
      }
    } else {
      // JS / TS / Java Braces-based detection
      const openLines: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Strip string literals & comments to avoid false-positive braces
        const cleanLine = line
          .replace(/\/\/.*$/, "")
          .replace(/\/\*.*?\*\//g, "")
          .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
          .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")
          .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, "``");

        for (let charIdx = 0; charIdx < cleanLine.length; charIdx++) {
          const char = cleanLine[charIdx];
          if (char === "{") {
            openLines.push(i);
          } else if (char === "}") {
            if (openLines.length > 0) {
              const start = openLines.pop()!;
              if (i - start >= 1) {
                detectedRegions.push({
                  start,
                  end: i,
                  type: "brace",
                });
              }
            }
          }
        }
      }
    }

    return detectedRegions;
  }, [lines, isPython]);

  // Get the most outer region starting at a specific line index
  const getRegionForLine = (lineIdx: number): FoldRegion | null => {
    const matching = regions.filter((r) => r.start === lineIdx);
    if (matching.length === 0) return null;
    matching.sort((a, b) => b.end - b.start - (a.end - a.start)); // Outermost first
    return matching[0];
  };

  // Toggle fold for a start line
  const toggleFold = (lineIdx: number) => {
    setCollapsedLineStarts((prev) => {
      const next = new Set(prev);
      if (next.has(lineIdx)) {
        next.delete(lineIdx);
      } else {
        next.add(lineIdx);
      }
      return next;
    });
  };

  // Fold all detected blocks
  const foldAll = () => {
    const starts = regions.map((r) => r.start);
    setCollapsedLineStarts(new Set(starts));
  };

  // Unfold all blocks
  const unfoldAll = () => {
    setCollapsedLineStarts(new Set());
  };

  // Save edits back to workspace state
  const handleSaveRawEdits = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalCode(val);
    onChange(val);
  };

  // Check if a line is hidden by any active collapsed parent block
  const isLineHidden = (lineIdx: number): boolean => {
    for (const startLine of collapsedLineStarts) {
      const region = getRegionForLine(startLine);
      if (region && lineIdx > region.start && lineIdx <= region.end) {
        return true;
      }
    }
    return false;
  };

  // Interactive dark theme code highlighter
  const highlightLine = (line: string) => {
    const trimmed = line.trim();
    const isComment =
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("#");

    if (isComment) {
      return <span className="text-slate-500 italic font-mono">{line}</span>;
    }

    let codePart = line;
    let commentPart = "";
    const commentIndex = isPython ? line.indexOf("#") : line.indexOf("//");
    if (commentIndex !== -1) {
      codePart = line.slice(0, commentIndex);
      commentPart = line.slice(commentIndex);
    }

    // Tokenize safely using word boundary splits
    const tokens = codePart.split(/(\b\w+\b|\s+|[^\w\s])/g).filter(Boolean);

    const jsxTokens = tokens.map((token, idx) => {
      const tTrimmed = token.trim();
      if (!tTrimmed) return <span key={idx}>{token}</span>;

      // Match common reserved words
      const isKeyword =
        /^(const|let|var|function|return|import|export|from|class|extends|interface|type|default|if|else|for|while|do|switch|case|try|catch|finally|throw|new|this|typeof|instanceof|async|await|public|private|protected|static|readonly|package|def|elif|except|with|as|in|is|not|and|or|lambda|pass|raise|assert|global|nonlocal|yield)$/.test(
          tTrimmed
        );
      if (isKeyword) {
        return (
          <span key={idx} className="text-violet-400 font-extrabold">
            {token}
          </span>
        );
      }

      // Numbers
      if (/^\d+$/.test(tTrimmed)) {
        return (
          <span key={idx} className="text-amber-400 font-mono">
            {token}
          </span>
        );
      }

      // Strings/quotes
      if (/^["'`]$/.test(tTrimmed)) {
        return (
          <span key={idx} className="text-emerald-400 font-semibold">
            {token}
          </span>
        );
      }

      // Capitalized types or class names
      const isClassOrType =
        /^[A-Z]\w*$/.test(tTrimmed) ||
        /^(string|number|boolean|any|void|unknown|never|object|Promise)$/.test(tTrimmed);
      if (isClassOrType) {
        return (
          <span key={idx} className="text-sky-400 font-bold">
            {token}
          </span>
        );
      }

      // Decorators or Python annotations
      if (token.startsWith("@")) {
        return (
          <span key={idx} className="text-pink-400 font-bold">
            {token}
          </span>
        );
      }

      // Method invocations/definitions
      if (idx < tokens.length - 1 && tokens[idx + 1] === "(") {
        return (
          <span key={idx} className="text-teal-300 font-bold">
            {token}
          </span>
        );
      }

      return <span key={idx}>{token}</span>;
    });

    return (
      <span className="font-mono text-xs text-slate-200">
        {jsxTokens}
        {commentPart && <span className="text-slate-500 italic">{commentPart}</span>}
      </span>
    );
  };

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-950 flex flex-col min-h-0 overflow-hidden shadow-xl" id="foldable-code-editor">
      {/* Action Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-indigo-400" />
          <span className="text-[11px] font-mono font-bold text-slate-300 truncate max-w-[240px]">
            {filePath.substring(filePath.lastIndexOf("/") + 1)}
          </span>
          <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-extrabold uppercase">
            {isPython ? "Python Mode" : "Curly-Brace Mode"}
          </span>
          <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-900 px-1.5 py-0.5 rounded font-bold">
            {regions.length} blocks found
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick fold/unfold actions */}
          {editorMode === "foldable" && regions.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg mr-1">
              <button
                onClick={foldAll}
                className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded transition flex items-center gap-1"
                title="Collapse all functions and classes"
              >
                <Minimize2 className="w-3 h-3" />
                Fold All
              </button>
              <span className="w-px h-3 bg-slate-800"></span>
              <button
                onClick={unfoldAll}
                className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded transition flex items-center gap-1"
                title="Expand all collapsed code"
              >
                <Maximize2 className="w-3 h-3" />
                Unfold All
              </button>
            </div>
          )}

          {/* Mode Selector */}
          {isEditable ? (
            <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg shadow-2xs">
              <button
                onClick={() => setEditorMode("foldable")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${
                  editorMode === "foldable"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Eye className="w-3 h-3" />
                Folding View
              </button>
              <button
                onClick={() => setEditorMode("raw")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${
                  editorMode === "raw"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Edit3 className="w-3 h-3" />
                Raw Edit
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-slate-500 font-semibold uppercase flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
              <Eye className="w-3 h-3 text-slate-400" />
              Folding Mode Active
            </span>
          )}
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-950 p-1 relative">
        {editorMode === "raw" && isEditable ? (
          <div className="w-full h-full min-h-[400px]">
            <textarea
              value={localCode}
              onChange={handleSaveRawEdits}
              className="w-full h-full min-h-[400px] font-mono text-xs p-4 bg-slate-950 text-slate-200 border-none outline-none focus:ring-0 leading-relaxed resize-y overflow-y-auto"
              style={{ tabSize: 4 }}
              placeholder="Write or edit code here..."
              id="raw-code-textarea"
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-900/10 py-2">
            {lines.map((line, idx) => {
              const isHidden = isLineHidden(idx);
              if (isHidden) return null;

              const region = getRegionForLine(idx);
              const isFolded = collapsedLineStarts.has(idx);

              return (
                <div key={idx} className={`flex ${highlightedLine === idx + 1 ? 'bg-indigo-900/30' : 'hover:bg-slate-900/50'} group select-none relative`} id={`code-line-${idx + 1}`}>
                  {/* Gutter (Line numbers & Fold handles) */}
                  <div className={`w-12 select-none flex items-center justify-between pr-2 border-r border-slate-900 mr-4 shrink-0 ${highlightedLine === idx + 1 ? 'bg-indigo-950/50' : 'bg-slate-950'}`}>
                    <span className="text-[10px] font-mono w-full text-right font-medium text-slate-500">
                      {idx + 1}
                    </span>
                    <span className="w-4 h-4 flex items-center justify-center">
                      {region && (
                        <button
                          onClick={() => toggleFold(idx)}
                          className="text-slate-500 hover:text-indigo-400 hover:bg-slate-900 p-0.5 rounded transition cursor-pointer"
                          title={isFolded ? "Expand Block" : "Collapse Block"}
                        >
                          {isFolded ? (
                            <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Code Line Content */}
                  <div className="flex-1 overflow-x-auto py-0.5 flex items-center gap-2 whitespace-pre min-w-0 pr-4 font-mono text-xs">
                    {highlightLine(line)}

                    {isFolded && (
                      <button
                        onClick={() => toggleFold(idx)}
                        className="ml-2 inline-flex items-center px-2 py-0.5 text-[9px] font-mono font-bold text-indigo-400 bg-indigo-950/80 hover:bg-indigo-900 hover:text-white rounded-md border border-indigo-900 transition shadow-xs animate-pulse cursor-pointer"
                        title="Click to expand code segment"
                      >
                        {region?.type === "indent" ? " ... (block collapsed)" : " {...} "}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Help Legend Bar */}
      {editorMode === "foldable" && (
        <div className="bg-slate-900 border-t border-slate-800 p-2 px-3 text-[10px] text-slate-500 flex justify-between items-center shrink-0 font-medium">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400" />
            Click arrows in the gutter or the folded badges to expand/collapse.
          </span>
          <span className="font-mono text-slate-400 text-[9px]">
            Line 1 to {lines.length}
          </span>
        </div>
      )}
    </div>
  );
}
