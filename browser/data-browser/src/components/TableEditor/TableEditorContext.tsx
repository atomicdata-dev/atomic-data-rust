import {
  useCallback,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
  ReactElement,
  type JSX,
} from 'react';
import { FixedSizeList } from 'react-window';
import { EventManager } from '../../helpers/EventManager';
import { KeyboardInteraction } from './helpers/keyboardHandlers';

export enum TableEvent {
  EnterEditModeWithCharacter = 'enterEditModeWithCharacter',
  ClearCell = 'clearCell',
  ClearRow = 'clearRow',
  InteractionsFired = 'interactionsFired',
}

export type TableEventHandlers = {
  enterEditModeWithCharacter: (key: string) => void;
  clearCell: () => void;
  clearRow: (index: number) => void;
  interactionsFired: (interactions: KeyboardInteraction[]) => void;
};

export enum CursorMode {
  Visual,
  Edit,
  MultiSelect,
}

function emptySetState<T>(_: T | ((__: T) => T)): undefined {
  return undefined;
}

export interface TableEditorContext {
  mouseDown: boolean;
  setMouseDown: React.Dispatch<React.SetStateAction<boolean>>;
  tableRef: React.RefObject<HTMLDivElement | null>;
  disabledKeyboardInteractions: Set<KeyboardInteraction>;
  setDisabledKeyboardInteractions: React.Dispatch<
    React.SetStateAction<Set<KeyboardInteraction>>
  >;
  selectedRow: number | undefined;
  selectedColumn: number | undefined;
  multiSelectCornerRow: number | undefined;
  multiSelectCornerColumn: number | undefined;
  setActiveCell: (row: number | undefined, column: number | undefined) => void;
  indicatorHidden: boolean;
  setIndicatorHidden: React.Dispatch<React.SetStateAction<boolean>>;
  setMultiSelectCorner: (
    row: number | undefined,
    column: number | undefined,
  ) => void;
  activeCellRef: React.RefObject<HTMLDivElement | null>;
  updateActiveCellRef: (newValue: HTMLDivElement | null) => void;
  multiSelectCornerCellRef: React.RefObject<HTMLDivElement | null>;
  updateMultiSelectCornerCellRef: (newValue: HTMLDivElement | null) => void;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  listRef: React.RefObject<FixedSizeList | null>;
  cursorMode: CursorMode;
  setCursorMode: React.Dispatch<React.SetStateAction<CursorMode>>;
  clearCell: () => void;
  clearRow: (index: number) => void;
  enterEditModeWithCharacter: (key: string) => void;
  markings: Map<number, ReactElement>;
  setMarkings: React.Dispatch<React.SetStateAction<Map<number, ReactElement>>>;
  registerEventListener<T extends TableEvent>(
    event: T,
    cb: TableEventHandlers[T],
  ): () => void;
  emitInteractionsFired(interactions: KeyboardInteraction[]): void;
}

const initial: TableEditorContext = {
  mouseDown: false,
  setMouseDown: emptySetState,
  tableRef: { current: null },
  disabledKeyboardInteractions: new Set<KeyboardInteraction>(),
  setDisabledKeyboardInteractions: emptySetState,
  selectedRow: undefined,
  selectedColumn: undefined,
  multiSelectCornerRow: undefined,
  multiSelectCornerColumn: undefined,
  setActiveCell: () => undefined,
  indicatorHidden: false,
  setIndicatorHidden: emptySetState,
  setMultiSelectCorner: () => undefined,
  activeCellRef: { current: null },
  updateActiveCellRef: () => undefined,
  multiSelectCornerCellRef: { current: null },
  updateMultiSelectCornerCellRef: () => undefined,
  isDragging: false,
  setIsDragging: emptySetState,
  listRef: { current: null },
  cursorMode: CursorMode.Visual,
  setCursorMode: emptySetState,
  clearCell: () => undefined,
  clearRow: (_: number) => undefined,
  enterEditModeWithCharacter: (_: string) => undefined,
  markings: new Map<number, ReactElement>(),
  setMarkings: emptySetState,
  registerEventListener: () => () => undefined,
  emitInteractionsFired: () => undefined,
};

const TableEditorContext = createContext<TableEditorContext>(initial);

export function TableEditorContextProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const [mouseDown, setMouseDown] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<FixedSizeList>(null);
  const [eventManager] = useState(
    () => new EventManager<TableEvent, TableEventHandlers>(),
  );
  const [disabledKeyboardInteractions, setDisabledKeyboardInteractions] =
    useState<Set<KeyboardInteraction>>(new Set());
  const [selectedRow, setSelectedRow] = useState<number | undefined>();
  const [selectedColumn, setSelectedColumn] = useState<number | undefined>();
  const [multiSelectCornerRow, setMultiSelectCornerRow] = useState<
    number | undefined
  >();
  const [multiSelectCornerColumn, setMultiSelectCornerColumn] = useState<
    number | undefined
  >();

  const [isDragging, setIsDragging] = useState(false);
  const [cursorMode, setCursorMode] = useState(CursorMode.Visual);

  const [indicatorHidden, setIndicatorHidden] = useState(false);

  const [markings, setMarkings] = useState<Map<number, ReactElement>>(
    new Map(),
  );

  const activeCellRef = useRef<HTMLDivElement | null>(null);

  const updateActiveCellRef = useCallback((newValue: HTMLDivElement | null) => {
    activeCellRef.current = newValue;
  }, []);

  const multiSelectCornerCellRef = useRef<HTMLDivElement | null>(null);

  const updateMultiSelectCornerCellRef = useCallback(
    (newValue: HTMLDivElement | null) => {
      multiSelectCornerCellRef.current = newValue;
    },
    [],
  );

  const setActiveCell = useCallback(
    (row: number | undefined, column: number | undefined) => {
      setSelectedRow(row);
      setSelectedColumn(column);
    },
    [],
  );

  const setMultiSelectCorner = useCallback(
    (row: number | undefined, column: number | undefined) => {
      setMultiSelectCornerRow(row);
      setMultiSelectCornerColumn(column);
    },
    [],
  );

  const clearCell = useCallback(() => {
    eventManager.emit(TableEvent.ClearCell);
  }, [eventManager]);

  const clearRow = useCallback(
    (index: number) => {
      eventManager.emit(TableEvent.ClearRow, index);
    },
    [eventManager],
  );

  const enterEditModeWithCharacter = useCallback(
    (key: string) => {
      eventManager.emit(TableEvent.EnterEditModeWithCharacter, key);
    },
    [eventManager],
  );

  const emitInteractionsFired = useCallback(
    (interactions: KeyboardInteraction[]) => {
      eventManager.emit(TableEvent.InteractionsFired, interactions);
    },
    [eventManager],
  );

  const context = useMemo(
    () => ({
      mouseDown,
      setMouseDown,
      tableRef,
      disabledKeyboardInteractions,
      setDisabledKeyboardInteractions,
      selectedRow,
      selectedColumn,
      multiSelectCornerRow,
      multiSelectCornerColumn,
      indicatorHidden,
      setIndicatorHidden,
      setActiveCell,
      setMultiSelectCorner,
      activeCellRef,
      updateActiveCellRef,
      multiSelectCornerCellRef,
      updateMultiSelectCornerCellRef,
      isDragging,
      setIsDragging,
      listRef,
      cursorMode,
      setCursorMode,
      registerEventListener: eventManager.register.bind(eventManager),
      clearCell,
      clearRow,
      enterEditModeWithCharacter,
      emitInteractionsFired,
      markings,
      setMarkings,
    }),
    [
      disabledKeyboardInteractions,
      selectedRow,
      selectedColumn,
      multiSelectCornerColumn,
      multiSelectCornerRow,
      indicatorHidden,
      setActiveCell,
      setMultiSelectCorner,
      updateActiveCellRef,
      updateMultiSelectCornerCellRef,
      isDragging,
      cursorMode,
      emitInteractionsFired,
      mouseDown,
      markings,
    ],
  );

  return (
    <TableEditorContext.Provider value={context}>
      {children}
    </TableEditorContext.Provider>
  );
}

export function useTableEditorContext() {
  return useContext(TableEditorContext);
}
