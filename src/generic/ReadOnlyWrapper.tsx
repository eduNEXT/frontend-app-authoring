import { type ReactElement, type ReactNode } from 'react';
import { FormattedMessage } from '@edx/frontend-platform/i18n';
import { OverlayTrigger, Popover, Tooltip } from '@openedx/paragon';
import messages from './messages';

interface ReadOnlyWrapperProps {
  readOnly: boolean;
  /** Custom tooltip content. Defaults to the generic "no permission" message. */
  tooltipContent?: ReactNode;
  /**
   * Visual style of the overlay.
   * - `'popover'` (default): white background, suits inline action buttons.
   * - `'tooltip'`: dark background, suits icon buttons that already use Tooltip.
   */
  variant?: 'popover' | 'tooltip';
  children: ReactElement;
}

/**
 * When `readOnly` is true, wraps `children` in an OverlayTrigger that shows a
 * "no permission" message on hover and focus. Children should be rendered with
 * `disabled` so they are not interactive; the wrapping `<span>` carries the
 * pointer/focus events that a native-disabled element would suppress.
 *
 * When `readOnly` is false, renders `children` unchanged.
 */
const ReadOnlyWrapper = ({
  readOnly, tooltipContent, variant = 'popover', children,
}: ReadOnlyWrapperProps) => {
  if (!readOnly) {
    return children;
  }

  const content = tooltipContent ?? <FormattedMessage {...messages.readOnlyTooltip} />;
  const overlay = variant === 'tooltip'
    ? <Tooltip id="read-only-wrapper-tooltip">{content}</Tooltip>
    : (
      <Popover id="read-only-wrapper-popover">
        <Popover.Content className="text-left p-2">{content}</Popover.Content>
      </Popover>
    );

  return (
    <OverlayTrigger trigger={['hover', 'focus']} placement="top" overlay={overlay}>
      <span>{children}</span>
    </OverlayTrigger>
  );
};

export default ReadOnlyWrapper;
