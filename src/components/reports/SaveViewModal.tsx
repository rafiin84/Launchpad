import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ModalFrame } from '../portfolio/portfolioUi';
import type { RepText } from './reportText';

export default function SaveViewModal({
  initialName, loadedView, saving, error, t, onSave, onClose,
}: {
  initialName: string;
  /** A view that is currently open — offered as an update target. */
  loadedView: { id: string; name: string } | null;
  saving: boolean;
  error: string;
  t: RepText;
  onSave: (name: string, updateId: string | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [update, setUpdate] = useState(!!loadedView);
  const [err, setErr] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr(t.errRequired); return; }
    onSave(name, update && loadedView ? loadedView.id : null);
  }

  return (
    <ModalFrame
      title={t.saveTitle}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{t.cancel}</Button>
          <Button type="submit" form="rep-save-form" variant="primary" disabled={saving}>{saving ? t.saving : t.save}</Button>
        </>
      }
    >
      <form id="rep-save-form" onSubmit={submit} noValidate className="space-y-4">
        {error && <div role="alert" className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
        <div>
          <Input label={`${t.saveName} *`} value={name} onChange={e => { setName(e.target.value); setErr(''); }} error={err} autoFocus />
          <p className="mt-1 text-xs text-gray-400">{t.saveNameHelp}</p>
        </div>
        {loadedView && (
          <fieldset className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name="rep-save-mode" checked={update} onChange={() => setUpdate(true)} />
              {t.saveUpdate.replace('{name}', loadedView.name)}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name="rep-save-mode" checked={!update} onChange={() => setUpdate(false)} />
              {t.saveAsNew}
            </label>
          </fieldset>
        )}
      </form>
    </ModalFrame>
  );
}
