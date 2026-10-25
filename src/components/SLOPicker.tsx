import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import type { SLO } from '@/types';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Search } from 'lucide-react';

interface Props {
  learningAreaId: string;
  value: string;
  onChange: (sloId: string) => void;
  error?: string;
}

export function SLOPicker({ learningAreaId, value, onChange, error }: Props) {
  const { state } = useApp();
  const { strands, subStrands, slos } = state;
  const [search, setSearch] = useState('');
  const [strandId, setStrandId] = useState('');
  const [subStrandId, setSubStrandId] = useState('');

  const areaStrands = strands.filter((s) => s.learningAreaId === learningAreaId).sort((a, b) => a.order - b.order);
  const strandSubStrands = subStrands.filter((ss) => ss.strandId === strandId).sort((a, b) => a.order - b.order);
  const availableSLOs: SLO[] = search
    ? slos.filter(
        (s) =>
          areaStrands.some((strand) =>
            subStrands.filter((ss) => ss.strandId === strand.id).some((ss) => ss.id === s.subStrandId)
          ) &&
          (s.code.toLowerCase().includes(search.toLowerCase()) ||
            s.description.toLowerCase().includes(search.toLowerCase()))
      )
    : subStrandId
    ? slos.filter((s) => s.subStrandId === subStrandId)
    : [];

  // Reset downstream selections when an upstream selection changes (event-driven, no effects).
  const handleStrandChange = (newStrandId: string) => {
    setStrandId(newStrandId);
    setSubStrandId('');
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    if (newSearch) {
      setStrandId('');
      setSubStrandId('');
    }
  };

  const selectedSLO = slos.find((s) => s.id === value);

  return (
    <div className="space-y-2">
      <Input
        label="Search SLO"
        placeholder="Type code or description..."
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        leftIcon={<Search size={14} />}
        aria-label="Search SLO by code or description"
      />
      {!search && (
        <>
          <Select
            label="Strand"
            options={areaStrands.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
            value={strandId}
            onChange={(e) => handleStrandChange(e.target.value)}
            placeholder="Select strand..."
          />
          {strandId && (
            <Select
              label="Sub-strand"
              options={strandSubStrands.map((ss) => ({ value: ss.id, label: `${ss.code} — ${ss.name}` }))}
              value={subStrandId}
              onChange={(e) => setSubStrandId(e.target.value)}
              placeholder="Select sub-strand..."
            />
          )}
        </>
      )}
      {availableSLOs.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-40 overflow-y-auto">
          {availableSLOs.map((slo) => (
            <button
              key={slo.id}
              type="button"
              onClick={() => { onChange(slo.id); setSearch(''); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus-visible:outline-none focus-visible:bg-indigo-50 transition-colors ${slo.id === value ? 'bg-indigo-50 dark:bg-indigo-900/20 font-medium' : ''}`}
            >
              <span className="font-mono text-indigo-600 dark:text-indigo-400 mr-2">{slo.code}</span>
              <span className="text-gray-600 dark:text-gray-300">{slo.description}</span>
            </button>
          ))}
        </div>
      )}
      {selectedSLO && (
        <p className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg">
          ✓ <strong>{selectedSLO.code}</strong> — {selectedSLO.description}
        </p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
