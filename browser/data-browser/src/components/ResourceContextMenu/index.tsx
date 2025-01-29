import { useCallback, useState } from 'react';
import { Client, core, useCanWrite, useResource } from '@tomic/react';
import {
  editURL,
  dataURL,
  constructOpenURL,
  historyURL,
  shareURL,
  importerURL,
} from '../../helpers/navigation';
import { DIVIDER, DropdownMenu, isItem, DropdownItem } from '../Dropdown';
import toast from 'react-hot-toast';
import { paths } from '../../routes/paths';
import { shortcuts } from '../HotKeyWrapper';
import { DropdownTriggerComponent } from '../Dropdown/DropdownTrigger';
import { buildDefaultTrigger } from '../Dropdown/DefaultTrigger';
import {
  FaClock,
  FaCode,
  FaDownload,
  FaPencil,
  FaEllipsisVertical,
  FaMagnifyingGlass,
  FaShare,
  FaTrash,
  FaPlus,
  FaArrowUpRightFromSquare,
} from 'react-icons/fa6';
import { useQueryScopeHandler } from '../../hooks/useQueryScope';
import {
  ConfirmationDialog,
  ConfirmationDialogTheme,
} from '../ConfirmationDialog';
import { ResourceInline } from '../../views/ResourceInline';
import { ResourceUsage } from '../ResourceUsage';
import { useCurrentSubject } from '../../helpers/useCurrentSubject';
import { ResourceCodeUsageDialog } from '../../views/CodeUsage/ResourceCodeUsageDialog';
import { useNewRoute } from '../../helpers/useNewRoute';
import { addIf } from '../../helpers/addIf';
import { useNavigateWithTransition } from '../../hooks/useNavigateWithTransition';

export const ContextMenuOptions = {
  View: 'view',
  Data: 'data',
  Edit: 'edit',
  Scope: 'scope',
  Share: 'share',
  Delete: 'delete',
  History: 'history',
  Import: 'import',
  UseInCode: 'useInCode',
  NewChild: 'newChild',
  Export: 'export',
  Open: 'open',
} as const;

export type ContextMenuOptionsUnion =
  (typeof ContextMenuOptions)[keyof typeof ContextMenuOptions];

export interface ResourceContextMenuProps {
  subject: string;
  // If given only these options will appear in the list.
  showOnly?: ContextMenuOptionsUnion[];
  trigger?: DropdownTriggerComponent;
  simple?: boolean;
  /** If it's the primary menu in the navbar. Used for triggering keyboard shortcut */
  isMainMenu?: boolean;
  bindActive?: (active: boolean) => void;
  /** Callback that is called after the resource was deleted */
  onAfterDelete?: () => void;
  title?: string;
  external?: boolean;
}

/** Dropdown menu that opens a bunch of actions for some resource */
export function ResourceContextMenu({
  subject,
  showOnly,
  trigger,
  simple,
  isMainMenu,
  title,
  external,
  bindActive,
  onAfterDelete,
}: ResourceContextMenuProps) {
  const navigate = useNavigateWithTransition();
  const location = window.location;
  const resource = useResource(subject);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCodeUsageDialog, setShowCodeUsageDialog] = useState(false);
  const handleAddClick = useNewRoute(subject);
  const [currentSubject] = useCurrentSubject();
  const canWrite = useCanWrite(resource);
  const { enableScope } = useQueryScopeHandler(subject);
  // Try to not have a useResource hook in here, as that will lead to many costly fetches when the user enters a new subject

  const handleDestroy = useCallback(async () => {
    const parent = resource.get(core.properties.parent);

    try {
      await resource.destroy();
      onAfterDelete?.();
      toast.success('Resource deleted!');

      if (currentSubject === subject) {
        navigate(parent ? constructOpenURL(parent) : '/');
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [resource, navigate, currentSubject, onAfterDelete]);

  if (subject === undefined) {
    return null;
  }

  if (!Client.isValidSubject(subject)) {
    return null;
  }

  const items: DropdownItem[] = [
    ...addIf<DropdownItem>(
      !simple,
      {
        disabled: location.pathname.startsWith(paths.show),
        id: ContextMenuOptions.View,
        label: 'Normal View',
        helper: 'Open the regular, default View.',
        onClick: () => navigate(constructOpenURL(subject)),
      },
      {
        disabled: location.pathname.startsWith(paths.data),
        id: ContextMenuOptions.Data,
        label: 'Data View',
        helper: 'View the resource and its properties in the Data View.',
        shortcut: shortcuts.data,
        onClick: () => navigate(dataURL(subject)),
      },
      DIVIDER,
    ),
    ...addIf(!!external, {
      id: ContextMenuOptions.Open,
      label: 'Open',
      helper: 'Open the resource',
      onClick: () => navigate(constructOpenURL(subject)),
      icon: <FaArrowUpRightFromSquare />,
    }),
    ...addIf(
      canWrite,
      {
        id: ContextMenuOptions.Edit,
        label: 'Edit',
        helper: 'Open the edit form.',
        icon: <FaPencil />,
        shortcut: simple ? '' : shortcuts.edit,
        onClick: () => navigate(editURL(subject)),
      },
      {
        id: ContextMenuOptions.NewChild,
        label: 'Add child',
        helper: 'Create a new resource under this resource.',
        icon: <FaPlus />,
        onClick: handleAddClick,
      },
    ),
    {
      id: ContextMenuOptions.UseInCode,
      label: 'Use in code',
      helper:
        'Usage instructions for how to fetch and use the resource in your code.',
      icon: <FaCode />,
      onClick: () => setShowCodeUsageDialog(true),
    },
    {
      id: ContextMenuOptions.Scope,
      label: 'Search children',
      helper: 'Scope search to resource',
      icon: <FaMagnifyingGlass />,
      onClick: enableScope,
    },
    {
      id: ContextMenuOptions.Share,
      label: 'Permissions & Invites',
      icon: <FaShare />,
      helper: 'Edit permissions and create invites.',
      onClick: () => navigate(shareURL(subject)),
    },

    {
      id: ContextMenuOptions.History,
      icon: <FaClock />,
      label: 'History',
      helper: 'Show the history of this resource',
      onClick: () => navigate(historyURL(subject)),
    },
    ...addIf(
      canWrite,
      {
        id: ContextMenuOptions.Import,
        icon: <FaDownload />,
        label: 'Import',
        helper: 'Import Atomic Data to this resource',
        onClick: () => navigate(importerURL(subject)),
      },
      {
        disabled: !canWrite,
        id: ContextMenuOptions.Delete,
        icon: <FaTrash />,
        label: 'Delete',
        helper: 'Delete this resource.',
        onClick: () => setShowDeleteDialog(true),
      },
    ),
  ];

  const filteredItems = showOnly
    ? items.filter(
        item =>
          !isItem(item) ||
          showOnly.includes(item.id as ContextMenuOptionsUnion),
      )
    : items;

  const triggerComp =
    trigger ??
    buildDefaultTrigger(
      <FaEllipsisVertical />,
      title ?? `Open ${resource.title} menu`,
    );

  return (
    <>
      <DropdownMenu
        items={filteredItems}
        Trigger={triggerComp}
        isMainMenu={isMainMenu}
        bindActive={bindActive}
      />
      <ConfirmationDialog
        title={`Delete resource`}
        show={showDeleteDialog}
        bindShow={setShowDeleteDialog}
        theme={ConfirmationDialogTheme.Alert}
        confirmLabel={'Delete'}
        onConfirm={handleDestroy}
      >
        <>
          <p>
            Are you sure you want to delete <ResourceInline subject={subject} />
          </p>
          <ResourceUsage resource={resource} />
        </>
      </ConfirmationDialog>
      {currentSubject && (
        <ResourceCodeUsageDialog
          subject={currentSubject}
          show={showCodeUsageDialog}
          bindShow={setShowCodeUsageDialog}
        />
      )}
    </>
  );
}
