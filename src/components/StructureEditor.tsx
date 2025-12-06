'use client';

import { useState } from 'react';
import { HoofdstukPlan } from '@/types';

interface StructureEditorProps {
  structuur: HoofdstukPlan[];
  onChange: (structuur: HoofdstukPlan[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export default function StructureEditor({
  structuur,
  onChange,
  disabled = false,
  readOnly = false,
}: StructureEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ titel: '', beschrijving: '' });

  const handleAdd = () => {
    const newHoofdstuk: HoofdstukPlan = {
      id: `plan-${Date.now()}`,
      titel: '',
      beschrijving: '',
      status: 'pending',
    };
    onChange([...structuur, newHoofdstuk]);
    setEditingId(newHoofdstuk.id);
    setEditForm({ titel: '', beschrijving: '' });
  };

  const handleEdit = (hoofdstuk: HoofdstukPlan) => {
    setEditingId(hoofdstuk.id);
    setEditForm({ titel: hoofdstuk.titel, beschrijving: hoofdstuk.beschrijving });
  };

  const handleSave = (id: string) => {
    if (!editForm.titel.trim()) {
      // Verwijder lege items
      onChange(structuur.filter((h) => h.id !== id));
    } else {
      onChange(
        structuur.map((h) =>
          h.id === id ? { ...h, titel: editForm.titel, beschrijving: editForm.beschrijving } : h
        )
      );
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onChange(structuur.filter((h) => h.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newStructuur = [...structuur];
    [newStructuur[index - 1], newStructuur[index]] = [newStructuur[index], newStructuur[index - 1]];
    onChange(newStructuur);
  };

  const handleMoveDown = (index: number) => {
    if (index === structuur.length - 1) return;
    const newStructuur = [...structuur];
    [newStructuur[index], newStructuur[index + 1]] = [newStructuur[index + 1], newStructuur[index]];
    onChange(newStructuur);
  };

  if (structuur.length === 0 && readOnly) {
    return (
      <div className="text-center py-8 text-secondary">
        Geen hoofdstukindeling beschikbaar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {structuur.map((hoofdstuk, index) => (
        <div
          key={hoofdstuk.id}
          className={`bg-white rounded-lg border transition-all ${
            hoofdstuk.status === 'generated'
              ? 'border-green-300 bg-green-50'
              : 'border-border'
          } ${editingId === hoofdstuk.id ? 'ring-2 ring-primary' : ''}`}
        >
          {editingId === hoofdstuk.id ? (
            // Edit mode
            <div className="p-4 space-y-3">
              <input
                type="text"
                value={editForm.titel}
                onChange={(e) => setEditForm({ ...editForm, titel: e.target.value })}
                placeholder="Hoofdstuk titel"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                disabled={disabled}
              />
              <textarea
                value={editForm.beschrijving}
                onChange={(e) => setEditForm({ ...editForm, beschrijving: e.target.value })}
                placeholder="Korte beschrijving van wat dit hoofdstuk behandelt..."
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                disabled={disabled}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(hoofdstuk.id)}
                  disabled={disabled}
                  className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
                >
                  Opslaan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hoofdstuk.titel) {
                      handleDelete(hoofdstuk.id);
                    }
                    setEditingId(null);
                  }}
                  disabled={disabled}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent disabled:opacity-50"
                >
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            // View mode
            <div className="p-4 flex items-start gap-3">
              {/* Nummer */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                  hoofdstuk.status === 'generated'
                    ? 'bg-green-200 text-green-800'
                    : 'bg-accent text-secondary'
                }`}
              >
                {hoofdstuk.status === 'generated' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground">{hoofdstuk.titel || 'Geen titel'}</h3>
                {hoofdstuk.beschrijving && (
                  <p className="text-sm text-secondary mt-0.5">{hoofdstuk.beschrijving}</p>
                )}
                {hoofdstuk.paragrafen && hoofdstuk.paragrafen.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {hoofdstuk.paragrafen.map((p, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-accent rounded text-secondary"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!readOnly && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Move up */}
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={disabled || index === 0}
                    className="p-1.5 text-secondary hover:text-foreground disabled:opacity-30"
                    title="Omhoog"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>

                  {/* Move down */}
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={disabled || index === structuur.length - 1}
                    className="p-1.5 text-secondary hover:text-foreground disabled:opacity-30"
                    title="Omlaag"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => handleEdit(hoofdstuk)}
                    disabled={disabled || hoofdstuk.status === 'generated'}
                    className="p-1.5 text-secondary hover:text-foreground disabled:opacity-30"
                    title="Bewerken"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDelete(hoofdstuk.id)}
                    disabled={disabled || hoofdstuk.status === 'generated'}
                    className="p-1.5 text-red-500 hover:text-red-700 disabled:opacity-30"
                    title="Verwijderen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add button */}
      {!readOnly && (
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="w-full py-3 border-2 border-dashed border-border rounded-lg text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          + Hoofdstuk toevoegen
        </button>
      )}
    </div>
  );
}
