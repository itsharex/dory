'use client';

import { ChevronDown, ChevronRight, Layers, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { ObjectGroup } from './catalog-object-group';
import { DEFAULT_GROUP_STATE } from './types';
import type { DatabaseObjects, GroupState, SchemaNode, SidebarListKind, SidebarListTarget, SidebarObjectTarget, SidebarSelection, TargetOption } from './types';
import type { GroupConfig } from './catalog-object-group';

type SchemaNodeRowProps = {
    dbName: string;
    schema: SchemaNode;
    scopeKey: string;
    isExpanded: boolean;
    expandedGroups: Record<string, GroupState>;
    groupConfigs: GroupConfig[];
    objects: DatabaseObjects;
    loadingState: GroupState;
    normalized: string;
    selectedDatabase?: string;
    selectedSchema?: string;
    selectedList?: SidebarListKind;
    selectedObject?: SidebarSelection;
    onToggleSchema: (database: string, schema: string) => void;
    onToggleGroup: (scopeKey: string, group: keyof GroupState) => void;
    onSelectSchema: (target: { database: string; schema: string }) => void;
    onSelectList: (target: SidebarListTarget) => void;
    onSelectObject: (target: SidebarObjectTarget) => void;
    onOpenObject: (target: SidebarObjectTarget) => void;
    filterEntries: (entries: TargetOption[]) => TargetOption[];
};

export function SchemaNodeRow({
    dbName,
    schema,
    scopeKey,
    isExpanded,
    expandedGroups,
    groupConfigs,
    objects,
    loadingState,
    normalized,
    selectedDatabase,
    selectedSchema,
    selectedList,
    selectedObject,
    onToggleSchema,
    onToggleGroup,
    onSelectSchema,
    onSelectList,
    onSelectObject,
    onOpenObject,
    filterEntries,
}: SchemaNodeRowProps) {
    const t = useTranslations('CatalogSchemaSidebar');
    const groupState = expandedGroups[scopeKey] ?? DEFAULT_GROUP_STATE;
    const isLoading = Object.values(loadingState).some(Boolean);
    const isSelected = selectedDatabase === dbName && selectedSchema === schema.name;

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1">
                <button
                    type="button"
                    onClick={() => onToggleSchema(dbName, schema.name)}
                    className="rounded p-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    aria-label={`${isExpanded ? t('Collapse') : t('Expand')} ${schema.label}`}
                >
                    {isExpanded && isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                    )}
                </button>
                <Layers className="h-3.5 w-3.5" />
                <button
                    type="button"
                    onClick={() => onSelectSchema({ database: dbName, schema: schema.name })}
                    className={cn(
                        'flex-1 truncate rounded px-1 py-0.5 text-left text-sm',
                        isSelected ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                >
                    {schema.label}
                </button>
            </div>

            {isExpanded ? (
                <div className="ml-6 space-y-1">
                    {!isLoading
                        ? groupConfigs.map(group => (
                              <ObjectGroup
                                  key={`${scopeKey}-${group.key}`}
                                  scopeKey={scopeKey}
                                  dbName={dbName}
                                  group={group}
                                  objectKind={
                                      group.key === 'tables' ? 'table' : group.key === 'views' ? 'view' : group.key === 'materializedViews' ? 'materializedView' : 'function'
                                  }
                                  listTarget={{
                                      database: dbName,
                                      schema: schema.name,
                                      listKind: group.key,
                                  }}
                                  fallbackSchema={schema.name}
                                  isExpanded={groupState[group.key]}
                                  isLoading={loadingState[group.key]}
                                  entries={normalized ? filterEntries(objects[group.key]) : objects[group.key]}
                                  normalized={normalized}
                                  selectedDatabase={selectedDatabase}
                                  selectedSchema={selectedSchema}
                                  selectedList={selectedList}
                                  selectedObject={selectedObject}
                                  onToggle={() => onToggleGroup(scopeKey, group.key)}
                                  onSelectList={onSelectList}
                                  onSelectObject={onSelectObject}
                                  onOpenObject={onOpenObject}
                              />
                          ))
                        : null}
                </div>
            ) : null}
        </div>
    );
}
