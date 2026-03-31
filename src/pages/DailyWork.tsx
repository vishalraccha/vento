import { useState } from 'react';
import { AppLayout, FloatingActionButton } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Trash2,
  Flag
} from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const priorityIcons: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-yellow-500',
  high: 'text-red-500',
};

export default function DailyWork() {
  const { 
    tasks, 
    todayTasks, 
    overdueTasks, 
    upcomingTasks,
    isLoading, 
    stats,
    createTask,
    deleteTask,
    toggleTaskComplete
  } = useTasks();
  
  const [activeTab, setActiveTab] = useState('today');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    priority: 'medium' as 'low' | 'medium' | 'high',
    category: '',
  });

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    
    await createTask.mutateAsync({
      title: newTask.title,
      description: newTask.description || null,
      due_date: newTask.due_date || null,
      due_time: null,
      priority: newTask.priority,
      status: 'pending',
      category: newTask.category || null,
      related_client_id: null,
      related_invoice_id: null,
      related_quotation_id: null,
    });
    
    setNewTask({
      title: '',
      description: '',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      priority: 'medium',
      category: '',
    });
    setIsDialogOpen(false);
  };

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    await toggleTaskComplete.mutateAsync({ 
      id: taskId, 
      currentStatus: currentStatus as 'pending' | 'in_progress' | 'completed' | 'cancelled'
    });
  };

  const getDateLabel = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    return format(date, 'MMM d');
  };

  const getDisplayTasks = () => {
    switch (activeTab) {
      case 'today':
        return [...overdueTasks, ...todayTasks];
      case 'upcoming':
        return upcomingTasks;
      case 'completed':
        return tasks.filter(t => t.status === 'completed');
      case 'all':
      default:
        return tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    }
  };

  const displayTasks = getDisplayTasks();

  const TaskCard = ({ task }: { task: typeof tasks[0] }) => {
    const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== 'completed';
    
    return (
      <Card className={`overflow-hidden ${task.status === 'completed' ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={task.status === 'completed'}
              onCheckedChange={() => handleToggleComplete(task.id, task.status)}
              className="mt-1"
            />
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>
                  {task.title}
                </p>
                <Flag className={`h-3 w-3 ${priorityIcons[task.priority]}`} />
              </div>
              
              {task.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {task.description}
                </p>
              )}
              
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {task.due_date && (
                  <Badge variant="outline" className={isOverdue ? 'border-destructive text-destructive' : ''}>
                    <Calendar className="mr-1 h-3 w-3" />
                    {getDateLabel(task.due_date)}
                  </Badge>
                )}
                
                {task.category && (
                  <Badge variant="secondary">{task.category}</Badge>
                )}
                
                <Badge className={priorityColors[task.priority]}>
                  {task.priority}
                </Badge>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => deleteTask.mutate(task.id)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout title="Daily Work" showBottomNav={false} showBackButton>
      <div className="flex flex-col">
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-2 border-b p-4">
          <div className="text-center">
            <div className="flex items-center justify-center">
              <Clock className="mr-1 h-4 w-4 text-blue-500" />
              <span className="text-xl font-bold">{stats.today}</span>
            </div>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center">
              <AlertCircle className="mr-1 h-4 w-4 text-red-500" />
              <span className="text-xl font-bold text-red-600">{stats.overdue}</span>
            </div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center">
              <Calendar className="mr-1 h-4 w-4 text-yellow-500" />
              <span className="text-xl font-bold">{stats.pending}</span>
            </div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="mr-1 h-4 w-4 text-green-500" />
              <span className="text-xl font-bold text-green-600">{stats.completed}</span>
            </div>
            <p className="text-xs text-muted-foreground">Done</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="border-b px-4 pt-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="completed">Done</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-lg font-medium">
                  {activeTab === 'today' ? 'All caught up!' : 'No tasks'}
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {activeTab === 'today' 
                    ? 'You have no tasks for today' 
                    : activeTab === 'completed'
                    ? 'Completed tasks will appear here'
                    : 'Add a task to get started'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        </Tabs>

        {/* Add Task Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-[90%] rounded-lg">
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="What needs to be done?"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Add more details..."
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select 
                    value={newTask.priority} 
                    onValueChange={(value: 'low' | 'medium' | 'high') => setNewTask({ ...newTask, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category (optional)</Label>
                <Input
                  id="category"
                  value={newTask.category}
                  onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                  placeholder="e.g., Follow-up, Payment, Meeting"
                />
              </div>
              
              <Button 
                onClick={handleCreateTask} 
                className="w-full"
                disabled={!newTask.title.trim() || createTask.isPending}
              >
                {createTask.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* FAB */}
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          onClick={() => setIsDialogOpen(true)}
          label="Add Task"
        />
      </div>
    </AppLayout>
  );
}
