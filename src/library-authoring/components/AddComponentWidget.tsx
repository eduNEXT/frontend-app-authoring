import { useMemo } from 'react';
import { FormattedMessage, useIntl } from '@edx/frontend-platform/i18n';
import { Button } from '@openedx/paragon';
import {
  AddCircleOutline,
  CheckBoxIcon,
  IndeterminateCheckBox,
  CheckBoxOutlineBlank,
} from '@openedx/paragon/icons';

import { useSearchContext } from '../../search-manager';
import {
  SelectedComponent,
  useComponentPickerContext,
  useCollectionIndexing,
} from '../common/context/ComponentPickerContext';
import messages from './messages';

interface AddComponentWidgetProps {
  usageKey: string;
  blockType: string;
  collectionKeys?: string[];
  isCollection?: boolean;
}

const AddComponentWidget = ({
  usageKey, blockType, collectionKeys, isCollection,
}: AddComponentWidgetProps) => {
  const intl = useIntl();

  const {
    componentPickerMode,
    onComponentSelected,
    addComponentToSelectedComponents,
    removeComponentFromSelectedComponents,
    selectedComponents,
    selectedCollections,
  } = useComponentPickerContext();

  const { hits } = useSearchContext();

  // Use indexed lookup for O(1) performance instead of O(n) filtering
  const { collectionToComponents, componentToCollections } = useCollectionIndexing(hits);

  const collectionData = useMemo(() => {
    // When selecting a collection: O(1) lookup instead of O(n) filter
    if (isCollection) {
      return collectionToComponents.get(usageKey) ?? [];
    }

    // When selecting an individual component: O(1) lookup + O(m) count
    const componentCollectionKeys = componentToCollections.get(usageKey);
    if (!componentCollectionKeys?.length) {
      return 0;
    }

    // Count total components across all collections this component belongs to
    const componentSet = new Set<string>();
    componentCollectionKeys.forEach((collectionKey) => {
      const components = collectionToComponents.get(collectionKey) ?? [];
      components.forEach((comp) => componentSet.add(comp.usageKey));
    });

    return componentSet.size;
  }, [collectionToComponents, componentToCollections, usageKey, isCollection]);

  // istanbul ignore if: this should never happen
  if (!usageKey) {
    throw new Error('usageKey is required');
  }

  // istanbul ignore if: this should never happen
  if (!componentPickerMode) {
    return null;
  }

  if (componentPickerMode === 'single') {
    return (
      <Button
        variant="outline-primary"
        iconBefore={AddCircleOutline}
        onClick={() => {
          onComponentSelected({ usageKey, blockType });
        }}
      >
        <FormattedMessage {...messages.componentPickerSingleSelectTitle} />
      </Button>
    );
  }

  if (componentPickerMode === 'multiple') {
    const collectionStatus = selectedCollections.find((c) => c.key === usageKey)?.status;

    const isChecked = isCollection
      ? collectionStatus === 'selected'
      : selectedComponents.some((component) => component.usageKey === usageKey);

    const isIndeterminate = isCollection && collectionStatus === 'indeterminate';

    const getIcon = () => {
      if (isChecked) { return CheckBoxIcon; }
      if (isIndeterminate) { return IndeterminateCheckBox; }
      return CheckBoxOutlineBlank;
    };

    const handleChange = () => {
      const selectedComponent: SelectedComponent = {
        usageKey,
        blockType,
        collectionKeys,
      };
      if (!isChecked) {
        addComponentToSelectedComponents(selectedComponent, collectionData);
      } else {
        removeComponentFromSelectedComponents(selectedComponent, collectionData);
      }
    };

    return (
      <Button
        variant="outline-primary"
        iconBefore={getIcon()}
        onClick={handleChange}
      >
        {intl.formatMessage(messages.componentPickerMultipleSelectTitle)}
      </Button>
    );
  }

  // istanbul ignore next: this should never happen
  return null;
};

export default AddComponentWidget;
