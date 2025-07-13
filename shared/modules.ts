export interface Module {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'coming_soon' | 'locked';
  icon: string;
  color: string;
  estimatedDuration?: string;
  lessonCount?: number;
  comingSoonMessage?: string;
}

export const modules: Module[] = [
  {
    id: 'week-of-connection',
    title: 'Week of Connection',
    description: 'Build classroom community through personality understanding and connection activities. Students discover their animal types and learn to work together.',
    status: 'active',
    icon: 'Users',
    color: '#c6e3db',
    estimatedDuration: '1 week',
    lessonCount: 5,
  },
  {
    id: 'morning-meetings',
    title: 'Morning Meetings',
    description: 'Daily routines and activities to start each day with intention, connection, and positive energy.',
    status: 'coming_soon',
    icon: 'Sun',
    color: '#ffd93d',
    comingSoonMessage: 'Interactive morning routines and daily check-ins are coming soon!',
  },
  {
    id: 'final-quest',
    title: 'Final Quest (Last Week of School)',
    description: 'Special end-of-year activities and reflections to celebrate growth, strengthen connections, and send students off with confidence.',
    status: 'coming_soon',
    icon: 'Trophy',
    color: '#ff8070',
    comingSoonMessage: 'End-of-year celebration activities and reflection tools coming soon!',
  },
];

export function getModuleById(id: string): Module | undefined {
  return modules.find(module => module.id === id);
}

export function getAllModules(): Module[] {
  return modules;
}

export function getActiveModules(): Module[] {
  return modules.filter(module => module.status === 'active');
}