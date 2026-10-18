import React, { useState } from 'react';
import { Check, ChevronsUpDown, Package, Zap, AlertTriangle, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { InventoryItem } from '@/types/database';
import { useNavigate } from 'react-router-dom';

interface ItemSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectItem: (item: InventoryItem) => void;
  inventoryItems: InventoryItem[];
  selectedItemId?: string | null;
  placeholder?: string;
  className?: string;
}

export function ItemSelector({
  value,
  onChange,
  onSelectItem,
  inventoryItems,
  selectedItemId,
  placeholder = "Select item or type custom...",
  className,
}: ItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const navigate = useNavigate();

  const selectedItem = inventoryItems.find(
    (item) => item.id === selectedItemId || (value && item.name.toLowerCase() === value.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal text-left h-auto py-2 px-3",
            !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex flex-col gap-0.5 overflow-hidden text-left flex-1 mr-2">
            <span className="truncate font-medium text-foreground">
              {value || placeholder}
            </span>
            {selectedItem && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span>₹{Number(selectedItem.unit_price).toFixed(2)}</span>
                <span>•</span>
                {selectedItem.is_service ? (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-medium">
                    <Zap className="h-3 w-3 inline" /> Service
                  </span>
                ) : (
                  <span className={cn(
                    "flex items-center gap-0.5 font-medium",
                    selectedItem.stock_quantity <= 0
                      ? "text-destructive"
                      : selectedItem.stock_quantity <= (selectedItem.low_stock_threshold || 5)
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    <Package className="h-3 w-3 inline" />
                    {selectedItem.stock_quantity <= 0
                      ? "Out of stock (0)"
                      : `${selectedItem.stock_quantity} ${selectedItem.unit || 'pcs'} in stock`}
                  </span>
                )}
              </span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] sm:w-[420px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search inventory items..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              <div className="p-3 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No matching inventory item.</p>
                {searchValue.trim() && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full text-xs"
                    onClick={() => {
                      onChange(searchValue.trim());
                      setOpen(false);
                    }}
                  >
                    Use &ldquo;{searchValue.trim()}&rdquo; as custom item
                  </Button>
                )}
              </div>
            </CommandEmpty>

            {inventoryItems.length > 0 && (
              <CommandGroup heading="Inventory Items">
                {inventoryItems.map((item) => {
                  const isSelected = selectedItemId === item.id || value === item.name;
                  const isOutOfStock = !item.is_service && item.stock_quantity <= 0;
                  const isLowStock = !item.is_service && !isOutOfStock && item.stock_quantity <= (item.low_stock_threshold || 5);

                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.name} ${item.sku || ''} ${item.category || ''}`}
                      onSelect={() => {
                        onSelectItem(item);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between p-2.5 cursor-pointer"
                    >
                      <div className="flex items-start gap-2 flex-1 mr-2 overflow-hidden">
                        <Check
                          className={cn(
                            "h-4 w-4 mt-0.5 shrink-0",
                            isSelected ? "opacity-100 text-primary" : "opacity-0"
                          )}
                        />
                        <div className="overflow-hidden">
                          <p className="font-medium text-sm leading-tight truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">₹{Number(item.unit_price).toFixed(2)}</span>
                            {item.unit && <span>/ {item.unit}</span>}
                            {item.hsn_code && <span>• HSN: {item.hsn_code}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {item.is_service ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] px-1.5 py-0">
                            Service
                          </Badge>
                        ) : isOutOfStock ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> 0 {item.unit || 'pcs'}
                          </Badge>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              isLowStock 
                                ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300"
                                : "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300"
                            )}
                          >
                            {item.stock_quantity} {item.unit || 'pcs'}
                          </Badge>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            <CommandSeparator />
            <CommandGroup heading="Actions">
              {searchValue.trim() && (
                <CommandItem
                  onSelect={() => {
                    onChange(searchValue.trim());
                    setOpen(false);
                  }}
                  className="cursor-pointer text-xs font-medium"
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Use &ldquo;{searchValue.trim()}&rdquo; as custom item
                </CommandItem>
              )}
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  navigate('/inventory/new');
                }}
                className="cursor-pointer text-xs font-medium text-primary"
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add New Item to Inventory
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
