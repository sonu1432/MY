import React, { useState } from 'react';
import { ANDROID_PROJECT_FILES, AndroidFile } from '../data/androidProjectFiles';
import JSZip from 'jszip';
import { Download, Copy, Check, FileCode, Folder, Smartphone, Terminal, ExternalLink } from 'lucide-react';

interface AndroidProjectExplorerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidProjectExplorer: React.FC<AndroidProjectExplorerProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<AndroidFile>(ANDROID_PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsExporting(true);
      const zip = new JSZip();

      // Root build files
      zip.file(
        'build.gradle',
        `// Top-level build file
plugins {
    id 'com.android.application' version '8.2.2' apply false
    id 'org.jetbrains.kotlin.android' version '1.9.22' apply false
    id 'org.jetbrains.kotlin.kapt' version '1.9.22' apply false
}
`
      );

      zip.file(
        'settings.gradle',
        `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "MYRA"
include ':app'
`
      );

      zip.file(
        'README.md',
        `# MYRA — Android AI Voice Assistant
Complete Production-ready Android App with Gemini Live WebSocket, 7-layer Canvas Orb, and Phone Automation.

### Requirements:
- Android Studio Iguana / Jellyfish or newer
- JDK 17
- Min SDK 26, Target SDK 34

### Quick Setup:
1. Open this unzipped directory in Android Studio.
2. Let Gradle sync dependencies.
3. Open \`SettingsActivity\` or set your \`api_key\` in SharedPreferences.
4. Run on a physical Android device or emulator with microphone enabled.
`
      );

      // Add all project files
      for (const file of ANDROID_PROJECT_FILES) {
        zip.file(file.path, file.content);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'MYRA-Android-Voice-Assistant-Source.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-lg">
      <div className="relative w-full max-w-5xl h-[90vh] flex flex-col bg-[#090909] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#0E0E0E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF1744] to-[#D500F9] flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,23,68,0.5)]">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-['Syne',sans-serif] tracking-wider text-white">
                ANDROID STUDIO PROJECT EXPORTER
              </h2>
              <p className="text-[10px] text-zinc-400 font-mono">
                Kotlin · MVVM · Gemini Live WebSocket · Min SDK 26 · Target SDK 34
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadZip}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF1744] to-[#D500F9] hover:brightness-110 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-[0_0_18px_rgba(255,23,68,0.35)] transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'PACKAGING ZIP...' : 'DOWNLOAD PROJECT (.ZIP)'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300"
            >
              Close
            </button>
          </div>
        </div>

        {/* Explorer Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Tree Sidebar */}
          <div className="w-72 bg-[#0C0C0C] border-r border-zinc-800/80 flex flex-col overflow-y-auto p-3 space-y-1 scrollbar-thin">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-2 py-1 flex items-center gap-1.5">
              <Folder className="w-3 h-3 text-[#FF1744]" />
              Project Files ({ANDROID_PROJECT_FILES.length})
            </div>

            {ANDROID_PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-[#1F0408] text-white border border-[#FF1744]/60 shadow-[0_0_10px_rgba(255,23,68,0.2)]'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode
                      className={`w-3.5 h-3.5 shrink-0 ${
                        file.language === 'kotlin'
                          ? 'text-[#D500F9]'
                          : file.language === 'xml'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono ${
                      file.category === 'kotlin'
                        ? 'bg-purple-950/60 text-purple-300'
                        : file.category === 'layout'
                        ? 'bg-blue-950/60 text-blue-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {file.category}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Code Viewer */}
          <div className="flex-1 flex flex-col bg-[#060606] overflow-hidden">
            {/* File Path Banner */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-[#0A0A0A] border-b border-zinc-800/80 text-xs font-mono">
              <div className="text-zinc-400 flex items-center gap-2">
                <span className="text-zinc-600">Path:</span>
                <span className="text-[#FF1744]">{selectedFile.path}</span>
              </div>
              <button
                onClick={handleCopy}
                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto p-5 scrollbar-thin scrollbar-thumb-zinc-800">
              <pre className="font-mono text-xs leading-relaxed text-zinc-300 select-text whitespace-pre font-normal">
                {selectedFile.content}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
