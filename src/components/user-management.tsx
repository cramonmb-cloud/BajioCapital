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
import { PlusCircle, Loader2, Users, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const userSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  role: z.string().min(1, 'Debes seleccionar un rol.'),
});

type UserFormValues = z.infer<typeof userSchema>;

// Dummy data for now
const initialUsers = [
    { id: '1', email: 'cristobal@example.com', role: 'Administrador' },
];

export function UserManagement() {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { email: '', password: '', role: '' },
  });

  const onUserSubmit = async (values: UserFormValues) => {
    setIsSaving(true);
    toast({
        variant: 'destructive',
        title: 'Funcionalidad no implementada',
        description: 'La creación de usuarios desde aquí aún no está disponible.',
    });
    console.log("Form values (not submitted):", values);
    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users />
          Gestión de Usuarios
        </CardTitle>
        <CardDescription>
          Añade nuevos usuarios y asígnales un rol.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onUserSubmit)} className="space-y-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-end md:gap-2 space-y-4 md:space-y-0">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                    <FormItem className="flex-grow">
                        <FormLabel>Email del Usuario</FormLabel>
                        <FormControl>
                            <Input type="email" placeholder="usuario@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                    <FormItem className="flex-grow">
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                    <FormItem className="w-full md:w-48">
                        <FormLabel>Rol</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Asignar Rol" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Añadir Usuario
                </Button>
            </div>
          </form>
        </Form>

         <div className="mt-6">
              <h4 className="text-sm font-medium mb-2">Usuarios Existentes</h4>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {initialUsers.map(user => (
                          <TableRow key={user.id}>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{user.role}</TableCell>
                              <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" disabled>
                                      <Trash2 className="h-4 w-4 text-destructive"/>
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </div>
      </CardContent>
    </Card>
  );
}
