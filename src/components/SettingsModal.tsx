import React, { useState } from 'react';
import { AssistantSettings, PersonalityMode, PrimeContact } from '../types/assistant';
import { X, Plus, Trash2, CheckCircle2, AlertCircle, ShieldCheck, Sparkles, Key, User, Mic2, Cpu } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AssistantSettings;
  onSave: (newSettings: AssistantSettings) => void;
}

const VOICE_OPTIONS = [
  { id: 'Aoede', name: 'Aoede (Female — Warm)', desc: 'Default, lyrical & sweet' },
  { id: 'Charon', name: 'Charon (Male — Deep)', desc: 'Calm and steady' },
  { id: 'Kore', name: 'Kore (Female — Crisp)', desc: 'Clear and bright' },
  { id: 'Fenrir', name: 'Fenrir (Male — Husky)', desc: 'Bold and authoritative' },
  { id: 'Puck', name: 'Puck (Male — Playful)', desc: 'Energetic and upbeat' },
  { id: 'Leda', name: 'Leda (Female — Gentle)', desc: 'Soft and reassuring' },
  { id: 'Orus', name: 'Orus (Male — Smooth)', desc: 'Polished executive' },
  { id: 'Zephyr', name: 'Zephyr (Female — Fresh)', desc: 'Modern and vibrant' },
];

const MODEL_OPTIONS = [
  { id: 'models/gemini-2.5-flash-native-audio-preview-12-2025', label: 'Native Audio (Human Voice) — DEFAULT' },
  { id: 'models/gemini-2.0-flash-live-001', label: 'Flash Live (Fast)' },
  { id: 'models/gemini-2.5-flash-preview-native-audio-dialog', label: 'Pro Audio Dialog' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Server Core)' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [userName, setUserName] = useState(settings.userName);
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>(settings.personalityMode);
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel);
  const [geminiVoice, setGeminiVoice] = useState(settings.geminiVoice);
  const [primeContacts, setPrimeContacts] = useState<PrimeContact[]>([...settings.primeContacts]);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(settings.accessibilityEnabled);

  // New Contact dialog state
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [newContactRel, setNewContactRel] = useState('Close Friend');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactNumber.trim()) {
      showToast('Please enter both contact name and number');
      return;
    }
    const newEntry: PrimeContact = {
      id: Date.now().toString(),
      name: newContactName.trim(),
      number: newContactNumber.trim(),
      relationship: newContactRel,
    };
    setPrimeContacts([...primeContacts, newEntry]);
    setNewContactName('');
    setNewContactNumber('');
    setShowAddContact(false);
    showToast(`Added ${newEntry.name} to Prime Contacts`);
  };

  const handleDeleteContact = (id: string) => {
    setPrimeContacts(primeContacts.filter((c) => c.id !== id));
    showToast('Prime contact removed');
  };

  const handleSave = () => {
    onSave({
      ...settings,
      apiKey: apiKey.trim(),
      userName: userName.trim() || 'User',
      personalityMode,
      geminiModel,
      geminiVoice,
      primeContacts,
      accessibilityEnabled,
    });
    showToast('Restart app to apply changes ✅');
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-[#0A0A0A] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-zinc-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#0F0F0F]">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#FF1744] shadow-[0_0_10px_#FF1744]" />
            <h2 className="text-base font-bold font-['Syne',sans-serif] tracking-wider text-white">
              MYRA SETTINGS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-[#FF1744]" />
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave empty to use Server default GEMINI_API_KEY"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-zinc-800 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF1744] focus:ring-1 focus:ring-[#FF1744]/40"
            />
            <p className="text-[10px] text-zinc-500 font-mono">
              Server environment auto-provides injected Gemini API Key if left blank.
            </p>
          </div>

          {/* User Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#FF1744]" />
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Sonu"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF1744]"
            />
          </div>

          {/* Personality Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#D500F9]" />
              Personality Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'gf' as PersonalityMode,
                  title: 'GF Mode 💖',
                  desc: 'Hinglish, warm, caring & emotionally expressive.',
                },
                {
                  id: 'professional' as PersonalityMode,
                  title: 'Professional 💼',
                  desc: 'Formal concise English only. Zero emojis.',
                },
                {
                  id: 'assistant' as PersonalityMode,
                  title: 'Assistant 🤖',
                  desc: 'Friendly Hinglish/English. Balanced & fast.',
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonalityMode(p.id)}
                  className={`p-3 rounded-2xl text-left border transition-all ${
                    personalityMode === p.id
                      ? 'bg-[#1C0005] border-[#FF1744] shadow-[0_0_14px_rgba(255,23,68,0.25)]'
                      : 'bg-[#141414] border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-semibold text-xs text-white mb-1">{p.title}</div>
                  <div className="text-[10px] text-zinc-400 leading-snug">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Spinner */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <Mic2 className="w-3.5 h-3.5 text-[#FF1744]" />
              Voice Selection
            </label>
            <select
              value={geminiVoice}
              onChange={(e) => setGeminiVoice(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#141414] border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-[#FF1744]"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#141414] text-white">
                  {v.name} — {v.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Model Spinner */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#FF1744]" />
              AI Model
            </label>
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#141414] border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-[#FF1744]"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#141414] text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Prime Contacts Section */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white">⭐ Prime Contacts</span>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Saved to SharedPreferences (prime_contacts_json)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddContact(true)}
                className="px-3 py-1.5 rounded-xl bg-[#1E050A] hover:bg-[#2E0510] text-[#FF1744] border border-[#FF1744]/40 text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Contact
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-thin">
              {primeContacts.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#111111] border border-zinc-800 text-center text-[11px] text-zinc-500 font-mono">
                  No prime contacts added yet.
                </div>
              ) : (
                primeContacts.map((contact, idx) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#1A0308]/60 border border-[#FF1744]/30 hover:border-[#FF1744]/60 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF1744]" />
                        {contact.name}
                        {contact.relationship && (
                          <span className="text-[10px] text-[#FF1744] font-normal">
                            ({contact.relationship})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {contact.number} · Index #{idx}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Accessibility Service Toggle Status */}
          <div className="pt-2 border-t border-zinc-800/80">
            <div
              onClick={() => setAccessibilityEnabled(!accessibilityEnabled)}
              className="flex items-center justify-between p-3 rounded-2xl bg-[#141414] border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    accessibilityEnabled ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-semibold text-zinc-200">
                    AccessibilityHelperService
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Required for app closing, typing, scrolling gestures
                  </div>
                </div>
              </div>
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                  accessibilityEnabled
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50'
                    : 'bg-red-950/70 text-red-300 border border-red-800/50'
                }`}
              >
                {accessibilityEnabled ? 'ACTIVE ✅' : 'INACTIVE ❌'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer / Save Button */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-[#0F0F0F] flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 font-mono">
            {toastMsg || 'All changes persist to storage'}
          </div>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF1744] to-[#D500F9] text-white font-bold text-xs shadow-[0_0_18px_rgba(255,23,68,0.4)] hover:brightness-110 active:scale-95 transition-all"
          >
            SAVE CHANGES
          </button>
        </div>

        {/* Nested Add Contact Dialog */}
        {showAddContact && (
          <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[#111111] border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-white font-['Syne',sans-serif]">
                ADD PRIME CONTACT
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                    Contact Name:
                  </label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g. Priya or Mom"
                    className="w-full px-3 py-2 rounded-xl bg-[#181818] border border-zinc-700 text-xs text-white focus:outline-none focus:border-[#FF1744]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                    Phone Number:
                  </label>
                  <input
                    type="tel"
                    value={newContactNumber}
                    onChange={(e) => setNewContactNumber(e.target.value)}
                    placeholder="e.g. +919876543210"
                    className="w-full px-3 py-2 rounded-xl bg-[#181818] border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-[#FF1744]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                    Relationship Tag:
                  </label>
                  <input
                    type="text"
                    value={newContactRel}
                    onChange={(e) => setNewContactRel(e.target.value)}
                    placeholder="e.g. Close Friend / Love / Family"
                    className="w-full px-3 py-2 rounded-xl bg-[#181818] border border-zinc-700 text-xs text-white focus:outline-none focus:border-[#FF1744]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="px-4 py-2 rounded-xl bg-[#FF1744] text-white text-xs font-bold hover:bg-[#FF1744]/90"
                >
                  Add Contact
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
