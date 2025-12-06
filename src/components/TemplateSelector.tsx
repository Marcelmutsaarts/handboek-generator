'use client';

import { useState } from 'react';
import { TemplateType, TemplateSection, TEMPLATES, getTemplate } from '@/types';

interface TemplateSelectorProps {
  value: TemplateType;
  customSecties: TemplateSection[];
  onChange: (template: TemplateType, customSecties: TemplateSection[]) => void;
  disabled?: boolean;
}

export default function TemplateSelector({
  value,
  customSecties,
  onChange,
  disabled = false,
}: TemplateSelectorProps) {
  const [showCustomEditor, setShowCustomEditor] = useState(value === 'custom');
  const [editingSecties, setEditingSecties] = useState<TemplateSection[]>(
    customSecties.length > 0 ? customSecties : [
      { titel: '', beschrijving: '', verplicht: true },
    ]
  );

  const handleTemplateSelect = (templateId: TemplateType) => {
    if (templateId === 'custom') {
      setShowCustomEditor(true);
      onChange(templateId, editingSecties.filter((s) => s.titel.trim()));
    } else {
      setShowCustomEditor(false);
      onChange(templateId, []);
    }
  };

  const handleAddSection = () => {
    const newSecties = [...editingSecties, { titel: '', beschrijving: '', verplicht: false }];
    setEditingSecties(newSecties);
  };

  const handleRemoveSection = (index: number) => {
    if (editingSecties.length <= 1) return;
    const newSecties = editingSecties.filter((_, i) => i !== index);
    setEditingSecties(newSecties);
    onChange('custom', newSecties.filter((s) => s.titel.trim()));
  };

  const handleSectionChange = (index: number, field: keyof TemplateSection, value: string | boolean) => {
    const newSecties = editingSecties.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    setEditingSecties(newSecties);
    onChange('custom', newSecties.filter((s) => s.titel.trim()));
  };

  const selectedTemplate = getTemplate(value);

  return (
    <div className="space-y-4">
      {/* Template keuze */}
      <div>
        <label className="block text-sm font-medium mb-3">
          Hoofdstuk template
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateSelect(template.id)}
              disabled={disabled}
              className={`p-3 rounded-lg border text-left transition-all ${
                value === template.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white border-border hover:border-primary'
              } disabled:opacity-50`}
            >
              <span className="text-lg block mb-1">{template.icon}</span>
              <span className="font-medium text-sm block">{template.naam}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Template beschrijving */}
      {selectedTemplate && value !== 'custom' && (
        <div className="bg-accent rounded-lg p-4">
          <p className="text-sm text-secondary mb-3">{selectedTemplate.beschrijving}</p>
          <div className="flex flex-wrap gap-2">
            {selectedTemplate.secties.map((sectie, index) => (
              <span
                key={index}
                className={`text-xs px-2 py-1 rounded ${
                  sectie.verplicht
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {sectie.titel}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Custom template editor */}
      {showCustomEditor && value === 'custom' && (
        <div className="bg-accent rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Stel je eigen secties samen</p>
            <button
              type="button"
              onClick={handleAddSection}
              disabled={disabled}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              + Sectie toevoegen
            </button>
          </div>

          <div className="space-y-3">
            {editingSecties.map((sectie, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-3 border border-border"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={sectie.titel}
                      onChange={(e) => handleSectionChange(index, 'titel', e.target.value)}
                      placeholder="Sectie titel"
                      disabled={disabled}
                      className="w-full px-3 py-2 text-sm rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                    <input
                      type="text"
                      value={sectie.beschrijving}
                      onChange={(e) => handleSectionChange(index, 'beschrijving', e.target.value)}
                      placeholder="Korte beschrijving van wat deze sectie moet bevatten"
                      disabled={disabled}
                      className="w-full px-3 py-2 text-sm rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </div>
                  {editingSecties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(index)}
                      disabled={disabled}
                      className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                      title="Verwijderen"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-secondary">
            Tip: Voeg minimaal 3-4 secties toe voor een goed gestructureerd hoofdstuk.
          </p>
        </div>
      )}
    </div>
  );
}
