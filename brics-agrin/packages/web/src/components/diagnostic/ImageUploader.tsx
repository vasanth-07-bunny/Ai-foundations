/**
 * Image uploader with drag-and-drop, file preview, and client-side validation.
 *
 * Client-side validation (before upload):
 *   - File type check
 *   - File size check (10 MB)
 * Server-side validation (deep security) happens in ImageValidator.
 *
 * Accessibility: keyboard operable, screen reader announcements,
 * clear error messages, focus management.
 */

import React, { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ImageUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function ImageUploader({ onFileSelected, disabled }: ImageUploaderProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validate = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return t('errors.imageType');
    if (file.size > MAX_SIZE_BYTES) return t('errors.imageTooBig');
    return null;
  };

  const handleFile = useCallback((file: File) => {
    setError(null);
    const err = validate(file);
    if (err) { setError(err); return; }

    const url = URL.createObjectURL(file);
    setPreview(url);
    onFileSelected(file);
  }, [onFileSelected, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('diagnostic.upload')}
        aria-disabled={disabled}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
          ${isDragging ? 'border-agri-500 bg-agri-50' : 'border-gray-300 hover:border-agri-400 bg-white'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={disabled ? undefined : handleDrop}
      >
        {preview ? (
          <div className="space-y-2">
            <img
              src={preview}
              alt="Selected crop image preview"
              className="mx-auto max-h-48 rounded-lg object-contain"
            />
            <p className="text-xs text-gray-500">{t('diagnostic.dragDrop')}</p>
          </div>
        ) : (
          <div className="space-y-2 py-4">
            <div className="text-4xl" aria-hidden="true">📷</div>
            <p className="text-sm font-medium text-gray-700">{t('diagnostic.dragDrop')}</p>
            <p className="text-xs text-gray-400">{t('diagnostic.fileTypes')}</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-hidden="true"
          onChange={handleChange}
          disabled={disabled}
        />
      </div>

      {/* Validation error */}
      {error && (
        <p role="alert" className="text-sm text-red-600 flex items-center gap-1">
          <span aria-hidden="true">⚠️</span>
          {error}
        </p>
      )}

      {/* Photography tips */}
      <details className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <summary className="font-medium cursor-pointer">{t('diagnostic.imageTips')}</summary>
        <ul className="mt-2 space-y-1 list-none">
          {['tip1', 'tip2', 'tip3', 'tip4'].map((k) => (
            <li key={k} className="flex items-start gap-1">
              <span aria-hidden="true">•</span>
              {t(`diagnostic.${k}`)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
