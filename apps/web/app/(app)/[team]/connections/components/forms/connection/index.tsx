import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/registry/new-york-v4/ui/form';
import { Input } from '@/registry/new-york-v4/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/registry/new-york-v4/ui/select';
import { useTranslations } from 'next-intl';
import RequiredMark from '../../require-mark';
import { CONNECTION_TYPE_OPTIONS, getConnectionDriver } from './drivers';

export default function ConnectionForm(props: { form: UseFormReturn<any> }) {
    const { form } = props;
    const { control } = form;
    const t = useTranslations('Connections.ConnectionContent');
    const driver = getConnectionDriver(form.watch('connection.type'));
    const DriverFields = driver.FormComponent;

    return (
        <div className="space-y-4">
            
            <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] items-start">
                
                <FormField
                    control={control}
                    name="connection.name"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel>
                                {t('Connection Name')}
                                <RequiredMark />
                            </FormLabel>
                            <FormControl>
                                <Input placeholder={t('Connection Name Placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                
                <FormField
                    control={control}
                    name="connection.type"
                    render={({ field }) => (
                        <FormItem className="space-y-2">
                            <FormLabel>
                                {t('Type')}
                                <RequiredMark />
                            </FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl className="w-full">
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select Database Type')} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {CONNECTION_TYPE_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <DriverFields form={form} />
        </div>
    );
}
