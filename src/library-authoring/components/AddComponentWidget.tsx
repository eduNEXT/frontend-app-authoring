import { useMemo } from 'react';
import { FormattedMessage, useIntl } from '@edx/frontend-platform/i18n';
import { Button } from '@openedx/paragon';
import {
  AddCircleOutline,
  CheckBoxIcon,
  IndeterminateCheckBox,
  CheckBoxOutlineBlank,
} from '@openedx/paragon/icons';

import {
  SelectedComponent,
  useComponentPickerContext,
  useCollectionIndexContext,
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

  const {
    collectionToComponents,
    componentToCollections,
    collectionToAffectedSizes,
    collectionSizes,
  } = useCollectionIndexContext();

  const collectionData = useMemo(() => {
    if (isCollection) {
      return {
        components: collectionToComponents.get(usageKey) ?? [],
        affectedCollectionSizes: collectionToAffectedSizes.get(usageKey) ?? new Map<string, number>(),
      };
    }

    const componentCollectionKeys = componentToCollections.get(usageKey);
    if (!componentCollectionKeys?.length) {
      return new Map<string, number>();
    }

    const sizes = new Map<string, number>();
    componentCollectionKeys.forEach((collectionKey) => {
      const size = collectionSizes.get(collectionKey);
      if (size !== undefined) {
        sizes.set(collectionKey, size);
      }
    });

    return sizes;
  }, [
    collectionToComponents,
    componentToCollections,
    collectionToAffectedSizes,
    collectionSizes,
    usageKey,
    isCollection,
  ]);

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

      const isCollectionData = isCollection && 'components' in collectionData;

      if (!isChecked) {
        addComponentToSelectedComponents(
          selectedComponent,
          isCollectionData ? collectionData : collectionData as Map<string, number>,
        );
      } else {
        removeComponentFromSelectedComponents(
          selectedComponent,
          isCollectionData ? collectionData : collectionData as Map<string, number>,
        );
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
