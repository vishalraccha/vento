import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/types/database';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high';

export function useTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });

  const createTask = useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed_at'>) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('tasks')
        .insert([{ ...task, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      // If marking as completed, set completed_at
      if (updates.status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const toggleTaskComplete = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: TaskStatus }) => {
      const newStatus: TaskStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const completed_at = newStatus === 'completed' ? new Date().toISOString() : null;

      const { data, error } = await supabase
        .from('tasks')
        .update({ status: newStatus, completed_at })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Get tasks due today
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasksQuery.data?.filter(t => t.due_date === today) || [];
  
  // Get overdue tasks
  const overdueTasks = tasksQuery.data?.filter(t => 
    t.due_date && 
    t.due_date < today && 
    t.status !== 'completed' && 
    t.status !== 'cancelled'
  ) || [];

  // Get upcoming tasks (next 7 days)
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const upcomingTasks = tasksQuery.data?.filter(t => 
    t.due_date && 
    t.due_date > today && 
    t.due_date <= nextWeek.toISOString().split('T')[0] &&
    t.status !== 'completed' &&
    t.status !== 'cancelled'
  ) || [];

  const stats = {
    total: tasksQuery.data?.length || 0,
    pending: tasksQuery.data?.filter(t => t.status === 'pending').length || 0,
    inProgress: tasksQuery.data?.filter(t => t.status === 'in_progress').length || 0,
    completed: tasksQuery.data?.filter(t => t.status === 'completed').length || 0,
    overdue: overdueTasks.length,
    today: todayTasks.length,
  };

  return {
    tasks: tasksQuery.data || [],
    todayTasks,
    overdueTasks,
    upcomingTasks,
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    stats,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
  };
}
