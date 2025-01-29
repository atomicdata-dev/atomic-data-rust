import { FaEllipsisV } from 'react-icons/fa';
import { DropdownTriggerComponent } from '../Dropdown/DropdownTrigger';
import { shortcuts } from '../HotKeyWrapper';
import { IconButton } from '../IconButton/IconButton';

export const MenuBarDropdownTrigger: DropdownTriggerComponent = ({
  onClick,
  menuId,
  ref,
}) => (
  <IconButton
    aria-controls={menuId}
    ref={ref}
    title={`Open menu (${shortcuts.menu})`}
    type='button'
    data-test='context-menu'
    onClick={onClick}
  >
    <FaEllipsisV />
  </IconButton>
);

MenuBarDropdownTrigger.displayName = 'MenuBarDropdownTrigger';
