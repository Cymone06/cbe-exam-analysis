import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { generateActionPlanItem } from '@/utils/actionPlan';
import { getMasteryForSLO } from '@/utils/scoring';
import type { ActionPlanItem, PerformanceLevel } from '@/types';
import { CheckCircle, Circle, Edit, Trash2, Zap, RefreshCw } from 'lucide-react';

export function ActionPlan() {
  const { state, dispatch } = useApp();
  const { actionPlan, slos, exams, results, settings } = state;

  const [editItem, setEditItem] = useState<ActionPlanItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sorted = [...actionPlan].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.reviewDate.localeCompare(b.reviewDate);
  });

  const generateAll = () => {
    const gapSLOs = slos.filter((slo) => {
      const m = getMasteryForSLO(slo.id, exams, results, settings.thresholds);
      return m.level === 'AE' || m.level === 'BE';
    });
    const inPlan = new Set(actionPlan.map((i) => i.sloId));
    for (const slo of gapSLOs) {
      if (!inPlan.has(slo.id)) {
        const m = getMasteryForSLO(slo.id, exams, results, settings.thresholds);
        const item = generateActionPlanItem(slo, m.pct, m.level);
        dispatch({ type: 'ADD_ACTION_ITEM', payload: item });
      }
    }
  };

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(d));

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Action Plan</h1>
        <Button size="sm" variant="secondary" onClick={generateAll}>
          <RefreshCw size={14} /> Generate for all gaps
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Zap className="mx-auto text-gray-300 dark:text-gray-600" size={40} />
            <p className="mt-3 text-gray-500 dark:text-gray-400">No action items yet.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Go to <strong>Gap Diagnosis</strong> and add gaps to your plan, or click Generate above.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((item) => {
            const slo = slos.find((s) => s.id === item.sloId);
            return (
              <Card
                key={item.id}
                className={item.completed ? 'opacity-60' : ''}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => dispatch({ type: 'TOGGLE_ACTION_ITEM', payload: item.id })}
                    aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
                    className="mt-0.5 shrink-0 text-gray-400 hover:text-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                  >
                    {item.completed
                      ? <CheckCircle size={20} className="text-green-500" />
                      : <Circle size={20} />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {slo && <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{slo.code}</span>}
                      <Badge level={item.targetLevel} size="sm" />
                      <span className="text-xs text-gray-400">Target by {formatDate(item.reviewDate)}</span>
                    </div>
                    {slo && <p className={`text-xs text-gray-500 dark:text-gray-400 mb-2 ${item.completed ? 'line-through' : ''}`}>{slo.description}</p>}
                    <div className="space-y-1.5">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Activity</span>
                        <p className={`text-sm text-gray-700 dark:text-gray-300 ${item.completed ? 'line-through' : ''}`}>{item.activity}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Practice Task</span>
                        <p className={`text-sm text-gray-700 dark:text-gray-300 ${item.completed ? 'line-through' : ''}`}>{item.practiceTask}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setEditItem(item)} aria-label={`Edit ${item.sloId} action item`}>
                      <Edit size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)} aria-label={`Delete ${item.sloId} action item`}>
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <EditModal
          item={editItem}
          onSave={(updated) => { dispatch({ type: 'UPDATE_ACTION_ITEM', payload: updated }); setEditItem(null); }}
          onClose={() => setEditItem(null)}
        />
      )}

      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Delete Action Item"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { dispatch({ type: 'DELETE_ACTION_ITEM', payload: deleteId! }); setDeleteId(null); }}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">Remove this action item from the plan?</p>
      </Modal>
    </div>
  );
}

function EditModal({ item, onSave, onClose }: { item: ActionPlanItem; onSave: (i: ActionPlanItem) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...item });
  return (
    <Modal open onClose={onClose} title="Edit Action Item" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(form)}>Save</Button>
      </>
    }>
      <div className="space-y-3">
        <div>
          <label htmlFor="ap-edit-activity" className="text-sm font-medium text-gray-700 dark:text-gray-300">Activity</label>
          <textarea id="ap-edit-activity" className="w-full mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none" rows={3} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ap-edit-practice" className="text-sm font-medium text-gray-700 dark:text-gray-300">Practice Task</label>
          <textarea id="ap-edit-practice" className="w-full mt-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none" rows={3} value={form.practiceTask} onChange={(e) => setForm({ ...form, practiceTask: e.target.value })} />
        </div>
        <Select label="Target Level" value={form.targetLevel} onChange={(e) => setForm({ ...form, targetLevel: e.target.value as PerformanceLevel })}
          options={(['AE', 'ME', 'EE'] as PerformanceLevel[]).map((l) => ({ value: l, label: l }))} />
        <Input label="Review Date" type="date" value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} />
      </div>
    </Modal>
  );
}
