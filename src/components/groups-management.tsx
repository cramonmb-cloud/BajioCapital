'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Trash2, Loader2, UserPlus, Users, Trash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { Group, Supervisor } from '@/lib/types';
import { saveGroupAction, saveSupervisorAction, deleteGroupAction } from '@/app/dashboard/settings/actions';

const supervisorSchema = z.object({
  supervisorName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});

const groupSchema = z.object({
  groupName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  supervisorId: z.string().min(1, 'Debes seleccionar un supervisor.'),
});

type SupervisorFormValues = z.infer<typeof supervisorSchema>;
type GroupFormValues = z.infer<typeof groupSchema>;

interface GroupsManagementProps {
  initialSupervisors: Supervisor[];
  initialGroups: Group[];
}

export function GroupsManagement({ initialSupervisors, initialGroups }: GroupsManagementProps) {
  const [isSavingSupervisor, setIsSavingSupervisor] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  const getSupervisorName = (supervisorId: string) => {
    return initialSupervisors.find(s => s.id === supervisorId)?.name || 'N/A';
  }

  const supervisorForm = useForm<SupervisorFormValues>({
    resolver: zodResolver(supervisorSchema),
    defaultValues: { supervisorName: '' },
  });

  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { groupName: '', supervisorId: '' },
  });

  const onSupervisorSubmit = async (values: SupervisorFormValues) => {
    setIsSavingSupervisor(true);
    try {
      const result = await saveSupervisorAction(values.supervisorName);
      if (result.success) {
        toast({ title: 'Éxito', description: result.message });
        supervisorForm.reset();
        router.refresh();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSavingSupervisor(false);
    }
  };
  
  const onGroupSubmit = async (values: GroupFormValues) => {
    setIsSavingGroup(true);
    try {
        const result = await saveGroupAction({ name: values.groupName, supervisorId: values.supervisorId });
        if (result.success) {
            toast({ title: 'Éxito', description: result.message });
            groupForm.reset();
            router.refresh();
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
        const result = await deleteGroupAction(groupId);
        if (result.success) {
            toast({ title: 'Éxito', description: result.message });
            router.refresh();
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };


  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Supervisors Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus />
            Supervisores
          </CardTitle>
          <CardDescription>
            Añade nuevos supervisores. Actualmente tienes {initialSupervisors.length}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...supervisorForm}>
            <form onSubmit={supervisorForm.handleSubmit(onSupervisorSubmit)} className="flex items-end gap-2">
              <FormField
                control={supervisorForm.control}
                name="supervisorName"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormLabel>Nombre del Supervisor</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Juan Pérez" {...field} className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSavingSupervisor}>
                {isSavingSupervisor ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {/* Groups Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users />
            Grupos
          </CardTitle>
          <CardDescription>
            Añade nuevos grupos y asígnales un supervisor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...groupForm}>
            <form onSubmit={groupForm.handleSubmit(onGroupSubmit)} className="space-y-4">
              <div className="flex items-end gap-2">
                <FormField
                    control={groupForm.control}
                    name="groupName"
                    render={({ field }) => (
                    <FormItem className="flex-grow">
                        <FormLabel>Nombre del Grupo</FormLabel>
                        <FormControl>
                        <Input placeholder="Ej: Grupo Centro" {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={groupForm.control}
                    name="supervisorId"
                    render={({ field }) => (
                    <FormItem className="w-48">
                        <FormLabel>Supervisor</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Asignar" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {initialSupervisors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" disabled={isSavingGroup}>
                    {isSavingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </Form>

           <div className="mt-6">
                <h4 className="text-sm font-medium mb-2">Grupos Existentes</h4>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Supervisor</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialGroups.map(group => (
                            <TableRow key={group.id}>
                                <TableCell>{group.name}</TableCell>
                                <TableCell>{getSupervisorName(group.supervisorId)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(group.id)}>
                                        <Trash className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                         {initialGroups.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center">No hay grupos registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
