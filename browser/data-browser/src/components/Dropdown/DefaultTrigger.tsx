import { IconButton } from '../IconButton/IconButton';
import {
  DropdownTriggerComponent,
  type DropdownTriggerProps,
} from './DropdownTrigger';

/** Builds a default trigger for a dropdown menu using an IconButton.
 * Make sure the component stays mounted when the menu is open in order to have proper focus management.
 */
export const buildDefaultTrigger = (
  icon: React.ReactNode,
  title = 'Open menu',
  ButtonComp: typeof IconButton = IconButton,
): DropdownTriggerComponent => {
  const Comp = ({
    onClick,
    menuId,
    isActive,
    ref,
    id,
  }: DropdownTriggerProps) => {
    return (
      <ButtonComp
        id={id}
        aria-controls={menuId}
        aria-expanded={isActive}
        aria-haspopup='menu'
        onClick={onClick}
        ref={ref}
        title={title}
      >
        {icon}
      </ButtonComp>
    );
  };

  Comp.DisplayName = 'DefaultTrigger';

  return Comp;
};
