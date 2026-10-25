import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Star, X, Plus, BookOpen } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Button } from '@/components/ui/Button';
import {
  getExamSummary,
  getMasteryForLearningArea,
  getTopStrengths,
  getTopGaps,
} from '@/utils/scoring';

export function Dashboard() {
  const { state, dispatch } = useApp();
  const { exams, results, learningAreas, slos, settings, learner, seedDismissed } = state;
  const { thresholds } = settings;

  const [filterArea, setFilterArea] = useState<string>('');

  const sortedExams = [...exams].sort((a, b) => b.date.localeCompare(a.date));
  const latestExam = sortedExams[0];
  const latestSummary = latestExam ? getExamSummary(latestExam, results, thresholds) : null;

  const strengths = getTopStrengths(3, slos, exams, results, thresholds);
  const gaps = getTopGaps(3, slos, exams, results, thresholds);

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(d));

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Seed banner */}
      {!seedDismissed && exams.length > 0 && (
        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-xl px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
          <span>👋 Welcome! This is <strong>sample data</strong> for Ama Mensah. Add your own exams to get started.</span>
          <button onClick={() => dispatch({ type: 'DISMISS_SEED' })} aria-label="Dismiss" className="ml-3 text-indigo-400 hover:text-indigo-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            {learner?.name ? `${learner.name}'s Dashboard` : 'Dashboard'}
          </h1>
          {learner && (learner.name || learner.school) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {learner.grade ? `Basic ${learner.grade}` : null}
              {learner.name || learner.grade ? ' · ' : ''}
              {learner.school || null}
              {learner.school ? ' · ' : ''}
              {learner.year || null}
            </p>
          )}
          {!learner?.name && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set up your learner name in <Link to="/settings" className="text-indigo-600 underline">Settings</Link>.
            </p>
          )}
        </div>
        <Link to="/exams/new">
          <Button size="sm"><Plus size={15} /> New Exam</Button>
        </Link>
      </div>

      {/* Latest exam */}
      {latestExam && latestSummary ? (
        <Card header={<span className="flex items-center gap-2"><TrendingUp size={16} /> Latest Exam</span>}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">{latestExam.title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(latestExam.date)} · Term {latestExam.term} · {latestExam.type}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{latestSummary.pct}%</span>
              <Badge level={latestSummary.level} size="lg" />
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar pct={latestSummary.pct} level={latestSummary.level} />
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <BookOpen aria-hidden="true" />
            <p className="mt-2 text-sm">No exams yet. <Link to="/exams/new" className="text-indigo-600 underline">Add your first exam.</Link></p>
          </div>
        </Card>
      )}

      {/* Learning Area Overview */}
      {learningAreas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {learningAreas.map((la) => {
            const mastery = getMasteryForLearningArea(la.id, exams, results, thresholds);
            return (
              <Card key={la.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">{la.name}</span>
                  <Badge level={mastery.level} size="sm" />
                </div>
                <ProgressBar pct={mastery.pct} level={mastery.level} />
              </Card>
            );
          })}
        </div>
      )}

      {/* Trend Chart */}
      <Card header={
        <div className="flex items-center justify-between">
          <span>Score Trend</span>
          <select
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-transparent text-gray-600 dark:text-gray-400"
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            aria-label="Filter by learning area"
          >
            <option value="">All Areas</option>
            {learningAreas.map((la) => <option key={la.id} value={la.id}>{la.name}</option>)}
          </select>
        </div>
      }>
        {exams.length > 0 ? (
          <TrendLineChart
            exams={exams}
            results={results}
            learningAreas={learningAreas}
            thresholds={thresholds}
            filterAreaId={filterArea || undefined}
          />
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">No exam data yet.</p>
        )}
      </Card>

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card header={<span className="flex items-center gap-2 text-green-600 dark:text-green-400"><Star size={16} /> Top Strengths</span>}>
          {strengths.length > 0 ? (
            <ul className="space-y-3">
              {strengths.map(({ slo, mastery }) => (
                <li key={slo.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200" title={slo.description}>{slo.code}</span>
                    <Badge level={mastery.level} size="sm" />
                  </div>
                  <ProgressBar pct={mastery.pct} level={mastery.level} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No mastery data yet.</p>
          )}
        </Card>

        <Card header={<span className="flex items-center gap-2 text-amber-600 dark:text-amber-400"><AlertTriangle size={16} /> Priority Gaps</span>}>
          {gaps.length > 0 ? (
            <ul className="space-y-3">
              {gaps.map(({ slo, mastery }) => (
                <li key={slo.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200" title={slo.description}>{slo.code}</span>
                    <Badge level={mastery.level} size="sm" />
                  </div>
                  <ProgressBar pct={mastery.pct} level={mastery.level} />
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    {mastery.level === 'BE'
                      ? 'Building foundations — let\'s work on this together.'
                      : 'Approaching expectations — the next step is ME.'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-400 py-4 text-center">No gaps identified — great work!</p>
          )}
        </Card>
      </div>
    </div>
  );
}

