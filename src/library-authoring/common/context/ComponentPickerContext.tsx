import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { ContentHit } from 'search-manager';
import { useSearchContext } from 'search-manager/SearchManager';

export interface SelectedComponent {
  usageKey: string;
  blockType: string;
  collectionKeys?: string[];
}

export type CollectionStatus = 'selected' | 'indeterminate';

export interface SelectedCollection {
  key: string;
  status: CollectionStatus;
}

export interface CollectionData {
  components: SelectedComponent[];
  affectedCollectionSizes: Map<string, number>;
}

export type ComponentSelectedEvent = (
  selectedComponent: SelectedComponent,
  collectionComponents?: CollectionData | Map<string, number>
) => void;
export type ComponentSelectionChangedEvent = (selectedComponents: SelectedComponent[]) => void;

type NoComponentPickerType = {
  componentPickerMode: false;
  /** We add the `never` type to ensure that the other properties are not used,
   * but allow it to be desconstructed from the return value of `useComponentPickerContext()`
   */
  onComponentSelected?: never;
  selectedComponents?: never;
  selectedCollections?: never;
  addComponentToSelectedComponents?: never;
  removeComponentFromSelectedComponents?: never;
  restrictToLibrary?: never;
};

type ComponentPickerSingleType = {
  componentPickerMode: 'single';
  onComponentSelected: ComponentSelectedEvent;
  selectedComponents?: never;
  selectedCollections?: never;
  addComponentToSelectedComponents?: never;
  removeComponentFromSelectedComponents?: never;
  restrictToLibrary: boolean;
};

type ComponentPickerMultipleType = {
  componentPickerMode: 'multiple';
  onComponentSelected?: never;
  selectedComponents: SelectedComponent[];
  selectedCollections: SelectedCollection[];
  addComponentToSelectedComponents: ComponentSelectedEvent;
  removeComponentFromSelectedComponents: ComponentSelectedEvent;
  restrictToLibrary: boolean;
};

type ComponentPickerContextData = ComponentPickerSingleType | ComponentPickerMultipleType;

/**
 * Component Picker Context.
 * This context is used to provide the component picker mode and the selected components.
 *
 * Get this using `useComponentPickerContext()`
 */
const ComponentPickerContext = createContext<ComponentPickerContextData | undefined>(undefined);

export type ComponentPickerSingleProps = {
  componentPickerMode: 'single';
  onComponentSelected: ComponentSelectedEvent;
  onChangeComponentSelection?: never;
  restrictToLibrary?: boolean;
};

export type ComponentPickerMultipleProps = {
  componentPickerMode: 'multiple';
  onComponentSelected?: never;
  onChangeComponentSelection?: ComponentSelectionChangedEvent;
  restrictToLibrary?: boolean;
};

type ComponentPickerProps = ComponentPickerSingleProps | ComponentPickerMultipleProps;

type ComponentPickerProviderProps = {
  children?: React.ReactNode;
} & ComponentPickerProps;

/**
 * Pre-computed collection indexing data for O(1) lookups
 */
export interface CollectionIndexData {
  /** Map: collectionKey → components in that collection */
  collectionToComponents: Map<string, SelectedComponent[]>;
  /** Map: componentUsageKey → collection keys it belongs to */
  componentToCollections: Map<string, string[]>;
  /** Map: collectionKey → Map of all affected collections with their sizes */
  collectionToAffectedSizes: Map<string, Map<string, number>>;
  /** Map: collectionKey → total component count (for quick size lookup) */
  collectionSizes: Map<string, number>;
}

/**
 * Hook to build indexing maps for collections and components.
 * Pre-computes all relationships for O(1) lookups during selection operations.
 * @param hits - Search hits from which to build the indexes
 * @returns Pre-computed collection index data
 */
export const useCollectionIndexing = (
  hits: ReturnType<typeof useSearchContext>['hits'],
): CollectionIndexData => useMemo(() => {
  const collectionToComponents = new Map<string, SelectedComponent[]>();
  const componentToCollections = new Map<string, string[]>();
  const collectionSizes = new Map<string, number>();

  // First pass: build basic indexes
  hits.forEach((hit) => {
    if (hit.type === 'library_block') {
      const collectionKeys = (hit as ContentHit).collections?.key ?? [];

      // Index component → collections mapping
      if (hit.usageKey) {
        componentToCollections.set(hit.usageKey, collectionKeys);
      }

      // Index collection → components mapping
      collectionKeys.forEach((collectionKey: string) => {
        if (!collectionToComponents.has(collectionKey)) {
          collectionToComponents.set(collectionKey, []);
        }
        collectionToComponents.get(collectionKey)!.push({
          usageKey: hit.usageKey,
          blockType: hit.blockType,
          collectionKeys,
        });
      });
    }
  });

  // Second pass: compute collection sizes
  collectionToComponents.forEach((components, collectionKey) => {
    collectionSizes.set(collectionKey, components.length);
  });

  // Third pass: pre-compute affected collections for each collection
  const collectionToAffectedSizes = new Map<string, Map<string, number>>();
  collectionToComponents.forEach((components, collectionKey) => {
    const affectedSizes = new Map<string, number>();

    // For each component in this collection, find all collections it belongs to
    components.forEach((component) => {
      component.collectionKeys?.forEach((affectedKey) => {
        if (!affectedSizes.has(affectedKey)) {
          affectedSizes.set(affectedKey, collectionSizes.get(affectedKey) ?? 0);
        }
      });
    });

    collectionToAffectedSizes.set(collectionKey, affectedSizes);
  });

  return {
    collectionToComponents,
    componentToCollections,
    collectionToAffectedSizes,
    collectionSizes,
  };
}, [hits]);

/**
 * React component to provide `ComponentPickerContext`
 */
export const ComponentPickerProvider = ({
  children,
  componentPickerMode,
  restrictToLibrary = false,
  onComponentSelected,
  onChangeComponentSelection,
}: ComponentPickerProviderProps) => {
  const [selectedComponents, setSelectedComponents] = useState<SelectedComponent[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<SelectedCollection[]>([]);

  const addComponentToSelectedComponents = useCallback<ComponentSelectedEvent>((
    selectedComponent: SelectedComponent,
    collectionComponents?: CollectionData | Map<string, number>,
  ) => {
    const isCollectionSelection = collectionComponents && 'components' in collectionComponents;
    const componentsToAdd = isCollectionSelection
      ? collectionComponents.components
      : [selectedComponent];

    setSelectedComponents((prevSelectedComponents) => {
      const existingKeys = new Set(prevSelectedComponents.map((c) => c.usageKey));
      const newComponents = componentsToAdd.filter((c) => !existingKeys.has(c.usageKey));

      if (newComponents.length === 0) {
        return prevSelectedComponents;
      }

      const newSelectedComponents = [...prevSelectedComponents, ...newComponents];

      const collectionSizes = isCollectionSelection
        ? collectionComponents.affectedCollectionSizes
        : collectionComponents;

      if (collectionSizes instanceof Map && collectionSizes.size > 0) {
        const selectedByCollection = new Map<string, number>();

        newSelectedComponents.forEach((component) => {
          component.collectionKeys?.forEach((key) => {
            if (collectionSizes.has(key)) {
              selectedByCollection.set(key, (selectedByCollection.get(key) ?? 0) + 1);
            }
          });
        });

        // Batch update all collection statuses
        setSelectedCollections((prevSelectedCollections) => {
          const collectionMap = new Map(
            prevSelectedCollections.map((c) => [c.key, c]),
          );

          collectionSizes.forEach((totalCount, collectionKey) => {
            const selectedCount = selectedByCollection.get(collectionKey) ?? 0;

            if (selectedCount === 0) {
              collectionMap.delete(collectionKey);
            } else if (selectedCount >= totalCount) {
              collectionMap.set(collectionKey, { key: collectionKey, status: 'selected' });
            } else {
              collectionMap.set(collectionKey, { key: collectionKey, status: 'indeterminate' });
            }
          });

          return Array.from(collectionMap.values());
        });
      }

      onChangeComponentSelection?.(newSelectedComponents);
      return newSelectedComponents;
    });
  }, [onChangeComponentSelection]);

  const removeComponentFromSelectedComponents = useCallback<ComponentSelectedEvent>((
    selectedComponent: SelectedComponent,
    collectionComponents?: CollectionData | Map<string, number>,
  ) => {
    const isCollectionSelection = collectionComponents && 'components' in collectionComponents;
    const componentsToRemove = isCollectionSelection
      ? collectionComponents.components
      : [selectedComponent];
    const usageKeysToRemove = new Set(componentsToRemove.map((c) => c.usageKey));

    setSelectedComponents((prevSelectedComponents) => {
      const newSelectedComponents = prevSelectedComponents.filter(
        (component) => !usageKeysToRemove.has(component.usageKey),
      );

      const collectionSizes = isCollectionSelection
        ? collectionComponents.affectedCollectionSizes
        : collectionComponents;

      if (collectionSizes instanceof Map && collectionSizes.size > 0) {
        const selectedByCollection = new Map<string, number>();

        // Only count components for collections we care about
        newSelectedComponents.forEach((component) => {
          component.collectionKeys?.forEach((key) => {
            if (collectionSizes.has(key)) {
              selectedByCollection.set(key, (selectedByCollection.get(key) ?? 0) + 1);
            }
          });
        });

        // Batch update all collection statuses
        setSelectedCollections((prevSelectedCollections) => {
          const collectionMap = new Map(
            prevSelectedCollections.map((c) => [c.key, c]),
          );

          collectionSizes.forEach((totalCount, collectionKey) => {
            const selectedCount = selectedByCollection.get(collectionKey) ?? 0;

            if (selectedCount === 0) {
              collectionMap.delete(collectionKey);
            } else if (selectedCount >= totalCount) {
              collectionMap.set(collectionKey, { key: collectionKey, status: 'selected' });
            } else {
              collectionMap.set(collectionKey, { key: collectionKey, status: 'indeterminate' });
            }
          });

          return Array.from(collectionMap.values());
        });
      }

      onChangeComponentSelection?.(newSelectedComponents);
      return newSelectedComponents;
    });
  }, [onChangeComponentSelection]);

  const context = useMemo<ComponentPickerContextData>(() => {
    switch (componentPickerMode) {
      case 'single':
        return {
          componentPickerMode,
          restrictToLibrary,
          onComponentSelected,
        };
      case 'multiple':
        return {
          componentPickerMode,
          restrictToLibrary,
          selectedCollections,
          selectedComponents,
          addComponentToSelectedComponents,
          removeComponentFromSelectedComponents,
        };
      default:
        // istanbul ignore next: this should never happen
        throw new Error('Invalid component picker mode');
    }
  }, [
    componentPickerMode,
    restrictToLibrary,
    onComponentSelected,
    addComponentToSelectedComponents,
    removeComponentFromSelectedComponents,
    selectedComponents,
    selectedCollections,
  ]);

  return (
    <ComponentPickerContext.Provider value={context}>
      {children}
    </ComponentPickerContext.Provider>
  );
};

export function useComponentPickerContext(): ComponentPickerContextData | NoComponentPickerType {
  const ctx = useContext(ComponentPickerContext);
  if (ctx === undefined) {
    return {
      componentPickerMode: false,
    };
  }
  return ctx;
}
